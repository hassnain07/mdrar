# MDRAR Portal — Follow-up Report #3 (new features + more bugs)

**Audience:** coding agent. Builds on `BUGFIX_INSTRUCTIONS.md` and `BUGFIX_INSTRUCTIONS_PART2.md` — apply those first. This covers 5 more items: 2 are outright bugs (hardcoded fake data), 3 are new features to design and build (account auto-provisioning, a resident profile/security page, and a proper messaging inbox). Read fully before starting — items #2, #4 and #5 touch the same files.

---

## ISSUE #1 — Resident dashboard shows fake/hardcoded data, not the tenant's real property

### Root cause
`src/pages/tenant/TenantHome.tsx` never fetches the tenant's actual property. The property card and unit card are **literally hardcoded**:
```tsx
<p className="font-serif font-semibold text-navy-800">{isRtl ? 'ساحة جازلي' : 'Jazly Plaza'}</p>
...
<MapPin className="w-3 h-3" />
{isRtl ? 'حي الملقا، الرياض' : 'Al-Malqa, Riyadh'}
...
<p className="font-serif font-semibold text-navy-800">{session?.tenantUnit ?? 'A-204'}</p>
```
Every tenant, regardless of which property/unit they actually belong to, sees "Jazly Plaza / Al-Malqa, Riyadh" unless `session.tenantUnit` happens to be set (only the unit number falls back to real data; the property name/location never do). The same pattern (hardcoded "Riyadh") exists in `src/pages/tenant/TenantProfile.tsx`:
```tsx
<MapPin className="w-4 h-4 text-stone-400" />
<span className="text-sm text-navy-700">{isRtl ? 'الرياض' : 'Riyadh'}</span>
```

The app already has everything needed to show the real property — `useProperty(id)` from `src/queries/useProperties.ts` — it's just never called from either tenant page.

### Fix
In both `TenantHome.tsx` and `TenantProfile.tsx`:
```tsx
import { useProperty } from '@/queries/useProperties';
...
const { data: property } = useProperty(session?.tenantPropertyId ?? '');
```
Then replace the hardcoded blocks:
```tsx
<p className="font-serif font-semibold text-navy-800">
  {property ? (isRtl ? property.name : property.nameEn) : '—'}
</p>
<p className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">
  <MapPin className="w-3 h-3" />
  {property?.location ?? ''}
</p>
...
<p className="font-serif font-semibold text-navy-800">{session?.tenantUnit ?? '—'}</p>
```
Drop the `?? 'A-204'` fallback too — falling back to a fake unit number is just as misleading as the fake property name; show a neutral placeholder if `tenantUnit` is genuinely missing, since that itself indicates the tenant's profile/lease link wasn't set up correctly (see Issue #2).

Also remove the hardcoded "Second floor" label under the unit card in `TenantHome.tsx` — there's no floor data modeled anywhere in the schema for it to come from; either drop the line or, if a floor is actually wanted, add a real field to `leases`/units and source it from there instead of a static string.

### Verification
Sign in as each of the two seed tenant accounts (`m.alotaibi@example.com`, `sarah.j@example.com`) and confirm the dashboard shows *different* property names/locations matching their actual `tenantPropertyId`, not both showing "Jazly Plaza".

---

## ISSUE #2 — Occupying a unit with an email should create that resident's login account (password `123456`)

### Current state
`src/pages/management/PropertyDetail.tsx`'s `handleOccupy()` only writes to the `leases` table/`db.fmUnits` (tenant name, email, rent, lease dates) — it never creates any kind of login account. There is currently no way for a newly-occupied tenant to sign in at all; the seed tenant accounts in `authMock`/Supabase are the only ones that exist.

### Why this can't be done directly from the browser
Creating a real login (a Supabase Auth user with a set password) requires the **Admin API** (`supabase.auth.admin.createUser(...)`), which needs the **service role key**. That key must never be shipped to the browser — anyone could read it from the compiled JS bundle and take over the entire project (bypassing every RLS policy). This has to run **server-side**, via a Supabase Edge Function. This isn't a new pattern for this codebase — `src/data/client/supabase/index.ts`'s `users.create()` already anticipates this:
```ts
async create() {
  throw { code: 'VALIDATION', message: 'Create users via Settings → Invite User (uses the invite-user Edge Function).' };
},
```
...except that Edge Function doesn't actually exist yet in this repo (`supabase/functions/` doesn't exist). You'll need to create it now, and reuse the same function for both "Invite User" (management/staff accounts) and this new "auto-provision resident on occupy" flow, since both need the identical privileged operation (create an auth user + a matching `profiles` row).

