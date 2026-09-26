# MDRAR Platform — Production Readiness & Supabase Migration Plan

## 0. Read this first (context for the coding agent)

This is a Bolt-generated React + TypeScript + Vite + Tailwind app called "MDRAR". It is bilingual
(Arabic/English, RTL/LTR via `i18next`) and contains **three suites**:

- **Facility Management (FM)** — `Tenant` portal (`/tenant/*`) and `Management` portal (`/management/*`)
- **Project Management (PM)** — `/pm/*` (construction project tracking: activities, IPC/payment
  certificates, documents, risks)
- **Hub** — `/` a switcher between suites (`SuiteHub.tsx`)

**Everything currently lives in one place**: `src/store/StoreContext.tsx`. It's a single
`useReducer` holding one giant `AppState` object (see `src/types.ts`), seeded from hardcoded mock
data in `src/data/mockData.ts` / `src/data/pmMockData.ts`, and persisted wholesale to
`localStorage` (`mdrar-state-v4`) on every state change. There is **no backend, no auth, no API
layer, and no route protection** — `role` is just a value in the reducer, so navigating directly to
`/management` or `/pm/dashboard` in the URL bar bypasses the "login" screen entirely. Photos/files
are stored as base64 `dataUrl` strings directly inside the reducer state (see
`src/pages/pm/ProjectDetail.tsx` `FileReader.readAsDataURL` usage), which will blow past
`localStorage`'s ~5MB quota almost immediately and cannot map to a real file-storage backend as-is.
`@supabase/supabase-js` is already a dependency but is not imported or used anywhere yet.

**Your job in this pass is NOT to build the Supabase backend.** It is to restructure the frontend so
that:

1. It behaves like a real production app (real auth gating, real loading/error states, no
   single-blob state, no base64-in-state, no localStorage-as-database).
2. All data access goes through one abstraction layer with a swappable implementation.
3. A fully working **mock backend** implements that abstraction (so the whole app is testable
   end-to-end exactly as it is today, including refresh-persistence).
4. A **Supabase implementation stub** of the same abstraction exists, wired to real
   `@supabase/supabase-js` calls against the schema defined in Section 5, gated behind one
   environment variable — so plugging in real Supabase credentials and flipping
   `VITE_DATA_SOURCE=supabase` is the *only* step needed to go live. No component should need to
   change when that switch happens.

Do all of this incrementally and keep the app building (`npm run typecheck && npm run build`) after
every phase. Do not change visual design, copy, or the i18n strings unless a task explicitly
requires it.

---

## 1. Target architecture

```
src/
  app/                        # App shell, providers, router (renamed from App.tsx if useful)
  auth/
    AuthProvider.tsx           # real session/user/role state, backed by dataSource.auth
    ProtectedRoute.tsx          # route guard component
    RequireRole.tsx             # role-based guard (super_admin, facility_manager, technician, owner, tenant)
  data/
    types/                      # DB-shaped types (snake_case, matches Supabase schema — Section 5)
    client/
      index.ts                  # exports the ACTIVE data source based on VITE_DATA_SOURCE
      dataSource.ts              # the single interface every module implements (Section 3)
      mock/                      # mock backend (Section 4)
        db.ts                     # in-memory + persisted "tables"
        latency.ts                 # simulated network delay/failure helpers
        auth.mock.ts
        properties.mock.ts
        requests.mock.ts
        technicians.mock.ts
        users.mock.ts
        messages.mock.ts
        notifications.mock.ts
        preferences.mock.ts
        projects.mock.ts
        activities.mock.ts
        documents.mock.ts
        risks.mock.ts
        ipc.mock.ts
        storage.mock.ts           # file/photo upload mock
      supabase/                  # Supabase backend (Section 6)
        client.ts                  # createClient() singleton
        auth.supabase.ts
        properties.supabase.ts
        requests.supabase.ts
        ... (one file per domain, mirroring mock/)
        storage.supabase.ts
  queries/                      # React Query hooks — the ONLY thing components call
    useRequests.ts
    useProperties.ts
    useProjects.ts
    ...
  state/
    uiStore.tsx                  # tiny context/reducer for UI-only state (language, toast,
                                  # sidebar open, currentSuite) — NOT server data
  components/ ...                # unchanged locations, but split up oversized files (Section 8)
  pages/ ...
```

