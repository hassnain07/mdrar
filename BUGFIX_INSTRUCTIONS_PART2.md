# MDRAR Portal — Follow-up Bug Report #2

**Audience:** coding agent. This is a follow-up to `BUGFIX_INSTRUCTIONS.md` (the sign-in/page-hang deadlock report). That report is still valid and should be applied first/alongside this one — the "unauthorized" symptom below is a *different* bug that can also make the deadlock's symptoms look worse, but it reproduces independently of it.

Four separate issues are covered here, each with a confirmed root cause found directly in the code (not guesses):

1. Sign-out redirects to the wrong place, and re-logging in afterward lands on "Unauthorized".
2. Resident (tenant) dashboard shows "Error loading the page".
3. Project Management charts show wrong/empty data.
4. Property occupancy numbers on property cards never reflect the real Units & Leases data.

---

## ISSUE #1 — Sign out lands you on the 4-portal picker, then re-login says "Unauthorized"

### Root cause A — the login redirect loses which portal you were headed to

`src/auth/ProtectedRoute.tsx`:
```tsx
if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
```
This only remembers the *path* you were trying to reach (`from`), never *which portal* it belonged to. `src/pages/LoginPage.tsx` reads a `portal` value out of that same `location.state` to decide whether to show one portal's mini sign-in form or the full 4-card picker:
```tsx
const locationState = location.state as { from?: { pathname: string }; portal?: Portal } | null;
const incomingPortal = locationState?.portal ?? null;
```
Since `ProtectedRoute`/`RequireRole` never set `portal`, **every** redirect-to-login caused by visiting a protected URL while signed out (which is exactly what happens right after you sign out and then click into another portal, or reload a portal URL) always lands you on the generic 4-card chooser — never the specific portal you were just using. That's the "page with 4 tabs" you're seeing instead of "home".

### Root cause B — signing in from that picker can send you to a route you're not allowed to see

`src/pages/LoginPage.tsx`:
```tsx
const handleSignIn = async (e: React.FormEvent) => {
  ...
  const s = await signIn(email, password);
  const dest = from ?? ROLE_DEST[s.role] ?? '/';
  navigate(dest, { replace: true });
  ...
};
```
`from` (the page you were originally trying to reach, e.g. `/management`) is used **unconditionally** ahead of the role-based default, even if the account you just logged in with belongs to a completely different portal. Sequence that reproduces your exact symptom:

1. You're signed out (or your session lapses) while a `/management/...` URL is open, or you navigate to a management URL after signing out. `RequireRole` bounces you to `/login` with `state.from.pathname = '/management/...'`.
2. Because of Root Cause A, you land on the generic 4-portal picker (not the management mini-form).
3. You pick a *different* portal from the picker — say Tenant — and sign in successfully as a tenant.
4. `handleSignIn` computes `dest = from` = `/management/...` (wrong!) instead of `ROLE_DEST['tenant']` = `/tenant`.
5. `navigate('/management/...')` runs, `RequireRole(['management'])` sees a `tenant` session and rejects it → redirected to `/unauthorized`, which is exactly the page with the "Sign Out" button you described.

This is fully reproducible with the code as written and doesn't depend on the Supabase deadlock at all — it will happen the same way in mock mode.

### Fix
**1. Only trust `from` when it's compatible with the role that actually just signed in.** In `src/pages/LoginPage.tsx`:
```tsx
const PORTAL_PREFIX: Record<string, string> = {
  management: '/management',
  tenant: '/tenant',
  pm_manager: '/pm',
  pm_viewer: '/pm',
  technician: '/technician',
};

const handleSignIn = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  setLoading(true);
  try {
    const s = await signIn(email, password);
    const roleHome = ROLE_DEST[s.role] ?? '/';
    const prefix = PORTAL_PREFIX[s.role];
    // Only honor the "from" redirect if it's under the same portal as the
    // role the person actually just authenticated as — otherwise a
    // leftover redirect target from a different portal attempt would send
    // a correctly-authenticated user straight into a page they're not
    // allowed to see.
    const dest = (from && prefix && from.startsWith(prefix)) ? from : roleHome;
    navigate(dest, { replace: true });
  } catch (err: unknown) {
    const e = err as { message?: string };
    setError(e?.message ?? (isRtl ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials'));
  } finally {
    setLoading(false);
  }
};
```