### Design

**1. Create `supabase/functions/provision-user/index.ts`** (Deno Edge Function), something like:
```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  // Verify the caller is an authenticated management user before doing anything privileged.
  const authHeader = req.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader ?? '' } },
  });
  const { data: { user: caller } } = await callerClient.auth.getUser();
  if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const { data: callerProfile } = await callerClient.from('profiles').select('role').eq('id', caller.id).single();
  const allowedRoles = ['super_admin', 'facility_manager', 'owner'];
  if (!callerProfile || !allowedRoles.includes(callerProfile.role)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const body = await req.json();
  const { email, fullName, role, password, tenantPropertyId, tenantUnit, leaseId } = body;
  if (!email || !role) return new Response(JSON.stringify({ error: 'email and role are required' }), { status: 400 });

  const admin = createClient(supabaseUrl, serviceKey);

  // Reuse an existing account if this email is already registered (e.g. the
  // same person renting a second unit, or re-occupying after a vacancy).
  const { data: existing } = await admin.auth.admin.listUsers();
  let userId = existing.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;

  if (!userId) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: password ?? '123456',
      email_confirm: true, // activate immediately, no confirmation email required
    });
    if (createErr) return new Response(JSON.stringify({ error: createErr.message }), { status: 400 });
    userId = created.user.id;
  }

  const { error: upsertErr } = await admin.from('profiles').upsert({
    id: userId,
    full_name: fullName ?? email,
    email,
    role,
    tenant_property_id: tenantPropertyId ?? null,
    tenant_unit: tenantUnit ?? null,
  });
  if (upsertErr) return new Response(JSON.stringify({ error: upsertErr.message }), { status: 400 });

  if (leaseId) {
    await admin.from('leases').update({ tenant_id: userId }).eq('id', leaseId);
  }

  return new Response(JSON.stringify({ userId }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
```
Adjust to match your actual `profiles` columns exactly (check the migration for the full column list before finalizing this). Deploy with `supabase functions deploy provision-user` and set the required secrets (`SUPABASE_SERVICE_ROLE_KEY`, etc. — most are auto-injected by the platform; check current Supabase CLI docs since these conventions can change).

**2. Call it from the client.** Add to `src/data/client/supabase/index.ts` a thin wrapper:
```ts
async function provisionUser(input: { email: string; fullName: string; role: string; tenantPropertyId?: string; tenantUnit?: string; leaseId?: string }) {
  const { data, error } = await supabase.functions.invoke('provision-user', { body: input });
  if (error) throw { code: 'VALIDATION', message: error.message };
  return data as { userId: string };
}
```
Expose it on the `DataSource` interface, e.g. `dataSource.users.provisionTenant(input)`.

**3. Wire it into `handleOccupy` in `PropertyDetail.tsx`.** When an email is entered, provision the account *before* updating the lease, then link the new `userId` back onto the lease:
```tsx
const handleOccupy = async () => {
  if (!occupyingUnit || !occupyTenant.trim()) return;
  let tenantId: string | undefined;
  if (occupyEmail.trim()) {
    try {
      const { userId } = await dataSource.users.provisionTenant({
        email: occupyEmail.trim(),
        fullName: occupyTenant.trim(),
        role: 'tenant',
        tenantPropertyId: property.id,
        tenantUnit: occupyingUnit.label,
        leaseId: occupyingUnit.id,
      });
      tenantId = userId;
    } catch (err) {
      showToast(isRtl ? 'تعذر إنشاء حساب المستأجر' : 'Could not create the resident account', 'error');
      return; // don't half-complete the occupy if account creation failed
    }
  }
  updateLease.mutate(
    { id: occupyingUnit.id, changes: {
      status: 'occupied', tenant: occupyTenant.trim(),
      tenantEmail: occupyEmail.trim() || undefined,
      tenantId,
      rent: occupyRent ? Number(occupyRent) : undefined,
      leaseStart: occupyLeaseStart || undefined,
      leaseEnd: occupyLeaseEnd || undefined,
    }},
    { onSuccess: () => { setOccupyingUnit(null); resetOccupyForm(); showToast(isRtl ? 'تم تسجيل الإشغال وإنشاء حساب المستأجر' : 'Unit occupied and resident account created'); } }
  );
};
```
(`LeaseInput`/the `leases` update type already has an optional `tenantId` field — see `src/data/client/dataSource.ts` — so no interface change needed there.)