Key rule: **components never import `mock/*` or `supabase/*` directly.** They call hooks in
`queries/*`, which call `dataSource` (the interface), which is bound at startup to either the mock
or the Supabase implementation. Swapping backends is changing one environment variable, never a
component.

---

## 2. Environment configuration

Create `.env.example` (and `.env.local`, gitignored) with:

```
VITE_DATA_SOURCE=mock        # "mock" | "supabase"
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_MOCK_LATENCY_MS=350      # simulated round-trip, 0 to disable
VITE_MOCK_FAILURE_RATE=0      # 0-1, chance a mock call randomly rejects (test error states)
```

`src/data/client/index.ts` reads `import.meta.env.VITE_DATA_SOURCE` and exports the resolved
`DataSource` object. Fail loudly at startup (thrown error, not silent fallback) if
`VITE_DATA_SOURCE=supabase` but `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are missing.

---

## 3. The `DataSource` interface (single source of truth)

Define one interface in `src/data/client/dataSource.ts` covering every domain currently in
`AppState`. Every method is `async` and returns a `Promise`, even in the mock, so component code
never has to change when swapped for real network calls. Every method throws a typed error
(`DataSourceError { code, message }`) on failure instead of silently failing.

Sketch (agent should fill in full parameter/return types from `src/types.ts` and Section 5 schema):

```ts
export interface DataSource {
  auth: {
    getSession(): Promise<Session | null>;
    signInWithPassword(email: string, password: string): Promise<Session>;
    signOut(): Promise<void>;
    onAuthStateChange(cb: (session: Session | null) => void): () => void; // unsubscribe
  };
  properties: {
    list(): Promise<Property[]>;
    get(id: string): Promise<Property>;
  };
  requests: {
    list(filters?: { propertyId?: string; status?: RequestStatus; tenantId?: string }): Promise<Request[]>;
    get(id: string): Promise<Request>;
    create(input: CreateRequestInput): Promise<Request>;
    update(id: string, changes: Partial<Request>): Promise<Request>;
    addTimelineEvent(id: string, event: Omit<TimelineEvent, 'id'>): Promise<Request>;
  };
  technicians: { list(): Promise<Technician[]> };
  users: { list(): Promise<User[]>; create(input: CreateUserInput): Promise<User> };
  messages: { list(threadId: string): Promise<Message[]>; send(threadId: string, msg: NewMessage): Promise<Message> };
  notifications: { list(): Promise<Notification[]>; markAllRead(): Promise<void> };
  preferences: { get(): Promise<Preferences>; update(changes: Partial<Preferences>): Promise<Preferences> };
  projects: {
    list(): Promise<Project[]>;
    get(id: string): Promise<Project>;
    create(input: CreateProjectInput): Promise<Project>;
    update(id: string, changes: Partial<Project>): Promise<Project>;
    // unit types + unit instances as sub-resources
    addUnit(projectId: string, unit: ProjectUnitInput): Promise<ProjectUnit>;
    updateUnit(projectId: string, unitId: string, changes: Partial<ProjectUnit>): Promise<ProjectUnit>;
    deleteUnit(projectId: string, unitId: string): Promise<void>;
    addUnitInstance(projectId: string, unit: UnitInstanceInput): Promise<UnitInstance>;
    updateUnitInstance(projectId: string, unitId: string, changes: Partial<UnitInstance>): Promise<UnitInstance>;
    deleteUnitInstance(projectId: string, unitId: string): Promise<void>;
  };
  activities: {
    list(projectId: string): Promise<ProjectActivity[]>;
    create(projectId: string, activity: ProjectActivityInput): Promise<ProjectActivity>;
    update(projectId: string, activityId: string, changes: Partial<ProjectActivity>): Promise<ProjectActivity>;
    delete(projectId: string, activityId: string): Promise<void>;
    addPhoto(projectId: string, activityId: string, file: File): Promise<ActivityPhoto>;
  };
  documents: {
    list(projectId: string): Promise<ProjectDocument[]>;
    upload(projectId: string, file: File, category: DocumentCategory): Promise<ProjectDocument>;
    update(projectId: string, documentId: string, changes: Partial<ProjectDocument>): Promise<ProjectDocument>;
    delete(projectId: string, documentId: string): Promise<void>;
    renameCategory(projectId: string, category: DocumentCategory, names: { name: string; nameEn: string }): Promise<void>;
  };
  risks: {
    list(projectId: string): Promise<ProjectRisk[]>;
    create(projectId: string, risk: ProjectRiskInput): Promise<ProjectRisk>;
    update(projectId: string, riskId: string, changes: Partial<ProjectRisk>): Promise<ProjectRisk>;
    delete(projectId: string, riskId: string): Promise<void>;
    addPhoto(projectId: string, riskId: string, file: File): Promise<ActivityPhoto>;
  };
  ipc: {
    list(projectId: string): Promise<IpcEntry[]>;
    create(projectId: string, entry: IpcEntryInput): Promise<IpcEntry>;
    update(projectId: string, entryId: string, changes: Partial<IpcEntry>): Promise<IpcEntry>;
    delete(projectId: string, entryId: string): Promise<void>;
    addAttachment(projectId: string, entryId: string, file: File): Promise<IpcAttachment>;
  };
  storage: {
    // returns a durable URL (mock: object URL / IndexedDB-backed blob URL; supabase: public/signed URL)
    upload(bucket: string, path: string, file: File): Promise<{ url: string; path: string }>;
    remove(bucket: string, path: string): Promise<void>;
  };
}
```

Notes for the agent:
- `CreateXInput` types should omit server-generated fields (`id`, `created_at`, timeline defaults,
  etc.) — those are assigned by the backend implementation, not the caller.
- Anything that currently mutates arrays via `dispatch` in `StoreContext.tsx` becomes a method here.
- List methods should accept pagination params (`{ page, pageSize }` or cursor) even in phase 1,
  returning `{ data, total }`, so large tables (e.g. properties with hundreds of units, PM
  activities) don't have to load fully client-side once real data grows. The mock can just slice an
  in-memory array; Supabase will use `.range()`.

---

## 4. Mock backend implementation

Goal: identical behavior to today's app, but through the async `DataSource` interface, so building
against it now and swapping to Supabase later requires zero component changes.

1. **Seed data**: move `src/data/mockData.ts` and `src/data/pmMockData.ts` content into
   `src/data/client/mock/db.ts` as the initial "tables" (plain objects/arrays keyed by id), but
   reshape field names to match the Supabase schema in Section 5 (snake_case, explicit foreign
   keys, `created_at`/`updated_at` on every row) — this is the biggest long-term win: the mock and
   the real DB should have the *same shape*, so the mapping layer only has to run once, not twice.
2. **Persistence**: keep using `localStorage`, but namespace per table
   (`mdrar_mock_requests`, `mdrar_mock_projects`, etc.) instead of one giant blob, and store an
   explicit schema version key so you can safely wipe/migrate mock data later. Add a `resetMockDb()`
   dev helper (exposed on `window.__resetMockDb` in dev builds) to restore seed data.
3. **Simulated network conditions**: wrap every mock method with the `latency.ts` helper
   (`await delay(VITE_MOCK_LATENCY_MS)` then randomly throw based on `VITE_MOCK_FAILURE_RATE`) so
   loading and error states in the UI actually get exercised during development, instead of being
   untested code paths that break the first time a real network hiccups.
4. **Mock auth**: `auth.mock.ts` should implement real (if fake) sign-in: a small fixed set of
   seed users with `email` + password `"password"` (documented in the file), each with a `role`,
   issuing a fake session object with an expiry, persisted in `localStorage` under
   `mdrar_mock_session`, restored on load, and exposed to `onAuthStateChange` subscribers.
   Tenant login should also resolve which property/unit/lease belongs to that tenant.
5. **Mock storage**: `storage.mock.ts` should NOT put base64 into app state. Store the `File`/blob
   in an IndexedDB object store (or an in-memory `Map` for the session if IndexedDB feels like
   overkill for this phase) keyed by a generated path, and return a `blob:` object URL for display.
   This fixes the localStorage-quota problem today and means components consume `{ url, path }`
   exactly like they will from a Supabase Storage public/signed URL — no component change needed
   at migration time.
6. Every mock file should have a matching Supabase file of the same name (`requests.mock.ts` /
   `requests.supabase.ts`) implementing the exact same interface slice, so it's easy to diff them
   later and confirm parity.

---

## 5. Supabase schema design (for Section 6 — hand this to Supabase SQL editor / migrations later)

Design tables now so the mock's shape matches it exactly. Use `uuid` primary keys
(`gen_random_uuid()`), `timestamptz` timestamps, and snake_case everywhere. All tables need
`created_at` and `updated_at` (trigger to bump `updated_at`).

Core tables (derived from `src/types.ts`):

- `profiles` (extends `auth.users`: `id` FK to `auth.users.id`, `full_name`, `email`, `role`
  enum `super_admin|facility_manager|technician|owner|tenant`, `avatar_url`)
- `properties` (`id`, `name`, `name_en`, `location`, `units`, `occupied`, `accent`, `unit_labels text[]`)
- `property_managers` (join table: `property_id`, `profile_id`) — which managers/owners see which
  properties, used for RLS
- `leases` (`id`, `tenant_id` FK profiles, `property_id`, `unit`, `term_start`, `term_end`, `rent`,
  `deposit`, `rent_status`)
- `technicians` (`id`, `profile_id` nullable FK, `name`, `name_en`, `specialty`, `resolved_count`, `sla`)
- `requests` (`id`, `property_id`, `unit`, `tenant_id` FK profiles, `type`, `category`,
  `description`, `status`, `priority`, `photo_url`, `technician_id` nullable, `created_at`)
- `request_timeline_events` (`id`, `request_id` FK, `status`, `label`, `actor`, `created_at`)
- `messages` (`id`, `thread_id` — e.g. tenant_id or request_id, `sender_role`, `text`, `text_en`, `created_at`)
- `notifications` (`id`, `profile_id` FK nullable (null = broadcast), `title`, `body`, `read`,
  `emergency bool`, `property_id` nullable, `created_at`)
- `preferences` (`profile_id` PK/FK, `immediate_emergency`, `daily_summary`, `sms_alerts`,
  `request_updates`, `announcements`, `rent_reminders`)
- `projects` (`id`, `name`, `name_en`, `location`, `location_en`, `total_units`, `start_date`,
  `end_date`, `total_days`, `contractor`, `contractor_en`, `budget`, `status`, `description`,
  `description_en`, `contract_number`, `consultant`, `consultant_en`)
- `project_unit_types` (`id`, `project_id` FK, `type`, `type_en`, `size`, `bedrooms`, `unit_count`,
  `image_url`, `floor_plan_url`, `model_3d_url`, `brochure_url`, `category`)
- `project_unit_instances` (`id`, `project_id` FK, `model_id` FK unit type, `label`, `label_en`,
  `floor`, `status`, `floor_plan_url`, `model_3d_url`, `brochure_url`, `price`, `space`,
  `attachment_name`, `floor_level`, `townhouse_type`)
- `project_activities` (`id`, `project_id` FK, `activity_code`, `name`, `name_en`, `phase`,
  `start_day`, `end_day`, `duration`, `percent_complete`, `actual_progress`, `status`, `team`,
  `team_en`, `description`, `description_en`, `actual_cost`, `planned_cost`,
  `change_order_amount`, `start_date`, `end_date`, `actual_start_date`, `actual_end_date`)
- `activity_photos` (`id`, `activity_id` FK, `file_url`, `file_type`, `file_name`, `uploaded_at`)
- `project_documents` (`id`, `project_id` FK, `name`, `name_en`, `type`, `category`, `file_url`, `uploaded_at`)
- `project_document_category_names` (`project_id` FK, `category`, `name`, `name_en`) — per-project
  overrides of category display names
- `project_risks` (`id`, `project_id` FK, `name`, `name_en`, `date_raised`, `responsible`,
  `responsible_en`, `description`, `description_en`, `deadline`, `reason`, `reason_en`, `result`)
- `risk_photos` (`id`, `risk_id` FK, `file_url`, `file_type`, `file_name`, `uploaded_at`)
- `ipc_entries` (`id`, `project_id` FK, `direction`, `source`, `party_name`, `party_name_en`,
  `reference`, `activity_id` nullable FK, `amount`, `description`, `description_en`, `status`,
  `date_logged`)
- `ipc_attachments` (`id`, `ipc_entry_id` FK, `file_name`, `file_type`, `file_url`, `uploaded_at`)

Storage buckets:
- `request-photos` (tenant-uploaded, private, readable by tenant owner + property managers)
- `activity-photos`, `risk-photos`, `ipc-attachments`, `project-documents` (private, readable by PM
  suite roles + owners of the relevant project)
- `unit-assets` (floor plans, brochures, 3D model files — can be public read since these are
  marketing collateral)

RLS policy guidance (write actual SQL when implementing Section 6, this is the rule set):
- `tenant` role: `requests`/`messages`/`notifications`/`leases` — only rows where `tenant_id =
  auth.uid()` (or property/unit matches their lease).
- `facility_manager`/`super_admin`/`owner`: `requests`/`properties` scoped to rows in
  `property_managers` for their `profile_id` (super_admin sees all — add a `role = 'super_admin'`
  bypass clause).
- `technician`: read/update only `requests` where `technician_id = auth.uid()`.
- PM suite tables: gate by a separate `project_managers` join table (create it, mirroring
  `property_managers`) — PM and FM data should NOT be visible to a role that shouldn't have it,
  even though today's frontend routes assume any authenticated management user can see everything.
- Never rely on the client-sent `role` for authorization — RLS must independently check
  `profiles.role` (or a `project_managers`/`property_managers` row) via `auth.uid()` on every
  policy. The current app's role stored in `useReducer` state is trivially spoofable and must not
  survive as the source of truth once Supabase is wired in.

---

## 6. Supabase implementation of `DataSource`

1. `src/data/client/supabase/client.ts`: single `createClient(import.meta.env.VITE_SUPABASE_URL,
   import.meta.env.VITE_SUPABASE_ANON_KEY)`, exported once, imported by every `*.supabase.ts` file.
2. Each `*.supabase.ts` file implements exactly the slice of `DataSource` its name suggests, using
   `.select()/.insert()/.update()/.delete()` against the tables in Section 5, and
   `supabase.storage.from(bucket).upload/getPublicUrl/createSignedUrl` for file methods.
3. `auth.supabase.ts` uses `supabase.auth.signInWithPassword`, `supabase.auth.onAuthStateChange`,
   and fetches the matching `profiles` row (for `role`) right after establishing a session.
4. Map snake_case DB rows to the camelCase shapes in `src/types.ts` at the edge of the Supabase
   adapter only (one `mapRequestRow(row): Request` per table) — the rest of the app should never
   see snake_case.
5. Until real Supabase credentials exist, this layer can be written and type-checked against the
   schema but left untested — that's expected and fine. It should not be imported anywhere except
   `src/data/client/index.ts`'s conditional export, so it never breaks `npm run build` while
   `VITE_DATA_SOURCE=mock`.

---

## 7. Auth & route protection (do this even before Supabase exists)

The current app has no real gate — `/management`, `/pm/dashboard`, `/tenant` are all reachable by
typing the URL, regardless of `currentRole`. Fix this against the mock auth first:

1. Build `AuthProvider` using `dataSource.auth` (session, user, role, `loading` while session is
   being resolved on first load — show a full-page spinner during that check, don't flash protected
   content).
2. Build `<ProtectedRoute>` (redirect to `/` or a new `/login` if no session) and `<RequireRole
   roles={[...]}>` (redirect to an "unauthorized" state if session exists but wrong role) and wrap
   every route in `App.tsx` accordingly:
   - `/tenant/*` → `RequireRole(['tenant'])`
   - `/management/*` → `RequireRole(['super_admin','facility_manager','technician','owner'])`
   - `/pm/*` → `RequireRole` with whatever PM-specific roles you introduce (today PM has no role
     distinction at all — introduce one, e.g. a `pm_manager`/`pm_viewer` role or a
     `project_managers` membership check, so PM data isn't wide open to every management login).
3. Replace `LandingPage`'s `selectRole()` (which just sets local state) with an actual login screen
   calling `dataSource.auth.signInWithPassword`. Keep the two-portal picker UI, but have it lead to
   role-appropriate login forms rather than instantly granting access.
4. `handleLogout` in the layouts should call `dataSource.auth.signOut()`, not just
   `dispatch({ type: 'SET_ROLE', role: null })`.
5. Never trust `role` from client state for gating server data — that's what Section 5's RLS is
   for. The frontend guard is only a UX convenience to avoid flashing pages the user can't act on;
   real protection is server-side.

---

## 8. Break up the monolith (state + oversized files)

1. Replace `StoreContext.tsx`'s single reducer with:
   - `state/uiStore.tsx`: tiny context for genuinely local UI state only — `language`,
     `currentSuite`, `toast`, sidebar open/closed. Nothing server-derived belongs here.
   - React Query (`@tanstack/react-query`) for everything else. Add the dependency, wrap `App` in
     `QueryClientProvider`. Each domain gets a `queries/useX.ts` file exporting `useXList()`,
     `useX(id)`, and mutation hooks (`useCreateX()`, `useUpdateX()`, `useDeleteX()`) that call
     `dataSource.x.*` and invalidate the right query keys on success. This gives you caching,
     request de-duplication, background refetch, retry, and loading/error states for free instead
     of hand-rolling them — critical for this to feel production-grade rather than a toy.
   - Every mutation should show its own loading state on the *specific* button/form doing the
     write (not a global spinner) and surface errors via the existing `Toast` component instead of
     failing silently — right now, e.g., `ADD_PROJECT`/`UPDATE_ACTIVITY` etc. always "succeed"
     because they're synchronous local reducer updates; once they're network calls they can fail
     and the UI must say so.
2. `src/pages/pm/ProjectDetail.tsx` is enormous (2000+ lines) and mixes many concerns (unit
   management, activities, documents, risks, IPC, photo upload UI) in one file. Split it into one
   container page plus per-tab components (`ProjectUnitsTab.tsx`, `ProjectActivitiesTab.tsx`,
   `ProjectDocumentsTab.tsx`, `ProjectRisksTab.tsx`, `ProjectIpcTab.tsx`), each fetching only the
   data it needs via the new query hooks (so switching tabs doesn't require the whole project's
   data to already be loaded, and so each tab can be code-split — see Section 10).
3. Do the same lighter-weight pass on any other file over ~400 lines once it's touched for this
   migration (`ManagementRequests.tsx`, `Reports.tsx`, etc.) — extract list rows, filters, and modal
   forms into their own components under a local `components/` subfolder next to the page.

---

## 9. Validation layer

Add `zod` (or reuse if already present via a transitive dep) and define one schema per
create/update input type, colocated with the `DataSource` input types in Section 3. Use these
schemas:
- In every form's submit handler, to validate before calling a mutation hook (fail fast client-side
  with inline field errors instead of relying on the "backend" to reject).
- As the single source of truth for what a valid `CreateRequestInput`, `ProjectActivityInput`, etc.
  looks like, so the mock and Supabase adapters don't need to duplicate validation logic.

---

## 10. Performance & scalability

1. Lazy-load route-level components: `const ProjectDetail = lazy(() => import(...))` for every page
   under `/pm/*` and `/management/*`, wrapped in `<Suspense>` with a lightweight skeleton — these
   are the heaviest bundles (recharts, big forms) and shouldn't be in the initial JS payload for a
   tenant who only ever visits `/tenant/*`.
2. Paginate/virtualize any list that can grow unbounded in real usage: `requests` (management side),
   `project_activities`, `ipc_entries`, `properties` if the portfolio grows. Use the paginated list
   methods from Section 3 rather than fetching entire tables and slicing client-side.
3. Memoize derived/filtered lists (`useMemo`) wherever a page currently recomputes filters/sorts on
   every render from `state.requests`/`state.projects` — this matters more once those are React
   Query results that may re-render on background refetch.
4. Stop storing images/files as base64 anywhere in app state (Section 4 storage mock already fixes
   the two `ProjectDetail.tsx` `FileReader` call sites) — always store a `path`/`url` reference, and
   render an `<img src>` pointing at it.
5. Recharts and other heavy chart usage (`Reports.tsx`, PM executive dashboards) should only mount
   once their tab/route is active, not eagerly on layout mount.

---

## 11. Error handling & resilience

1. Add a top-level React `ErrorBoundary` around `<AppRoutes />` so a render error in one page
   doesn't white-screen the whole app.
2. Every query hook should surface `isLoading`, `isError`, `error` to its page, and every page
   should render a real loading skeleton and a real error state (with a retry action) instead of
   assuming data is always present — today every page assumes `state.X` is instantly available,
   which will not be true once data is fetched over the network.
3. Wrap all `dataSource` calls in the adapters with consistent error normalization
   (`DataSourceError`) so components can branch on `error.code` (e.g. `UNAUTHORIZED`,
   `NOT_FOUND`, `NETWORK`) instead of parsing arbitrary thrown values.

---

## 12. Testing checklist (mock-backed, runnable today without Supabase)

Add Vitest + React Testing Library (`npm i -D vitest @testing-library/react
@testing-library/jest-dom jsdom`) and cover, at minimum:
- Mock adapter unit tests: create/update/delete/list round-trips for `requests`, `projects`,
  `activities`, `ipc` — assert persisted state survives a simulated reload (re-instantiate the mock
  db module and confirm data is read back from `localStorage`).
- Auth flow: sign in as each seeded role, confirm `ProtectedRoute`/`RequireRole` allow/deny the
  right routes.
- One smoke test per suite: tenant creates a request end-to-end and sees it in "My Requests"; a
  management user changes a request's status and the tenant's timeline reflects it; a PM user adds
  a project activity and sees it in the project's progress view.
- File upload: uploading a photo through the mock storage adapter returns a usable `url` and the
  UI renders it.

---

## 13. Migration checklist — flipping the switch to Supabase

Once a real Supabase project exists, this should be the *entire* remaining task list:

1. Run the DDL from Section 5 (as migrations, e.g. via `supabase db push` or the SQL editor) and
   create the storage buckets + policies.
2. Fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in `.env.local`.
3. Finish/verify the `*.supabase.ts` adapter files against the live schema (they were written
   against the spec in Section 5 during this pass, so this is mostly smoke-testing, not new
   feature work).
4. Seed real `profiles` rows for however many real users exist (or build a simple invite/signup
   flow if self-serve signup is wanted — out of scope for this pass).
5. Set `VITE_DATA_SOURCE=supabase` and rebuild.
6. Re-run the test suite from Section 12 against the Supabase adapter (parametrize the tests over
   both adapters if feasible) to confirm behavioral parity before shipping.
7. Remove/retire the mock adapter only once confident, or keep it permanently for local dev / CI
   without network access — recommended to keep it.

---

## 14. Definition of done for this pass

- [ ] `npm run typecheck` and `npm run build` pass.
- [ ] No component imports `src/data/client/mock/*` or `src/data/client/supabase/*` directly —
      only `src/data/client/index.ts` and `queries/*` do.
- [ ] No base64 `dataUrl` file storage remains in any reducer/query state.
- [ ] `/management/*`, `/pm/*`, `/tenant/*` are unreachable without a valid mock session of the
      correct role; a plain URL visit while logged out redirects to login.
- [ ] Logging out actually clears the session (mock or Supabase) end-to-end.
- [ ] Every list-fetching page shows a loading state and an error state, both visually distinct
      from the empty state.
- [ ] `ProjectDetail.tsx` is split into a container + tab components, each independently
      data-fetching.
- [ ] `.env.example` documents every variable from Section 2.
- [ ] The Supabase schema in Section 5 is written down as actual SQL (a `supabase/migrations/*.sql`
      file or equivalent) even though it hasn't been applied to a live project yet.
- [ ] Switching `VITE_DATA_SOURCE` from `mock` to `supabase` (once credentials + schema exist)
      requires no code changes outside `src/data/client/supabase/*`.