**2. (UX improvement, optional but recommended) Preserve which portal the person was trying to reach**, so they land on that portal's mini sign-in form instead of the generic picker when their session lapses mid-use. In `src/auth/ProtectedRoute.tsx`, derive a `portal` guess from the current path and pass it along:
```tsx
function portalFromPath(pathname: string): 'management' | 'tenant' | 'pm' | 'technician' | null {
  if (pathname.startsWith('/management')) return 'management';
  if (pathname.startsWith('/tenant')) return 'tenant';
  if (pathname.startsWith('/pm')) return 'pm';
  if (pathname.startsWith('/technician')) return 'technician';
  return null;
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AuthLoading />;
  if (!session) {
    return <Navigate to="/login" state={{ from: location, portal: portalFromPath(location.pathname) }} replace />;
  }
  return <>{children}</>;
}
```
Apply the same change to `RequireRole`. This makes "your session lapsed on the Management portal, please sign back in" show the Management mini-form again instead of dumping the person back to square one.

**3. Clear the React Query cache on sign-in and sign-out.** `src/App.tsx` creates a single `QueryClient` for the whole app lifetime, and nothing ever calls `queryClient.clear()`/`removeQueries()` when the signed-in user changes. If a management user signs out and a tenant signs in on the same tab (or the same browser is later reused by a different demo account, which is very likely while testing with the seed accounts), stale cached data (property lists, request lists, etc. — most of which aren't keyed by user id) can leak across sessions. Fix:
- In `src/auth/AuthProvider.tsx`, accept the `queryClient` (via `useQueryClient()`) and call `queryClient.clear()` inside `signOut()` right after `dataSource.auth.signOut()`, and also right before `setSession(s)` inside `signIn()` (clear the *previous* user's cache before the new one starts fetching).

### Verification
- Sign in as management, navigate around, sign out → confirm you land on the actual home ("/", the 2-card Suite Hub), not a portal picker.
- While signed out, type a management URL directly (e.g. `/management/requests`) → confirm you're taken to a login form, and after signing in with the **tenant** demo account, you land on `/tenant` (not `/unauthorized`, not `/management/requests`).
- Repeat, but this time sign in with the **management** account after being redirected from `/management/requests` → confirm you land back on `/management/requests` (the "from" preservation still works when the roles do match).

---

## ISSUE #2 — Resident (tenant) dashboard shows "Error loading the page"

### Root cause
`src/pages/tenant/TenantHome.tsx`:
```tsx
const { data: requestsResult, isLoading, isError, refetch } = useRequestList(
  session?.tenantPropertyId ? { tenantId: session.email } : undefined,
);
```
This passes **`session.email`** as the `tenantId` filter. Compare with `src/pages/tenant/MyRequests.tsx`, which does it correctly:
```tsx
const { data, isLoading, isError, refetch } = useRequestList({ tenantId: session?.userId });
```

In `src/data/client/supabase/index.ts`, the `tenantId` filter is applied as:
```ts
if (filters?.tenantId) q = q.eq('tenant_id', filters.tenantId);
```
`requests.tenant_id` is a `uuid` column (foreign key to `profiles.id`, enforced by RLS as `tenant_id = auth.uid()` — see `supabase/migrations/20250101000000_full_schema.sql`). Passing an email string (`'m.alotaibi@example.com'`) into a `.eq()` against a `uuid` column makes PostgREST/Postgres reject the query with an `invalid input syntax for type uuid` error. That error propagates up through `M.throwIfError(error)`, the React Query call rejects, `isError` becomes `true`, and `TenantHome` renders:
```tsx
if (isError) return <PageError message={t('errorLoading')} onRetry={() => void refetch()} />;
```
— exactly the "Error loading the page" you're seeing. This only breaks in Supabase mode; it happens to "work" (return the right data) in mock mode purely by coincidence, described next.

### A second, related inconsistency to fix at the same time
`src/data/client/mock/requests.mock.ts` interprets the *same* `tenantId` filter completely differently:
```ts
if (filters?.tenantId) data = data.filter((r) => r.tenantEmail === filters.tenantId);
```
It matches against **email**, not a user id. So:
- `TenantHome.tsx` (passing `session.email`) happens to work in **mock** mode, but breaks in **Supabase** mode (as diagnosed above).
- `MyRequests.tsx` (passing `session.userId`, which in mock mode is a synthetic value like `mock-m.alotaibi@example.com`, not a real email) is actually **broken in mock mode** — it will silently return an empty list, since `r.tenantEmail === 'mock-m.alotaibi@example.com'` never matches a real email like `'m.alotaibi@example.com'`. It happens to work correctly in Supabase mode.

In short: neither call site is correct against both data sources today; they just happen to each work against one of the two by accident. This needs to be standardized, or it will keep resurfacing as you switch between mock/Supabase testing.

### Fix
**1. Standardize on the real user id (`session.userId`) as what `tenantId` means everywhere** — it's the correct, secure identifier and matches the real database column.

**2. Fix `TenantHome.tsx`:**
```tsx
const { data: requestsResult, isLoading, isError, refetch } = useRequestList(
  session?.userId ? { tenantId: session.userId } : undefined,
);
```

**3. Fix the mock adapter to match the same semantics.** The mock `Request` type only stores `tenantEmail` today (`src/types.ts` has no `tenantId` field on `Request`), so `requestsMock.list` can't currently filter by a real id. Two ways to fix, pick one:
- **(a) Recommended — add a real `tenantId` to mock request records.** In `src/data/client/mock/db.ts`, wherever seed `Request` rows are constructed, add a `tenantId` field built the same way `authMock` builds `Session.userId` (`` `mock-${tenantEmail}` ``), and update `src/types.ts`'s `Request` interface to include an optional `tenantId?: string`. Then change `requests.mock.ts`:
  ```ts
  if (filters?.tenantId) data = data.filter((r) => r.tenantId === filters.tenantId);
  ```
  Also update `requestsMock.create` to stamp `tenantId` the same way when a tenant submits a new request.
- **(b) Simpler stop-gap** — keep matching on email in the mock adapter, but have `dataSource.auth`'s mock `Session.userId` for tenant accounts literally be their email (instead of `` `mock-${email}` ``) so both adapters can consistently accept "the tenant's id" and mock's "id" and email happen to be the same string. This is less correct conceptually (real Supabase ids are UUIDs, not emails) but requires touching less code. Not recommended for anything beyond a quick unblock.

Go with (a) for correctness.

**4. Re-check every other call site that filters by `tenantId`** (`grep -rn "tenantId:" src/pages src/queries`) after this fix to make sure they all pass `session.userId` consistently.

### Verification
- In Supabase mode, sign in as a tenant (`m.alotaibi@example.com`) and load the dashboard — it should load normally (no "Error loading the page"), showing that tenant's own requests.
- In mock mode, sign in as the same tenant and confirm both the Dashboard *and* "My Requests" show the same, correct set of requests (today, at best only one of the two works correctly in any given mode — after the fix both should agree in both modes).

---

## ISSUE #3 — Project Management portal charts show wrong/empty data

Two independent bugs on the PM Dashboard, plus one on the Executive tab.

### Bug 3a — "Progress by Project" bar chart reads from hardcoded mock data, not your real projects

`src/pages/pm/PmDashboard.tsx`:
```tsx
import { projectActivities } from '@/data/pmMockData';
...
const barData = filtered.map((p) => {
  const acts = projectActivities[p.id] ?? [];
  const total = acts.reduce((s, a) => s + a.duration, 0);
  const done = acts.reduce((s, a) => s + (a.duration * a.percentComplete) / 100, 0);
  return {
    name: isRtl ? p.name : p.nameEn,
    progress: total > 0 ? Math.round((done / total) * 100) : 0,
    status: p.status,
  };
});
```
`projectActivities` is a **static, hardcoded lookup object** exported from `src/data/pmMockData.ts`, keyed by a handful of fixed demo project ids. It has nothing to do with the live activities coming from `dataSource.activities.list(projectId)` (the same data the rest of the app — e.g. `ProjectDetail.tsx` — correctly uses via `useActivityList(id)`). For any real project you create yourself (mock DB with a generated id, or a Supabase project with a UUID), `projectActivities[p.id]` is always `undefined`, so `acts = []`, `total = 0`, and the bar is forced to **0%** regardless of the project's actual progress. This is why the chart looks wrong — it's not reading your data at all.

Contrast with the *correct* pattern already used elsewhere, `src/pages/pm/ProjectDetail.tsx`:
```tsx
const { data: activitiesResult } = useActivityList(id ?? '');
...
const progress = calcProjectProgress(activities); // calcProjectProgress is a pure fn — fine to reuse
```

**Fix:** rewire the dashboard to fetch each listed project's real activities and compute progress the same way `ProjectDetail` does, instead of the static table. Since the dashboard shows many projects at once, use React Query's `useQueries` to fetch them all in parallel:
```tsx
import { useQueries } from '@tanstack/react-query';
import { dataSource } from '@/data/client/index';
import { activityKeys } from '@/queries/useActivities';
import { calcProjectProgress } from '@/data/pmMockData'; // pure function — fine to keep using

// after `filtered` is computed:
const activityQueries = useQueries({
  queries: filtered.map((p) => ({
    queryKey: activityKeys.list(p.id),
    queryFn: () => dataSource.activities.list(p.id),
  })),
});

const barData = filtered.map((p, i) => {
  const acts = activityQueries[i]?.data?.data ?? [];
  return {
    name: isRtl ? p.name : p.nameEn,
    progress: acts.length ? calcProjectProgress(acts) : 0,
    status: p.status,
  };
});
```
This reuses the same query cache key as `useActivityList` (`activityKeys.list`), so if the person has already opened a project's detail page, this dashboard won't even need a fresh network round-trip for it. If the project list can get large, consider instead adding a Postgres view that pre-aggregates per-project progress (similar to `properties_with_stats`) so the dashboard does one query instead of N — worth doing if you have more than ~20 projects, not required for correctness at smaller scale.

### Bug 3b — "Avg Progress" stat card shows the project count, not an average

Same file, a few lines above:
```tsx
const statCards = [
  { icon: Building2, label: t('pm:totalProjects'), value: totalProjects, ... },
  { icon: TrendingUp, label: t('pm:avgProgress'), value: `${totalProjects}`, ... }, // <-- bug
  { icon: CheckCircle2, label: t('pm:projectsOnTrack'), value: onTrack, ... },
  { icon: Home, label: t('pm:totalUnitsPortfolio'), value: totalUnits, ... },
];
```
The card labeled "Average Progress" literally displays `totalProjects` (the same number as the first card) — almost certainly a copy/paste slip. **Fix** (once Bug 3a's `barData` is computed from live data, reuse it here):
```tsx
const avgProgress = barData.length
  ? Math.round(barData.reduce((s, b) => s + b.progress, 0) / barData.length)
  : 0;

const statCards = [
  { icon: Building2, label: t('pm:totalProjects'), value: totalProjects, ... },
  { icon: TrendingUp, label: t('pm:avgProgress'), value: `${avgProgress}%`, ... },
  { icon: CheckCircle2, label: t('pm:projectsOnTrack'), value: onTrack, ... },
  { icon: Home, label: t('pm:totalUnitsPortfolio'), value: totalUnits, ... },
];
```
(Since `statCards` is currently defined before `barData` in the file, move `barData`/`avgProgress` above `statCards`, or reorder as needed.)

### Bug 3c — Executive tab's financial/IPC charts read from a disconnected legacy store

`src/pages/pm/ExecutivePage.tsx`:
```tsx
import { useStore, useToast } from '@/store/StoreContext';
...
const { state } = useStore();
...
// IPC entries — live from store, updates immediately when PM adds/edits
const allIpcEntries = state.projectIpcEntries[project.id] || [];
...
const risks = state.projectRisks[project.id] || [];
```
`useStore()` comes from `src/store/StoreContext.tsx` — a **separate, legacy global state tree** (backed by its own `localStorage` key, `mdrar-state-v4`) that predates the current `dataSource`/React Query architecture. It is **not** the same data your IPC and Risk tabs actually write to — those go through `dataSource.ipc.*` / `dataSource.risks.*` and the `useIpcList`/`useRisks` React Query hooks (see `src/pages/pm/ProjectActivitiesTab.tsx`, `ProjectRisksTab.tsx`, which correctly `import { dataSource } from '@/data/client/index'`). The comment "// IPC entries — live from store, updates immediately when PM adds/edits" is a leftover from before that migration and is no longer true: for any project you manage through the real IPC/Risks tabs (mock DB or Supabase), `state.projectIpcEntries[project.id]` / `state.projectRisks[project.id]` will be empty or stale, because nothing keeps the legacy store in sync with the real data anymore. That's why the Executive page's IPC lists and (if wired similarly) any risk-driven figures look wrong or empty.

**Fix:** replace the legacy store reads with the real React Query hooks, matching the pattern already used in `ProjectOverviewTab.tsx`:
```tsx
import { useIpcList } from '@/queries/useIpc';
import { useRisks } from '@/queries/useRisks'; // confirm exact hook name/export in src/queries/useRisks.ts

// inside ExecutivePage:
const { data: ipcResult } = useIpcList(project.id);
const allIpcEntries = ipcResult?.data ?? [];
...
const { data: risksResult } = useRisks(project.id); // adjust to the hook's actual signature
const risks = risksResult?.data ?? [];
```
Remove the `useStore()` import/usage from this file once nothing else in it needs the legacy store (check `useToast` — that one's fine to keep if `useToast` is also exported from `StoreContext.tsx` and there's no equivalent in the newer `uiStore`; otherwise switch to `useToast` from `@/state/uiStore` for consistency, matching e.g. `ProjectOverviewTab.tsx`).

**Note:** `src/store/StoreContext.tsx` (`useStore`) is still imported by several other files (`src/pages/pm/AddProject.tsx`, `src/pages/pm/FinanceComingSoon.tsx`, `src/pages/tenant/TenantRequestDetail.tsx`, `src/pages/tenant/EmergencyContact.tsx`, `src/components/layouts/PmLayout.tsx`, `src/components/layouts/TenantLayout.tsx`, `src/components/ui/PageHeader.tsx`, `src/components/ui/Badges.tsx`). Each of these should be individually audited the same way — anywhere `state.<domain>` is read for data that also exists in the real `dataSource`/React Query layer is a candidate for the same class of bug (showing stale/disconnected data). This report only confirms `ExecutivePage.tsx`'s IPC/risk reads as broken; the others need the same check before you can safely delete `StoreContext` altogether.

### Verification
- Create a brand-new project via "Add Project", add a couple of activities to it with different `percentComplete` values, then check the PM Dashboard: its progress bar for that project should reflect the real percentage, not 0%, and "Avg Progress" should be a believable percentage, not the project count.
- Add a couple of IPC entries and a risk to that same project, then open its Executive tab and confirm they show up in the IPC lists / risk-driven figures there.

---

## ISSUE #4 — Property occupancy numbers never reflect real unit/lease data

### Root cause
Two completely disconnected sources of truth exist for a property's unit count and occupancy:

1. **A static snapshot**, entered once as plain numbers on the "Add Property" form (`src/pages/management/PropertyDetail.tsx`, `PropertiesList` component):
   ```tsx
   const [units, setUnits] = useState('');
   const [occupied, setOccupied] = useState('');
   ...
   createProperty({ name: ..., units: u, occupied: Math.min(o, u), accent }, ...);
   ```
   These become `properties.units` / `properties.occupied` — plain integer columns in the DB schema (`supabase/migrations/20250101000000_full_schema.sql`):
   ```sql
   create table properties (
     ...
     units       int  not null default 0,
     occupied    int  not null default 0,
     ...
   );
   ```
   and the equivalent static fields on the mock `Property` object (`src/data/client/mock/properties.mock.ts`).

2. **The real, live per-unit data**, entered through the "Units & Leases" tab on the property detail page — adding a unit (`handleAddUnit` → `createLease.mutate`) and marking a unit occupied/vacant (`handleOccupy` / the vacate button → `updateLease.mutate({ status: 'occupied' | 'vacant', ... })`), all going into the `leases` table (Supabase) / `db.fmUnits` (mock) via `src/queries/useProperties.ts`'s `useLeases`/`useCreateLease`/`useUpdateLease`.

**Nothing connects the two.** Marking a unit occupied in the Units & Leases tab only updates that one `leases`/`fmUnits` row — it never touches `properties.units`/`properties.occupied`. Meanwhile, every display of unit/occupancy numbers reads directly from the static snapshot:
- Property overview stat cards (`PropertyDetail`, lines ~128–129):
  ```tsx
  <p ...>{property.units}</p>   {/* Total Units */}
  <p ...>{property.occupied}</p> {/* Occupied Units */}
  ```
- Property list cards (`PropertiesList`, lines ~340–341):
  ```tsx
  <p ...>{p.units}</p>
  <p ...>{Math.round((p.occupied / p.units) * 100)}%</p>
  ```

So no matter how many units you add or occupy/vacate through the real Units & Leases workflow, the numbers on the overview and the property cards never move — they're frozen at whatever was typed into the creation form. This matches your description exactly: the form's raw numbers, not the Units & Leases data, are what's actually displayed everywhere.

### Fix
Make the Units & Leases records the single source of truth, and derive the displayed numbers from them instead of the static columns.

**1. Supabase — extend `properties_with_stats` to compute units/occupied from `leases`.** In a new migration, replace/augment the view in `supabase/migrations/20250101000000_full_schema.sql` (section 15) with a join against `leases`:
```sql
create or replace view properties_with_stats with (security_invoker = true) as
select
  p.id, p.name, p.name_en, p.location, p.accent, p.unit_labels, p.created_at, p.updated_at,
  coalesce(u.unit_count, 0)      as units,
  coalesce(u.occupied_count, 0)  as occupied,
  coalesce(r.open_count, 0)      as open_requests,
  coalesce(r.emergency_count, 0) as emergency
from properties p
left join (
  select
    property_id,
    count(*)                                      as unit_count,
    count(*) filter (where status = 'occupied')   as occupied_count
  from leases
  group by property_id
) u on u.property_id = p.id
left join (
  select
    property_id,
    count(*) filter (where status <> 'resolved')                        as open_count,
    count(*) filter (where status <> 'resolved' and type = 'emergency') as emergency_count
  from requests
  group by property_id
) r on r.property_id = p.id;
```
This makes `units`/`occupied` always reflect the real count of `leases` rows for that property, live, with no extra application code needed for reads. You can keep the `properties.units`/`properties.occupied` columns in the table for now (harmless, just unused by reads) or drop them in a later cleanup migration once nothing writes to them anymore.

**2. Mock — compute the same way in `propertiesMock`.** In `src/data/client/mock/properties.mock.ts`:
```ts
import { db, persist } from './db';
...
function withComputedStats(p: Property): Property {
  const unitsForProperty = db.fmUnits.filter((u) => u.propertyId === p.id);
  return {
    ...p,
    units: unitsForProperty.length,
    occupied: unitsForProperty.filter((u) => u.status === 'occupied').length,
  };
}

export const propertiesMock = {
  async list(params?: PaginationParams): Promise<PaginatedResult<Property>> {
    await simulate();
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? db.properties.length;
    const start = (page - 1) * pageSize;
    return {
      data: db.properties.slice(start, start + pageSize).map(withComputedStats),
      total: db.properties.length,
    };
  },
  async get(id: string): Promise<Property> {
    await simulate();
    const p = db.properties.find((x) => x.id === id);
    if (!p) throw { code: 'NOT_FOUND', message: `Property ${id} not found` };
    return withComputedStats(p);
  },
  async create(input: Omit<Property, 'id' | 'openRequests' | 'emergency'>): Promise<Property> {
    await simulate();
    const property: Property = { ...input, id: genId('prop'), openRequests: 0, emergency: 0 };
    db.properties.push(property);
    persist.properties();
    return withComputedStats(property); // will be 0/0 until units are added via Units & Leases
  },
};
```
This also means `db.fmUnits`'s seed data needs to actually contain rows for the seeded demo properties if you want the demo properties to show non-zero unit counts out of the box — check `src/data/client/mock/db.ts` and backfill seed `fmUnits` rows to match whatever numbers the seed `properties` currently hardcode, so the demo doesn't regress to "0 units" once this fix lands.

**3. Change the "Add Property" form.** Since occupancy must now come from real unit/lease records, stop asking for a free-typed "Occupied Units" number at property creation — there are no units yet at that point. Recommended: drop the "Occupied Units" input from the modal entirely (`PropertiesList`'s form, lines ~356–357), and either:
- Drop "Total Units" too, and let the count simply be "however many units you've added so far" (0 right after creation, growing as the PM adds units in the Units & Leases tab) — the cleanest option, fully consistent with "leases tab is the source of truth"; or
- Keep "Total Units" only as an optional **planned/target** unit count (e.g. rename the label to "Planned Units" and store it as a separate field, not the same `units` the cards display), if the business wants to track "60 planned, 42 added so far" during a property's build-out. This needs a new column (e.g. `planned_units`) if you want it — don't reuse `units` for this, since `units` is being redefined to mean "units on record."

Given your description ("the units and leases tab... should be used for that"), the first, simpler option is the right one unless you tell your agent otherwise.

**4. Double check `properties.create`'s input type** (`CreateProperty` usage in `src/queries/useProperties.ts` and `Omit<Property, 'id' | 'openRequests' | 'emergency'>` in `dataSource.ts`) no longer requires `units`/`occupied` once the form stops collecting them — make them optional (defaulting to `0`) in the input type and in both the mock and Supabase `create()` implementations.

### Verification
- Create a brand-new property with no unit count entered. Confirm its card shows "0 units / 0% occupied" (or however you choose to label an empty property).
- Go to its Units & Leases tab, add 3 units, mark 1 occupied. Go back to the property list — confirm the card now shows "3 units" and "33% occupied" without any manual number entry.
- Mark another unit occupied, then vacate the first one, and confirm both the property overview stat cards and the property list card update to match (2 occupied / 3 total) after each change.

---

## Summary of files touched by this report

- `src/auth/ProtectedRoute.tsx` — pass a `portal` hint on redirect (Issue 1).
- `src/pages/LoginPage.tsx` — only honor `from` when role-compatible (Issue 1).
- `src/auth/AuthProvider.tsx` — clear React Query cache on sign-in/out (Issue 1, hygiene).
- `src/pages/tenant/TenantHome.tsx` — use `session.userId`, not `session.email` (Issue 2).
- `src/data/client/mock/requests.mock.ts`, `src/data/client/mock/db.ts`, `src/types.ts` — add a real `tenantId` to mock requests (Issue 2).
- `src/pages/pm/PmDashboard.tsx` — replace static `projectActivities` lookup with live per-project activity queries; fix the "Avg Progress" stat (Issue 3a/3b).
- `src/pages/pm/ExecutivePage.tsx` — replace `useStore()` IPC/risk reads with `useIpcList`/`useRisks` (Issue 3c).
- `supabase/migrations/` — new migration recomputing `properties_with_stats.units`/`.occupied` from `leases` (Issue 4).
- `src/data/client/mock/properties.mock.ts`, `src/data/client/mock/db.ts` — compute units/occupied from `fmUnits`; backfill seed unit data (Issue 4).
- `src/pages/management/PropertyDetail.tsx` (`PropertiesList`) — remove/repurpose the manual units/occupied inputs on property creation (Issue 4).
- `src/data/client/dataSource.ts`, `src/queries/useProperties.ts` — make `units`/`occupied` optional on property creation input (Issue 4).