**4. Tell the resident their password somewhere.** Make clear to the person doing the occupying that the account's password is `123456` and that the resident should change it on first login (tie this to Issue #3's password-change screen) — e.g. a note in the "Confirm Occupancy" modal: *"A resident account will be created for this email with a temporary password of 123456. Ask them to change it after their first sign-in."* Don't silently create a password nobody is told about.

**5. Mock mode.** `SEED_USERS` in `src/data/client/mock/auth.mock.ts` is currently a hardcoded, static array — it has no way to register new users at runtime. Change it to a mutable, persisted list (mirroring the `db.ts` pattern used elsewhere):
- Move `SEED_USERS` (or a copy of it) into `db.ts` as `db.users` (persisted to `localStorage` like everything else there), seeded once from the current hardcoded array.
- Add `authMock.createUser({ email, password, name, role, tenantPropertyId, tenantUnit })` that appends to `db.users` (if the email doesn't already exist) and persists it.
- Change `signInWithPassword` to search `db.users` instead of the static `SEED_USERS` constant.
- In `src/data/client/mock/leases.mock.ts`, have wherever "occupy" happens call `authMock.createUser(...)` with password `'123456'` when an email is supplied and stamp the resulting mock `userId` onto the `FmUnit`'s `tenantId` field the same way the Supabase path does.

### Security notes for the agent
- Never call `supabase.auth.admin.*` from browser code — only from the Edge Function, using `SUPABASE_SERVICE_ROLE_KEY`, which must only ever exist as a server-side secret (Edge Function env var), never in `.env.local`/`VITE_*` variables or any file that ships to the client.
- The Edge Function must check the caller's role itself (as shown above) — don't rely on the frontend button being hidden from non-managers, since Edge Functions are public HTTP endpoints once deployed.
- `123456` is a very weak default password. Since this is presumably intentional for onboarding simplicity, make sure Issue #3's "change password" screen exists and works before shipping this, and consider prompting the resident to change it on first login (e.g., a one-time banner, or a `must_change_password` flag on `profiles` that a wrapper checks and redirects to the change-password screen until cleared).

### Verification
- As management, occupy a vacant unit with a brand-new email address and confirm: (a) the unit shows occupied with that tenant's name, (b) you can immediately sign in as that email with password `123456` and land on the resident dashboard for the correct property/unit.
- Occupy a second unit using an email that's already registered and confirm it reuses the existing account rather than erroring or creating a duplicate.

---

## ISSUE #3 — Resident portal needs a "change password" + "view my information" screen

### Current state
`src/pages/tenant/TenantProfile.tsx` only displays name/email/unit (with a hardcoded location, per Issue #1) and a logout button — no editing, no password change. `src/pages/tenant/TenantSettings.tsx` has notification toggles, language, and an emergency-contact card, but nothing account/security related either.

### Fix
**1. Add a password-update method to the data layer.** `src/data/client/dataSource.ts`'s `auth` interface needs a new method:
```ts
auth: {
  getSession(): Promise<Session | null>;
  signInWithPassword(email: string, password: string): Promise<Session>;
  signOut(): Promise<void>;
  onAuthStateChange(cb: (session: Session | null) => void): () => void;
  updatePassword(newPassword: string): Promise<void>; // add this
};
```
Supabase implementation (`src/data/client/supabase/index.ts`):
```ts
async updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw { code: 'VALIDATION', message: error.message };
},
```
Mock implementation (`src/data/client/mock/auth.mock.ts`) — update the matching entry in the (now-persisted, per Issue #2) users list:
```ts
async updatePassword(newPassword: string): Promise<void> {
  await simulate();
  const session = loadSession();
  if (!session) throw { code: 'UNAUTHORIZED', message: 'Not signed in' };
  const user = db.users.find((u) => u.email.toLowerCase() === session.email.toLowerCase());
  if (user) { user.password = newPassword; persist.users(); }
},
```
Expose it from `AuthProvider` (`src/auth/AuthProvider.tsx`) as `updatePassword` on the context value, alongside `signIn`/`signOut`.

**2. Build the UI.** Add a "Security" card to `src/pages/tenant/TenantSettings.tsx` (fits naturally next to the existing settings toggles):
```tsx
function ChangePasswordCard() {
  const { t } = useTranslation();
  const { updatePassword } = useAuth();
  const showToast = useToast();
  const { ui } = useUi();
  const isRtl = ui.language === 'ar';
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (next.length < 6) { setError(isRtl ? 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل' : 'Password must be at least 6 characters'); return; }
    if (next !== confirm) { setError(isRtl ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match'); return; }
    setSaving(true);
    try {
      await updatePassword(next);
      showToast(isRtl ? 'تم تحديث كلمة المرور' : 'Password updated');
      setNext(''); setConfirm('');
    } catch (err) {
      setError((err as { message?: string })?.message ?? (isRtl ? 'تعذر تحديث كلمة المرور' : 'Could not update password'));
    } finally {
      setSaving(false);
    }
  };

  // Note: Supabase's updateUser({ password }) does not require re-entering the
  // current password when called with an active session, so there is no
  // "current password" field here. If you want an actual current-password
  // check, re-authenticate first via signInWithPassword(session.email, current)
  // before calling updatePassword, and add that field back in deliberately.

  return (
    <Card>
      <CardBody>
        <CardTitle className="mb-4">{isRtl ? 'تغيير كلمة المرور' : 'Change Password'}</CardTitle>
        <div className="space-y-3">
          <input type="password" className="form-input" placeholder={isRtl ? 'كلمة المرور الجديدة' : 'New password'} value={next} onChange={(e) => setNext(e.target.value)} />
          <input type="password" className="form-input" placeholder={isRtl ? 'تأكيد كلمة المرور' : 'Confirm password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <p className="text-sm text-danger-600">{error}</p>}
          <Button onClick={handleSubmit} disabled={saving || !next || !confirm}>{saving ? '...' : (isRtl ? 'تحديث' : 'Update')}</Button>
        </div>
      </CardBody>
    </Card>
  );
}
```

**3. Fix "view my information".** Once Issue #1's `useProperty` fix lands, `TenantProfile.tsx` will already show real name/email/unit/property/location. Consider also surfacing lease details (rent, lease start/end) if useful — those are already fetched for management via `useLeases(propertyId)`; you'd need a tenant-scoped equivalent (a small dedicated `dataSource.leases.getMine()` that finds the lease row matching the tenant's `tenant_id = auth.uid()` in Supabase / `tenantId === session.userId` in mock). Not required to satisfy "view your information" at a basic level (name/email/unit/property already covers it), but worth doing if the person wants their lease terms visible too — confirm with them before building it out.

### Verification
- Sign in as a resident, go to Settings, set a new password, sign out, and confirm you can sign back in with the new password (and that the old one no longer works, for the Supabase path).
- Confirm the Profile page shows the resident's real property name, location, and unit (not "Riyadh"/hardcoded values).

---

## ISSUES #4 & #5 — Owner's Messages inbox: wrong time format, no sender identity, no read/unread, not sorted, and message activity never creates a notification

These all live in the same three files (`src/pages/management/ManagementMessages.tsx`, `src/data/client/mock/messages.mock.ts` / `src/data/client/supabase/index.ts`, `src/queries/useShared.ts`), so they're grouped together.

### Bug 4a — No Saudi Arabia time formatting (and mock loses the date entirely)
`src/data/client/mock/messages.mock.ts`:
```ts
const now = new Date();
const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
```
This uses the **visitor's local browser clock and time zone** — whatever machine/browser is running the app — not Saudi Arabia time, and stores only `HH:MM` (no date, no AM/PM), so messages sent on different days are indistinguishable and can't be correctly re-formatted later.

`src/data/client/supabase/mappers.ts`:
```ts
export function mapMessage(r: any): Message {
  return { id: r.id, from: r.sender_role, text: r.text, textEn: r.text_en, time: r.created_at };
}
```
`r.created_at` is a raw Postgres `timestamptz` ISO string (e.g. `2026-09-27T07:32:00+00:00`). `ManagementMessages.tsx` renders `msg.time` directly with no formatting at all, so in Supabase mode the chat would show raw ISO strings instead of a readable time.

**Fix:**
1. Store a real, unambiguous timestamp everywhere. In `messages.mock.ts`, store the full ISO timestamp instead of a truncated local `HH:MM`:
   ```ts
   const message: Message = { ...msg, id: `m-${Date.now()}`, time: new Date().toISOString() };
   ```
2. Add a shared formatting helper (e.g. `src/lib/formatTime.ts`) that both the messages UI and notifications UI use, explicitly pinned to Saudi Arabia's time zone regardless of the visitor's own device/browser locale:
   ```ts
   export function formatRiyadhTime(iso: string, isRtl: boolean): string {
     return new Date(iso).toLocaleTimeString(isRtl ? 'ar-SA' : 'en-SA', {
       timeZone: 'Asia/Riyadh',
       hour: '2-digit',
       minute: '2-digit',
       hour12: true,
     });
   }
   export function formatRiyadhDateTime(iso: string, isRtl: boolean): string {
     return new Date(iso).toLocaleString(isRtl ? 'ar-SA' : 'en-SA', {
       timeZone: 'Asia/Riyadh',
       day: 'numeric', month: 'short', year: 'numeric',
       hour: '2-digit', minute: '2-digit', hour12: true,
     });
   }
   ```
   The key fix versus the existing (already-attempted) formatting in `src/data/client/mock/notifications.mock.ts` (`new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })`) is the **explicit `timeZone: 'Asia/Riyadh'`**. Passing an `'ar-SA'` locale only changes number/script formatting (e.g. Arabic-Indic digits, ص/م for AM/PM) — it does **not** change which time zone the clock reading is interpreted in. Without `timeZone` set explicitly, a manager or resident whose device isn't set to Saudi time will see the wrong hour. Apply this same fix to `notifications.mock.ts`'s `makeNotif` too.
3. Update `ManagementMessages.tsx`'s `ChatPane` to use `formatRiyadhTime(msg.time, isRtl)` instead of raw `{msg.time}`.

### Bug 4b — Thread list shows the raw threadId/email instead of the person's name, role, and unit
`src/pages/management/ManagementMessages.tsx`:
```tsx
function displayName(threadId: string): string {
  return threadId.replace(/^mock-/, '');
}
```
This just strips the mock prefix and shows the raw email or user id — never the resident's actual name, role, or unit. Fix by resolving `threadId` (the tenant's user id) to a real profile.

**Supabase:** extend `listThreads()` to join `profiles`/`properties`:
```ts
async listThreads() {
  const { data, error } = await supabase.from('messages').select('*').order('created_at');
  M.throwIfError(error);
  const byThread = new Map<string, any[]>();
  (data ?? []).forEach((m) => {
    if (!byThread.has(m.thread_id)) byThread.set(m.thread_id, []);
    byThread.get(m.thread_id)!.push(m);
  });
  const threadIds = Array.from(byThread.keys());
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, role, tenant_property_id, tenant_unit')
    .in('id', threadIds);
  const { data: properties } = await supabase.from('properties').select('id, name, name_en');
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const propertyMap = new Map((properties ?? []).map((p) => [p.id, p]));

  return threadIds
    .map((threadId) => {
      const messages = byThread.get(threadId)!.map(M.mapMessage);
      const profile = profileMap.get(threadId);
      const property = profile?.tenant_property_id ? propertyMap.get(profile.tenant_property_id) : undefined;
      return {
        threadId,
        messages,
        participant: profile ? {
          name: profile.full_name,
          role: profile.role,
          unit: profile.tenant_unit ?? undefined,
          propertyName: property?.name_en ?? undefined,
        } : undefined,
        lastMessageAt: messages[messages.length - 1]?.time,
      };
    })
    .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '')); // latest first — see Bug 4d
},
```
Extend the threads-list return type (currently `{ threadId: string; messages: Message[] }[]`) to include this new optional `participant` field in `src/data/client/dataSource.ts`.

**Mock:** `db.users` (per Issue #2's change to make users persisted/lookup-able) already has name/role/tenantPropertyId/tenantUnit per user — resolve `threadId` (`` `mock-${email}` ``) back to an email and look it up:
```ts
async listThreads() {
  await simulate();
  const threads = loadThreads();
  return Object.entries(threads)
    .filter(([, msgs]) => msgs.length > 0)
    .map(([threadId, messages]) => {
      const email = threadId.replace(/^mock-/, '');
      const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      const property = user?.tenantPropertyId ? db.properties.find((p) => p.id === user.tenantPropertyId) : undefined;
      return {
        threadId,
        messages,
        participant: user ? { name: user.name, role: user.role, unit: user.tenantUnit, propertyName: property?.nameEn } : undefined,
        lastMessageAt: messages[messages.length - 1]?.time,
      };
    })
    .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
},
```

**UI (`ManagementMessages.tsx`):** replace `displayName(threadId)` everywhere with the new `participant` data:
```tsx
const roleLabel = (role?: string, isRtl?: boolean) => {
  if (role === 'tenant') return isRtl ? 'مستأجر' : 'Resident';
  if (role === 'facility_manager') return isRtl ? 'مدير المرافق' : 'Facility Manager';
  // ...map the rest of your ManagementRole values as needed
  return role ?? '';
};

// in the thread list item and in ChatPane's header:
<p className="font-medium text-navy-800 text-sm">{thread.participant?.name ?? thread.threadId}</p>
<p className="text-xs text-stone-400">
  {roleLabel(thread.participant?.role, isRtl)}
  {thread.participant?.role === 'tenant' && thread.participant.unit ? ` · ${isRtl ? 'وحدة' : 'Unit'} ${thread.participant.unit}` : ''}
</p>
```

### Bug 4c — "Unread" badge is fake and never resets
```tsx
const unread = messages.filter((m) => m.from === 'tenant').length;
```
This counts *every* tenant message in the thread's entire history, forever — it's not tracking read/unread state at all. The good news: the DB schema already has a `read` column on `messages` (`supabase/migrations/20250101000000_full_schema.sql`) — it's just never used by the application code.

**Fix:**
1. **Type:** add `read: boolean` to `Message` in `src/types.ts` (or two flags — see step 3).
2. **Supabase mapper (`mappers.ts`):** `return { id: r.id, from: r.sender_role, text: r.text, textEn: r.text_en, time: r.created_at, read: r.read };`
3. **Consider splitting into two flags.** A single shared `read` column can't correctly represent "read by the manager but still unread by the tenant" and vice versa. Recommend a small migration adding `read_by_manager boolean not null default false` and `read_by_tenant boolean not null default false` to `messages`, replacing the single `read` column, and setting whichever side sent the message to "read" for themselves at insert time.
4. **Add a "mark thread read" mutation.** New `dataSource.messages.markThreadRead(threadId)`:
   - Supabase: `update messages set read_by_manager = true where thread_id = $1 and sender_role = 'tenant' and read_by_manager = false` (management marking a tenant's messages read) — call it when `ChatPane` mounts / `activeThread` changes.
   - Mock: same idea over the persisted thread messages.
5. **`useShared.ts`:** add `useMarkThreadRead()` mirroring `useMarkNotificationsRead()`, and call it in `ChatPane`'s `useEffect` when `threadId` changes.
6. **Unread badge:** compute it from the new field instead of a static filter:
   ```tsx
   const unread = messages.filter((m) => m.from === 'tenant' && !m.readByManager).length;
   ```

### Bug 4d — Threads aren't sorted by most recent activity
Both the mock and Supabase `listThreads()` return threads in whatever order `Object.entries`/`Map` insertion happens to produce (creation order), not by recency. This is fixed above in the Bug 4b code samples via `.sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''))` — make sure that sort is applied in both the mock and Supabase implementations, using the real ISO timestamp from Bug 4a's fix (string comparison of ISO-8601 timestamps sorts correctly chronologically, which is why storing full ISO strings instead of `HH:MM` matters here too, not just for display).

### Bug 5 — Sending a message never creates a notification
Compare `requestsMock.create`/`addTimelineEvent` (which call `notificationsMock.push(...)`/`pushForTenant(...)` on every meaningful event) with `messagesMock.send` and the Supabase `messages.send` — **neither pushes any notification at all.** So neither side ever finds out about a new message except by having the Messages page open and polling (`refetchInterval: 5000`).

**Fix — mock (`messages.mock.ts`):**
```ts
import { notificationsMock } from './notifications.mock';

async send(threadId: string, msg: NewMessage): Promise<Message> {
  await simulate();
  const threads = loadThreads();
  if (!threads[threadId]) threads[threadId] = [];
  const message: Message = { ...msg, id: `m-${Date.now()}`, time: new Date().toISOString() };
  threads[threadId].push(message);
  saveThreads(threads);

  if (msg.from === 'tenant') {
    // Notify management of a new resident message
    void notificationsMock.push({ title: 'New message', body: msg.textEn.slice(0, 60) });
  } else {
    // Notify the resident of management's reply
    const email = threadId.replace(/^mock-/, '');
    void notificationsMock.pushForTenant(email, { title: 'New reply', body: msg.textEn.slice(0, 60) });
  }
  return message;
},
```
Match whatever bilingual title/body pattern `Notification`'s type already uses elsewhere in this file (check the type in `src/types.ts` for `title`/`titleEn`-style fields and follow it, rather than hardcoding English only as shown above).

**Fix — Supabase (`index.ts`):**
```ts
async send(threadId, msg) {
  const { data: sd } = await supabase.auth.getSession();
  const { data, error } = await supabase.from('messages').insert({
    thread_id: threadId, sender_id: sd.session?.user.id ?? null,
    sender_role: msg.from, text: msg.text, text_en: msg.textEn,
  }).select().single();
  M.throwIfError(error);

  if (msg.from === 'tenant') {
    // Notify management — mirror however requests.create() notifies
    // management for a new request (check that implementation's
    // notifications insert and reuse the same recipient pattern here,
    // rather than inventing a new one).
  } else {
    await supabase.from('notifications').insert({
      recipient_id: threadId, title: 'New reply', body: msg.text.slice(0, 60),
    });
  }

  return M.mapMessage(data);
},
```
Check exactly how management-side recipients are modeled for existing request notifications (grep `notifications` inserts in `requests.create`/`addTimelineEvent` in `index.ts`) and mirror that pattern exactly, since it depends on how "management" notifications are currently fanned out (single shared row vs. per-recipient rows) — this report doesn't have enough context to hand you an exact insert for that part.

### Verification (Bugs 4a–5 together)
- Send a message as a tenant → confirm a notification appears for management within a few seconds, and the message's timestamp reads correctly in Saudi time regardless of your test device's own time zone.
- Reply as management → confirm the resident gets a notification, and their unread state clears once they open Messages.
- With two active conversations, send a new message into the older one → confirm it jumps to the top of the thread list.
- Open a thread with unread resident messages → confirm the unread badge shows a real, bounded count (not the entire conversation's tenant-message history) and clears after opening.
- Confirm the thread list and chat header show the resident's real name and "Resident · Unit A-204" instead of a raw email/user id.

---

## Summary of files touched by this report

- `src/pages/tenant/TenantHome.tsx`, `src/pages/tenant/TenantProfile.tsx` — replace hardcoded property/location with `useProperty` (Issue 1).
- `supabase/functions/provision-user/index.ts` (new) — Edge Function to create tenant (and staff) accounts (Issue 2).
- `src/data/client/supabase/index.ts`, `src/data/client/dataSource.ts` — add `users.provisionTenant`/`auth.updatePassword` (Issues 2, 3).
- `src/pages/management/PropertyDetail.tsx` — call provisioning from `handleOccupy` (Issue 2).
- `src/data/client/mock/auth.mock.ts`, `src/data/client/mock/db.ts`, `src/data/client/mock/leases.mock.ts` — make mock users persisted/mutable, add `createUser`/`updatePassword` (Issues 2, 3).
- `src/auth/AuthProvider.tsx` — expose `updatePassword` (Issue 3).
- `src/pages/tenant/TenantSettings.tsx` — add the Change Password card (Issue 3).
- `src/lib/formatTime.ts` (new) — shared Asia/Riyadh time formatting helper (Issue 4a).
- `src/data/client/mock/messages.mock.ts`, `src/data/client/supabase/mappers.ts`, `src/data/client/supabase/index.ts` — store real ISO timestamps, add `participant` info and sorting to `listThreads`, add read/unread fields and a mark-read mutation, push notifications on send (Issues 4, 5).
- `src/data/client/mock/notifications.mock.ts` — fix the timezone bug in `makeNotif` too (Issue 4a).
- `src/types.ts`, `src/data/client/dataSource.ts` — extend `Message` with read flags, extend the threads-list return type with `participant` (Issues 4, 5).
- `src/queries/useShared.ts` — add `useMarkThreadRead` (Issue 5).
- `src/pages/management/ManagementMessages.tsx` — use real participant info, formatted time, and real unread counts (Issues 4, 5).
- `supabase/migrations/` — new migration adding `messages.read_by_manager`/`read_by_tenant` columns (Issue 5).
