# MDRAR Portal — "App Gets Stuck" Root-Cause Analysis & Fix Instructions

**Audience:** coding agent fixing this repo.
**Context:** the person reports the app "gets stuck" while signing in and while visiting pages. This document identifies the exact confirmed root cause, secondary contributing bugs, and precise fixes. Read this whole file before editing anything — several bugs interact with each other.

Applies to: `VITE_DATA_SOURCE=supabase` mode (`src/data/client/supabase/index.ts`, `src/auth/AuthProvider.tsx`). The mock mode (`src/data/client/mock/*`) is not affected by the primary bug, but has one related issue too (see Bug #6).

---

## BUG #1 (CRITICAL, root cause of "stuck on sign-in / stuck loading pages") — `supabase.auth.*` deadlock inside `onAuthStateChange`

### Where
`src/data/client/supabase/index.ts`, lines 13–61 (`getSupabaseSession()` and the `auth` object).

### What's wrong
```ts
async function getSupabaseSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();   // <-- acquires an internal auth lock
  ...
}

export const supabaseDataSource: DataSource = {
  auth: {
    async getSession() { return getSupabaseSession(); },
    async signInWithPassword(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password }); // <-- acquires the same lock
      ...
      const session = await getSupabaseSession(); // <-- tries to acquire it again
      ...
    },
    onAuthStateChange(cb) {
      const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!session) { cb(null); return; }
        cb(await getSupabaseSession());   // <-- calls supabase.auth.getSession() from INSIDE the auth-state-change callback
      });
      return () => data.subscription.unsubscribe();
    },
  },
  ...
```

`@supabase/auth-js` (the version pinned here is `2.71.1`, via `@supabase/supabase-js@^2.57.4`) serializes all auth operations (`getSession`, `signInWithPassword`, `signOut`, `refreshSession`, etc.) behind a single internal mutex (`navigator.locks` in the browser). This is a long-standing, extensively documented class of bug in `supabase-js`/`auth-js` (see GitHub issues `supabase/auth-js` #762, #936, #1401, #1594, #2013, #2111 — "GoTrueClient deadlock", "onAuthStateChange callback calling another auth method hangs forever", "orphaned Web Locks never release").

Two separate mechanisms both trigger the deadlock in this codebase:

1. **Calling another `auth.*` method from inside the `onAuthStateChange` callback.** The `SIGNED_IN` / `INITIAL_SESSION` / `TOKEN_REFRESHED` events fire *while the client still holds the lock* for the operation that triggered them (e.g. the in-flight `signInWithPassword()` call, or the initial client bootstrap). The callback here calls `getSupabaseSession()`, which calls `supabase.auth.getSession()` again — a second attempt to acquire the *same* lock, from *inside* the code that's holding it. The lock never releases. The awaiting caller (`signIn()` in `AuthProvider`, or the initial `getSession()` in the `useEffect`) never resolves, ever.
2. **React `StrictMode` double-invoking the auth-bootstrap effect.** `src/main.tsx` wraps `<App />` in `<StrictMode>`, and `AuthProvider`'s `useEffect` calls `dataSource.auth.getSession()` and subscribes `onAuthStateChange` on mount with no guard against the deliberate mount→unmount→remount cycle React runs in dev. If the first `getSession()` call is still in flight when Strict Mode unmounts the component, the lock can be orphaned (never released), so **every subsequent auth call in the app hangs forever**, even outside of Strict Mode's double-invoke window. This matches "gets stuck ... visiting pages" — a hang here poisons the *whole session*, not just the page that triggered it.

### Why this exactly matches the reported symptom
- `AuthProvider.loading` starts `true` and is only ever set to `false` inside the `.then()`/`.catch()` of `getSession()` or inside `signIn()`. If either of those promises never settles (deadlock), `loading` stays `true` forever.
- `ProtectedRoute` / `RequireRole` render an infinite spinner (`<AuthLoading />`) whenever `loading` is `true` — with no timeout, no error path, nothing. So the user sees an endless spinner on the login button ("Signing in...") or on any protected route ("visiting pages... gets stuck") — exactly as reported.
- The `ErrorBoundary` cannot catch this because nothing throws — the promise just never resolves.

### The existing "fix" in `AuthProvider.tsx` does not work and must be removed
```ts
const signingIn = useRef(false);
...
const signIn = async (email: string, password: string): Promise<Session> => {
  signingIn.current = true;
  try {
    const s = await dataSource.auth.signInWithPassword(email, password);
    ...
  } finally {
    setTimeout(() => { signingIn.current = false; }, 500);
  }
};
```
This was an attempt to stop `onAuthStateChange` from double-fetching the profile after a manual sign-in. It's a race-condition band-aid, and it **cannot prevent the deadlock**, because the deadlock happens *inside* `signInWithPassword()` itself (the `SIGNED_IN` event fires synchronously off the still-held lock, before `signInWithPassword()`'s own promise resolves). If the deadlock occurs, `finally` never even runs, so the flag is never reset either. Remove this whole `signingIn` mechanism as part of the real fix below — it's dead weight once the callback no longer calls another lock-based method.

### The fix
Do not call any `supabase.auth.*` method from inside the `onAuthStateChange` callback. Use the `session` object the callback already receives as its second argument — it already has everything needed (user id, email, expiry) — and fetch only the *profile* row (a plain `.from('profiles').select()`, not an `auth.*` call) directly, without going through `supabase.auth.getSession()` again.

Rewrite `src/data/client/supabase/index.ts` auth section like this:

```ts
async function buildSessionFromAuthSession(authSession: import('@supabase/supabase-js').Session): Promise<Session | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, role, tenant_property_id, tenant_unit')
    .eq('id', authSession.user.id)
    .single();
  if (error || !profile) return null;

  const roleMap: Record<string, Session['role']> = {
    tenant: 'tenant', pm_manager: 'pm_manager', pm_viewer: 'pm_viewer', technician: 'technician',
  };
  const role: Session['role'] = roleMap[profile.role] ?? 'management';

  let technicianId: string | undefined;
  if (profile.role === 'technician') {
    const { data: tech } = await supabase.from('technicians').select('id').eq('profile_id', authSession.user.id).single();
    technicianId = tech?.id;
  }

  return {
    userId: authSession.user.id,
    email: authSession.user.email ?? '',
    role,
    managementRole: (role === 'management' || role === 'technician') ? profile.role : undefined,
    name: profile.full_name,
    tenantPropertyId: profile.tenant_property_id ?? undefined,
    tenantUnit: profile.tenant_unit ?? undefined,
    technicianId,
    expiresAt: new Date((authSession.expires_at ?? 0) * 1000).getTime(),
  };
}

export const supabaseDataSource: DataSource = {
  auth: {
    async getSession() {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) return null;
      return buildSessionFromAuthSession(data.session);
    },
    async signInWithPassword(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) throw { code: 'UNAUTHORIZED', message: error?.message ?? 'Sign in failed' };
      const session = await buildSessionFromAuthSession(data.session);
      if (!session) throw { code: 'UNAUTHORIZED', message: 'No profile found for this account' };
      return session;
    },
    async signOut() { await supabase.auth.signOut(); },
    onAuthStateChange(cb) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        // IMPORTANT: do not call supabase.auth.getSession() (or any other
        // supabase.auth.* method) in here — that is what caused the deadlock.
        // Only plain supabase.from(...) calls are safe inside this callback.
        if (!session) { cb(null); return; }
        // Defer to a microtask/macrotask so this runs fully outside the
        // GoTrue callback stack, as recommended by Supabase for any async
        // work triggered from onAuthStateChange.
        setTimeout(() => {
          buildSessionFromAuthSession(session).then(cb).catch(() => cb(null));
        }, 0);
      });
      return () => data.subscription.unsubscribe();
    },
  },
  ...
```

Key points for the agent implementing this:
1. `buildSessionFromAuthSession` takes the `Session` object supabase already handed you (from `getSession()`'s `data.session` or the callback's `session` argument) instead of calling `supabase.auth.getSession()` a second time.
2. Inside `onAuthStateChange`'s callback, never call `supabase.auth.getSession()`, `supabase.auth.getUser()`, `supabase.auth.signOut()`, `supabase.auth.refreshSession()`, etc. Only plain table queries (`supabase.from(...)`) are safe there, and even those should be deferred with `setTimeout(fn, 0)` so they run after the callback stack (and its lock) has fully unwound — this is Supabase's own documented workaround for pre-lockless versions of the client.
3. Do this rewrite for **every** `async getSupabaseSession()`-style helper — there is only one definition, but double-check nothing else duplicates this pattern after the refactor.

---

## BUG #2 — `AuthProvider`'s `signingIn` ref / `setTimeout(500)` hack must be deleted

### Where
`src/auth/AuthProvider.tsx`, lines 17–48.

### What's wrong
This was a workaround for a symptom of Bug #1 (double session-fetch race between manual sign-in and the auth-state-change listener), not a fix for the actual deadlock. Once Bug #1 is fixed (the callback no longer re-fetches via `supabase.auth.getSession()`), this flag serves no purpose and just adds fragile, timing-dependent behavior (a hardcoded 500ms window that can still race under slow networks).

### Fix
Simplify `AuthProvider.tsx` to:
```tsx
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    dataSource.auth.getSession()
      .then((s) => { if (mounted) { setSession(s); setLoading(false); } })
      .catch(() => { if (mounted) setLoading(false); });

    const unsubscribe = dataSource.auth.onAuthStateChange((s) => {
      if (!mounted) return;
      setSession(s);
      setLoading(false);
    });

    return () => { mounted = false; unsubscribe(); };
  }, []);

  const signIn = async (email: string, password: string): Promise<Session> => {
    const s = await dataSource.auth.signInWithPassword(email, password);
    setSession(s);
    setLoading(false);
    return s;
  };

  const signOut = async () => {
    await dataSource.auth.signOut();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
```
The `mounted` guard fixes the Strict-Mode double-invoke race described in Bug #1 (part 2) at the React level — the first, discarded mount's callbacks become no-ops instead of writing state after unmount or leaving stray listeners racing the second mount's listener.

---

## BUG #3 (defense-in-depth, do this regardless of Bug #1/#2 fixes) — no timeout/escape hatch if an auth call ever hangs again

### Where
`src/auth/ProtectedRoute.tsx`.

### What's wrong
`AuthLoading` renders an infinite spinner with no upper bound. If *any* future regression reintroduces a hang (network stall, a new call added inside `onAuthStateChange`, an RLS misconfiguration that makes the profile query hang, etc.), the user is stuck on a spinner forever with no recovery path and no diagnostic signal.

### Fix
Add a client-side timeout in `AuthProvider` so a stuck auth check fails safe (treated as "no session") instead of hanging forever, and surface a "taking longer than expected" affordance in `AuthLoading` after a few seconds with a manual "Reload" action. Suggested approach:

```ts
useEffect(() => {
  let mounted = true;
  const timeout = setTimeout(() => {
    if (mounted) setLoading(false); // fail safe: fall through to "no session" -> /login
  }, 10_000);

  dataSource.auth.getSession()
    .then((s) => { if (mounted) { setSession(s); setLoading(false); clearTimeout(timeout); } })
    .catch(() => { if (mounted) { setLoading(false); clearTimeout(timeout); } });

  const unsubscribe = dataSource.auth.onAuthStateChange((s) => {
    if (!mounted) return;
    setSession(s);
    setLoading(false);
    clearTimeout(timeout);
  });

  return () => { mounted = false; clearTimeout(timeout); unsubscribe(); };
}, []);
```
And in `ProtectedRoute.tsx`'s `AuthLoading`, after ~4s show a "This is taking longer than usual — Reload" button (`window.location.reload()`), so the user is never silently stuck with no way out even if some other bug causes a stall.

---

## BUG #4 — redundant `supabase.auth.getSession()` calls scattered across nearly every mutation

### Where
`src/data/client/supabase/index.ts` — at least 15 call sites, e.g. lines 112, 137, 180, 209, 222, 228, 251, 311, 346, 485, 515, 525, 609, 635, 665 (search for `supabase.auth.getSession()`). Examples: `requests.create`, `requests.addTimelineEvent`, `messages.send`, `notifications.markAllRead`, `preferences.get/update`, `announcements.create`, `risks.addPhoto`, `ipc.create/addAttachment`, etc.

### What's wrong
Each of these calls `supabase.auth.getSession()` purely to read `sd.session?.user.id` and stamp it onto an insert/update (`created_by`, `uploaded_by`, `tenant_id`, `sender_id`, etc.). This is unnecessary:
- The `Session` object is already available app-wide via `useAuth()` (`AuthContext`) — the caller already knows `userId` and can pass it in, or the data layer can accept it as a parameter.
- Every one of these calls goes through the same lock-serialized `auth.*` code path described in Bug #1. Even after Bug #1 is fixed, this pattern means dozens of otherwise-independent mutations are all funneled through the same internal auth mutex, unnecessarily serializing unrelated writes and creating more surface area for future lock contention (e.g. if a token refresh (`TOKEN_REFRESHED`) fires while several of these are in flight).
- It's also redundant from a security standpoint: RLS policies already enforce `auth.uid()` server-side on every one of these tables (see `supabase/migrations/20250101000000_full_schema.sql`), so the client doesn't need to know its own user id to satisfy the policy — only to store it on the row for display/query purposes, which Postgres can also just default via `auth.uid()` in the column default or a trigger.

### Fix (pick one, prefer option A)
**Option A (recommended, less churn on the DB):** Thread `userId` through from the caller instead of re-fetching it. Since every one of these `DataSource` methods is called from a React Query hook that runs inside components that already have `useAuth()`, either:
- Add `session: Session` (or just `userId: string`) as a parameter to the affected `DataSource` methods, and have the calling hooks (`src/queries/*.ts`) pass `session.userId` from `useAuth()`; or
- Cache the current `authSession` (the raw supabase `Session`, not the app `Session`) in a module-level variable inside `src/data/client/supabase/client.ts`, updated once via a single `onAuthStateChange` subscription at module scope (not re-subscribed per call), and read that cached value synchronously instead of calling `supabase.auth.getSession()` on every write.

**Option B (simplest, DB-side):** Give the relevant columns (`created_by`, `uploaded_by`, `sender_id`, `tenant_id` where applicable) a default of `auth.uid()` in Postgres and drop them from the client-side insert payload entirely, e.g.:
```sql
alter table requests alter column tenant_id set default auth.uid();
alter table messages alter column sender_id set default auth.uid();
alter table request_timeline_events alter column actor_id set default auth.uid();
-- etc. for announcements.created_by, ipc_entries.created_by, ipc_attachments.uploaded_by,
-- risk_photos.uploaded_by, notifications recipient handling, etc.
```
Then remove every `const { data: sd } = await supabase.auth.getSession(); ... sd.session?.user.id ...` block from `src/data/client/supabase/index.ts` and simply omit that field from the insert payload (or explicitly not set it) so Postgres fills it via the column default.

Do this cleanup **after** Bug #1 and #2 are fixed and verified, since it's a correctness/performance improvement, not the cause of the hang itself — but it meaningfully reduces the app's exposure to the underlying `auth-js` lock architecture.

---

## BUG #5 — `.single()` used without handling the "no row" / "multiple rows" case gracefully

### Where
Many call sites in `src/data/client/supabase/index.ts`, e.g. `properties.get`, `requests.get`, `preferences.get`, `technicians`-lookup in `getSupabaseSession`/`buildSessionFromAuthSession`, etc. — anywhere `.single()` is chained.

### What's wrong
Postgrest's `.single()` throws a Postgrest error (`PGRST116`) if the query returns 0 or more than 1 rows. This is not a hang, but combined with Bug #1 it can *look* like a hang from the user's perspective in one specific case: in `buildSessionFromAuthSession`, if a user's `profiles` row doesn't exist yet (e.g. the DB trigger that creates a profile on signup hasn't run, or the row was deleted), `.single()` throws, `getSupabaseSession()`/`buildSessionFromAuthSession` rejects, and depending on how the caller handles it, the user may see a generic "Invalid credentials" error or (if the rejection isn't caught somewhere in the chain) an unhandled promise rejection that leaves `loading` stuck `true`.

### Fix
- Verify every `.single()` call has its `error` checked (`M.throwIfError(error)` already does this in most places — good), and that the calling React code (React Query `onError`, or the `try/catch` in `LoginPage.handleSignIn`) always converts the rejection into a visible error state, never leaves `loading` true.
- Specifically double-check the new `buildSessionFromAuthSession` (Bug #1 fix) — if the `profiles` select in it throws instead of returning `{ error }`, wrap it in a `try/catch` that returns `null`, so `onAuthStateChange`'s `.catch(() => cb(null))` (in the fix above) can react to it and stop the spinner instead of leaving `loading` true.

---

## BUG #6 — `authMock.onAuthStateChange` fires its callback synchronously during subscription

### Where
`src/data/client/mock/auth.mock.ts`:
```ts
onAuthStateChange(cb: Listener): () => void {
  listeners.add(cb);
  cb(loadSession()); // fires synchronously, immediately, during subscribe
  return () => listeners.delete(cb);
},
```

### What's wrong
This is not the primary bug (mock mode is not the one deadlocking), but it's an inconsistency with the real Supabase client's behavior (which fires `INITIAL_SESSION` asynchronously) and a minor foot-gun: calling `setState` synchronously from inside a `useEffect` body (via the subscribe call in `AuthProvider`) during React's commit phase is technically allowed but relies on React batching to avoid extra renders; it also means the mock and supabase code paths behave subtly differently in timing, making bugs in one hard to reproduce/verify against the other.

### Fix
Make the mock consistent with real Supabase semantics — fire asynchronously:
```ts
onAuthStateChange(cb: Listener): () => void {
  listeners.add(cb);
  queueMicrotask(() => cb(loadSession()));
  return () => listeners.delete(cb);
},
```
This also makes `VITE_DATA_SOURCE=mock` a more faithful testbed for catching auth-timing bugs like Bug #1/#2 before they reach the Supabase path.

---

## BUG #7 (lower priority, correctness/cleanup, not the cause of the hang) — dead/duplicate legacy state architecture

### Where
`src/store/StoreContext.tsx` + `src/data/mockData.ts` (`initialState`, the `reducer`, `localStorage` key `mdrar-state-v4`) is wired into `App.tsx` (`<StoreProvider>`) alongside the newer `dataSource` + React Query architecture (`src/data/client/*`, `src/queries/*`).

### What's wrong
This looks like a legacy, pre-refactor global store that predates the `DataSource`/React Query rewrite. It's still mounted at the root (`App.tsx` wraps everything in `<StoreProvider>`), loads/parses a separate `localStorage` blob on every load, and maintains its own copy of requests/projects/notifications/etc. that is **not** kept in sync with the real `dataSource` (mock or Supabase). If any component still reads from `useStore()` instead of the React Query hooks, it will show stale/wrong data, and if two different local-storage-backed sources of truth (`mdrar-state-v4` vs the mock DB's own persisted keys in `src/data/client/mock/db.ts`) ever diverge, that's a confusing, hard-to-debug source of "the page shows the wrong thing" bugs that can look like the app "getting stuck" on stale data.

### Fix
1. Grep the codebase for `useStore(` / `from '@/store/StoreContext'` usage outside `StoreContext.tsx` itself.
2. If nothing outside legacy/unused code imports it, delete `src/store/StoreContext.tsx`, remove `<StoreProvider>` from `App.tsx`, and remove the now-unused `initialState`/`AppState`/`Action` exports from `src/data/mockData.ts` if they're not used elsewhere.
3. If something does still use it, migrate that one remaining consumer to the `dataSource`/React Query pattern used everywhere else, then delete the legacy store.

This is not urgent relative to Bugs #1–#3, but should be cleaned up in the same pass since it's actively confusing and bloats the bundle.

---

## Verification checklist (after applying fixes #1–#3 at minimum)

1. Set `VITE_DATA_SOURCE=supabase` with real `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` in `.env.local`.
2. Hard-refresh the app (cold load) 5+ times in a row in dev (`npm run dev`, Strict Mode is on) and confirm the login screen (or redirect to a role's home) appears promptly every single time — no infinite spinner.
3. Sign in with each seed role (`khalid@mdrar.sa`, `m.alotaibi@example.com`, `pm@mdrar.sa`, `salem@mdrar.sa`, all password `password` per `LoginPage.tsx`'s `HINTS`) and confirm the "Signing in..." button always resolves (success or a visible error), never hangs.
4. Navigate across several protected routes in a row (`/management`, `/management/requests`, `/pm/dashboard`, `/tenant`, etc.) rapidly, including using the browser back/forward buttons, and confirm none of them show a stuck spinner.
5. Open two browser tabs signed in as the same user, sign out in one, and confirm the other tab's `onAuthStateChange` handler updates without hanging (this exercises the callback path directly).
6. Throttle the network (Chrome DevTools "Slow 3G") and repeat steps 2–4 — confirm the app still resolves to a definite state (signed in, signed out, or a visible error) rather than hanging, and that the Bug #3 timeout/reload affordance appears if something is still genuinely slow.
7. Run `npm run typecheck` and `npm run test` and confirm both are clean after the refactor.
8. Search the whole repo one more time for `supabase.auth.` inside any function passed to `onAuthStateChange` — there should be **zero** matches after the fix. (`grep -rn "onAuthStateChange" -A 10 src/` and manually check each match.)
