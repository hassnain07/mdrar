# MDRAR Platform — Agent Memory Log

This file is the running change log for AI agents. Read this before touching any code.
Each entry is a session. Most recent is at the top.

---

## Session 10 — Bilingual Field Auto-Translation

### Problem Fixed
Previous session mirrored the raw text across fields (EN text copied into AR field). The correct behaviour is actual translation.

### What Was Built

**`src/lib/useBilingualField.ts`** — rewritten
- On `onBlur` of either field, if the counterpart hasn't been manually touched, calls **MyMemory** free translation API (`api.mymemory.translated.net`) to translate the text
- Translation fires on blur (not on every keystroke) to avoid hammering the API
- If the API fails or returns the original text unchanged, the counterpart field is left empty (no silent copy)
- `translating` boolean exposed for future loading indicator use
- Touch tracking unchanged: once a field is manually edited, it's never auto-filled again

**`onBlur` wired in all three forms:**
- `ManagementAnnouncements` — title AR↔EN, body AR↔EN
- `ProjectEditModal` — name, location, contractor, consultant, description AR↔EN
- `AddProject` — same pairs + unit type rows use inline `translateUnitTypeAr` / `translateUnitTypeEn` async functions on blur

### Build Status After Session 10
- `npm run typecheck` ✅ 0 errors

---

## Session 9 — Bilingual Field Auto-Mirror

### What Was Built

**`src/lib/useBilingualField.ts`** — new reusable hook
- Manages an AR + EN field pair
- When the user types in one field, the other is auto-filled **only while it hasn't been manually touched yet**
- Once the user edits the counterpart field directly, auto-fill stops for that field (no overwriting)
- Accepts optional initial values; `reset()` helper clears both fields and resets touch state

**Applied to all bilingual forms in the owner/PM portal:**
- `src/pages/management/ManagementAnnouncements.tsx` — title AR↔EN, body AR↔EN
- `src/pages/pm/ProjectEditModal.tsx` — name, location, contractor, consultant, description AR↔EN pairs
- `src/pages/pm/AddProject.tsx` — name, location, contractor, consultant AR↔EN pairs; unit type rows also mirror AR↔EN inline

### Build Status After Session 9
- `npm run typecheck` ✅ 0 errors

---

## Session 8 — Announcements System

### What Was Built

**New `Announcement` type (`src/types.ts`)**
- Fields: `id`, `title` (AR), `titleEn`, `body` (AR), `bodyEn`, `propertyId` (`string | 'all'`), `createdAt`, `createdBy`

**Data layer**
- `src/data/client/mock/db.ts` — added `announcements` table with one seed entry; added `persist.announcements` and reset key
- `src/data/client/mock/announcements.mock.ts` — new: `list(propertyId?)`, `create`, `delete`
- `src/data/client/mock/index.ts` — wired `announcementsMock`
- `src/data/client/dataSource.ts` — added `CreateAnnouncementInput` type + `announcements` domain to interface
- `src/data/client/supabase/index.ts` — stubs added

**React Query hooks (`src/queries/useAnnouncements.ts`)** — new file
- `useAnnouncementList(propertyId?)` — filters by property or returns all
- `useCreateAnnouncement()` — invalidates all announcement queries on success
- `useDeleteAnnouncement()` — same

**Management page (`src/pages/management/ManagementAnnouncements.tsx`)** — new
- Lists all announcements with property scope badge, author, date
- "New announcement" button opens a modal with bilingual fields (AR + EN title/body) and property selector
- Delete button per announcement
- Lazy-loaded, route: `/management/announcements`, guarded by `RequireRole(['management'])`

**Wiring**
- `src/App.tsx` — lazy import + route added
- `src/components/layouts/ManagementLayout.tsx` — "Announcements" nav item added with `Megaphone` icon

**Tenant side (`src/pages/tenant/TenantHome.tsx`)**
- Replaced hardcoded `t('announcementText')` banner with live `useAnnouncementList(tenantPropertyId)` query
- Renders one card per announcement; hidden when list is empty
- Hook call moved above early returns to respect rules of hooks

### Build Status After Session 8
- `npm run typecheck` ✅ 0 errors
- `npm run test` ✅ 16/16

---

## Session 7 — Technician Portal Navigation Fix

### Problem Fixed

**Bug: No direct path to the technician portal from the FM landing page**
- Root cause: `LandingPage.tsx` only had 2 cards (Management + Resident). The technician portal card only appeared on `LoginPage` when navigated to directly via URL — it was invisible from the normal FM flow (SuiteHub → Facility Management → LandingPage).
- Fix: Added a third "Technician Portal" card to `LandingPage.tsx`. Grid changed from `md:grid-cols-2` to `md:grid-cols-3`. Card navigates to `/login` with `{ state: { portal: 'technician' } }`, matching the same pattern as the other two cards. `selectRole` type widened to include `'technician'`. `Wrench` icon imported from lucide-react.

### Correct FM Navigation Flow (after fix)
```
SuiteHub (/)
  Facility Management → /facility (LandingPage)
    Owner / Manager card  → /login { portal: 'management' }
    Resident card         → /login { portal: 'tenant' }
    Technician card       → /login { portal: 'technician' }  ← NEW
  Project Management → /login { portal: 'pm' }
```

### Files Changed
- `src/components/layouts/LandingPage.tsx` — added technician card, widened `selectRole` type, changed grid to 3 columns

### Build Status After Session 7
- `npm run typecheck` ✅ 0 errors

---

## Session 6 — Technician Portal + Real Per-Role Notifications

### What Was Built

**Technician Portal (new)**
- `src/components/layouts/TechnicianLayout.tsx` — sidebar layout with technician name display and logout
- `src/pages/technician/TechnicianDashboard.tsx` — lists all requests assigned to the logged-in technician (filtered by `technicianId`), split into open/completed with stats cards
- `src/pages/technician/TechnicianRequestDetail.tsx` — technician can acknowledge → start work → mark complete; each action pushes a notification to management and adds a timeline event
- Routes added to `App.tsx`: `/technician` and `/technician/request/:id`, both guarded by `RequireRole(['technician'])`
- `LoginPage.tsx` already had the technician portal card and `ROLE_DEST['technician'] = '/technician'` (done by a previous agent)

**Technician ID resolution**
- `TechnicianDashboard` derives `technicianId` from `session.email`: `salem@mdrar.sa` → `tech-1`, `fahad@mdrar.sa` → `tech-2`. This is a mock-only mapping — in Supabase the technician record would be joined by userId.

**Per-role notification system**
- `src/data/client/mock/db.ts` — added `tenantNotifications: Record<tenantEmail, Notification[]>` table alongside the existing management `notifications` table. Both are persisted to localStorage.
- `src/data/client/mock/notifications.mock.ts` — full rewrite: added `listForTenant`, `markAllReadForTenant`, `pushForTenant` methods. Management bucket unchanged.
- `src/data/client/dataSource.ts` — `notifications` interface extended with the 3 new per-tenant methods
- `src/data/client/supabase/index.ts` — stubs added for the 3 new methods
- `src/queries/useShared.ts` — added `useTenantNotifications(tenantEmail)` and `useMarkTenantNotificationsRead(tenantEmail)` hooks
- `src/components/shared/NotificationBell.tsx` — now reads from the tenant bucket when `session.role === 'tenant'`, management global bucket otherwise. Mark-all-read targets the correct bucket.

**Notification flow (complete)**
- Tenant submits request → management notified (was already working)
- Management assigns technician → management notified (was already working)
- Technician updates status (acknowledge / start / complete) → **management notified** via `dataSource.notifications.push()`
- Management advances status → **tenant notified** via `dataSource.notifications.pushForTenant(req.tenantEmail, ...)`
- `requests.mock.ts addTimelineEvent` also pushes to tenant bucket on every timeline event (belt-and-suspenders)
- `ManagementRequestDetail.tsx` — `advanceStatus` now explicitly calls `pushForTenant` so tenant sees the update in their bell

### Files Changed
- `src/components/layouts/TechnicianLayout.tsx` — new
- `src/pages/technician/TechnicianDashboard.tsx` — new
- `src/pages/technician/TechnicianRequestDetail.tsx` — new
- `src/App.tsx` — added `TechnicianLayout` import + 2 technician routes
- `src/data/client/mock/db.ts` — added `tenantNotifications` table + persist helper + reset key
- `src/data/client/mock/notifications.mock.ts` — full rewrite with per-tenant methods
- `src/data/client/mock/requests.mock.ts` — `addTimelineEvent` now also calls `pushForTenant`
- `src/data/client/dataSource.ts` — 3 new methods on `notifications` interface
- `src/data/client/supabase/index.ts` — 3 new stubs
- `src/queries/useShared.ts` — 2 new hooks + `tenantNotifKeys`
- `src/components/shared/NotificationBell.tsx` — role-aware notification source
- `src/pages/management/ManagementRequestDetail.tsx` — `advanceStatus` calls `pushForTenant`

### Build Status After Session 6
- `npm run typecheck` ✅ 0 errors
- `npm run test` ✅ 16/16

---

## Session 5 — Resident Messaging System (End-to-End)

### Problems Fixed

**Bug 1: Messages written to StoreContext, never reached a shared store**
- Root cause: `ContactManager.tsx` used `dispatch({ type: 'ADD_MESSAGE' })` which only updated the in-memory React state for that tenant's browser tab. The management side had no way to read it — it would need the same `StoreContext` instance, which is impossible across different sessions.
- Fix: `ContactManager` fully migrated to `useMessages` + `useSendMessage` hooks. Messages now go through `dataSource.messages.send()` into the shared localStorage-backed mock DB.

**Bug 2: Single flat message array, no threading**
- Root cause: `messages.mock.ts` stored all messages in one flat `db.messages` array with no concept of which tenant sent them. Multiple tenants' messages would be mixed together.
- Fix: Rewrote `messages.mock.ts` to use `Record<threadId, Message[]>` persisted under `mdrar_mock_message_threads` in localStorage. `threadId` = tenant's `userId` (e.g. `mock-m.alotaibi@example.com`). Each tenant's conversation is fully isolated.

**Bug 3: No management UI to read or reply to messages**
- Root cause: No page, route, or nav item existed for management to view tenant messages.
- Fix: Created `ManagementMessages.tsx` — split-pane inbox with thread list on the left and live chat on the right. Management can read all tenant threads and reply. Both sides poll every 5 seconds via `refetchInterval`.

### Files Changed
- `src/data/client/mock/messages.mock.ts` — full rewrite: per-thread storage, `listThreads()` method added
- `src/data/client/dataSource.ts` — added `listThreads()` to `messages` interface
- `src/data/client/supabase/index.ts` — added `listThreads` stub
- `src/queries/useShared.ts` — added `useMessageThreads` hook; added `refetchInterval: 5000` to `useMessages`; `useSendMessage` now also invalidates `threads` cache key
- `src/pages/tenant/ContactManager.tsx` — full rewrite: uses `useAuth` for `threadId`, `useMessages` + `useSendMessage` hooks, removed all `useStore` usage
- `src/pages/management/ManagementMessages.tsx` — new file: management inbox page
- `src/App.tsx` — added lazy import + `/management/messages` route
- `src/components/layouts/ManagementLayout.tsx` — added Messages nav item + `MessageSquare` icon import

### Architecture: Message Threading
```
threadId = session.userId of the tenant (e.g. "mock-m.alotaibi@example.com")

Tenant side:  ContactManager  → useSendMessage({ threadId, msg: { from: 'tenant', ... } })
Manager side: ManagementMessages → useSendMessage({ threadId, msg: { from: 'manager', ... } })

Both sides poll useMessages(threadId) every 5s via refetchInterval.
listThreads() returns all threads with messages — used by management inbox.
```

### Build Status After Session 5
- `npm run typecheck` ✅ 0 errors

---

## Session 4 — Logout Bug Fixes

### Problems Fixed

**Bug 1: Logout redirected to `/login` (portal picker) instead of home**
- Root cause: All three layout `handleLogout`/`handleBackToHub` functions called `navigate('/login')`. After sign-out with no portal state, `LoginPage` showed the 3-card portal picker — making it look like a broken second login screen.
- Fix: All three layouts now call `navigate('/', { replace: true })` — going to `SuiteHub` (the real home screen).

**Bug 2: Race condition — navigate fired before signOut resolved**
- Root cause: `signOut()` is async but was called with `void signOut(); navigate(...)` — navigation could complete before the session was cleared.
- Fix: Changed to `void signOut().then(() => navigate('/', { replace: true }))` so redirect only happens after sign-out fully resolves.

### Files Changed
- `src/components/layouts/ManagementLayout.tsx` — `handleLogout` awaits signOut, navigates to `/`
- `src/components/layouts/PmLayout.tsx` — `handleBackToHub` awaits signOut, navigates to `/`
- `src/components/layouts/TenantLayout.tsx` — `handleLogout` awaits signOut, navigates to `/`

### Build Status After Session 4
- `npm run typecheck` ✅ 0 errors

---

## Session 3 — Navigation & Auth Bug Fixes

### Problems Fixed

**Bug 1: Duplicate portal picker on `/login`**
- Root cause: `LandingPage.tsx` called `navigate('/login')` without any state for both buttons, so `LoginPage` had no idea which portal was selected and showed its own 3-card picker again — creating a second identical selection screen.
- Fix: `LandingPage` now calls `navigate('/login', { state: { portal: role } })`.

**Bug 2: PM button bypassed auth entirely**
- Root cause: `SuiteHub.tsx` called `navigate('/pm')` directly. The `/pm` route was a bare `<Navigate to="/pm/dashboard">` with no auth guard, so unauthenticated users landed on the PM dashboard.
- Fix: PM button now calls `navigate('/login', { state: { portal: 'pm' } })`. The `/pm` redirect route is also wrapped in `RequireRole` as a safety net.

**Bug 3: After login, always redirected back to home (`/`)**
- Root cause: `LoginPage` used `from` (the page that triggered the redirect) defaulting to `'/'` when there was no `from`. This sent users back to `SuiteHub` after login instead of their portal.
- Fix: After login, redirect destination is determined by `session.role`: `management` → `/management`, `tenant` → `/tenant`, `pm_manager/pm_viewer` → `/pm/dashboard`. The `from` value is still respected if present (e.g. deep-link protection).

**Bug 4: `signIn` returned `void`**
- Root cause: `AuthProvider.signIn` returned `void` so `LoginPage` couldn't read the role from the returned session.
- Fix: `signIn` now returns `Promise<Session>`. Interface in `AuthContextValue` updated accordingly.

### Files Changed
- `src/components/layouts/SuiteHub.tsx` — PM button goes to `/login` with portal state
- `src/components/layouts/LandingPage.tsx` — both buttons pass portal state to `/login`
- `src/pages/LoginPage.tsx` — full rewrite: reads `portal` from location state, pre-fills credentials, redirects by role after login
- `src/auth/AuthProvider.tsx` — `signIn` returns `Session`
- `src/App.tsx` — `/pm` redirect wrapped in `RequireRole`

### Current Navigation Flow (correct)
```
SuiteHub (/)
  FM card → /facility (LandingPage)
    Management card → /login { portal: 'management' }
    Resident card   → /login { portal: 'tenant' }
  PM card → /login { portal: 'pm' }

LoginPage
  - If portal in location.state: skip picker, show form with pre-filled credentials
  - If no portal state: show 3-card picker (direct URL access fallback)
  - After login: role-based redirect (management/tenant/pm_manager/pm_viewer)
```

---

## Session 2 — Full Gap Implementation (Sections 1, 8–12 of MD spec)

### What Was Built

**React Query layer (`src/queries/`)**
- 8 files created covering all domains: requests, properties, projects, activities, documents, risks, ipc, shared
- All hooks follow the pattern: `useQuery` for reads, `useMutation` + `invalidateQueries` for writes
- Cache key factories exported from each file (e.g. `projectKeys`, `requestKeys`)

**Zod validation (`src/data/client/schemas.ts`)**
- Schemas: `createRequestSchema`, `createProjectSchema`, `projectActivitySchema`, `projectRiskSchema`, `ipcEntrySchema`, `createUserSchema`
- Inferred TypeScript types exported alongside each schema

**Error handling components (`src/components/ui/`)**
- `ErrorBoundary.tsx` — class-based, wraps `<AppRoutes />` in `App.tsx`
- `PageStates.tsx` — `PageSkeleton` (animated pulse) + `PageError` (with retry callback)

**Lazy loading (`src/App.tsx`)**
- All route-level components wrapped in `React.lazy()` + `<Suspense fallback={<PageSkeleton />}>`
- Layouts and auth pages load eagerly (small, always needed)
- `LanguageSync` moved to use `useUi` instead of `useStore`

**Migrated pages (useStore → React Query)**
- `ManagementDashboard` — `useRequestList` + `usePropertyList`
- `ManagementRequests` — `useRequestList`
- `TenantHome` — `useRequestList` + `useAuth` for tenant name/unit
- `PmDashboard` — `useProjectList`
- `DocumentsContent` — full document CRUD hooks; now takes `{ projectId, isRtl }` (no `project` prop)
- `IpcContent` — full IPC CRUD hooks; now takes `{ projectId, isRtl }` (no `project` prop)

**PM module refactor**
- `ProjectDetail.tsx` — rewritten as thin ~60-line container, delegates to tab components
- New tab components: `ProjectOverviewTab`, `ProjectActivitiesTab`, `ProjectRisksTab`, `ProjectUnitsTab`, `ProjectQuantityTab`, `ProjectEditModal`
- File uploads in activities and risks use `dataSource.storage.upload()` — no base64

**Test infrastructure**
- `vitest.config.ts` — jsdom environment, `@` alias, setup file
- `src/test/setup.ts` — jest-dom + `URL.createObjectURL` mock
- 16 tests across 3 files: `auth.test.ts` (7), `mockAdapters.test.ts` (7), `storage.test.ts` (2)
- All 16 pass

**Dependency fix**
- `react-is` installed to fix pre-existing recharts peer dep build failure

### Build Status After Session 2
- `npm run typecheck` ✅ 0 errors
- `npm run build` ✅ (recharts chunk size warning — acceptable)
- `npm run test` ✅ 16/16

---

## Session 1 — Initial Analysis

### Codebase Assessed
- React + TypeScript + Vite + Tailwind bilingual SPA
- Single `useReducer` holding all state (no React Query, no API layer)
- No real auth (role set by clicking a button)
- Base64 file storage in state
- Monolithic `ProjectDetail.tsx` (~800+ lines)
- Empty `queries/` folder
- No Zod schemas, no lazy loading, no ErrorBoundary, no tests

### Spec Document
`FRONTEND_SCALABILITY_AND_SUPABASE_MIGRATION.md` — 14 sections covering the full migration plan. Sessions 2 and 3 implemented sections 1, 8, 9, 10, 11, 12.

---

## Remaining Work

### High Priority
- Migrate remaining FM pages to React Query:
  - `ManagementRequestDetail` — replace `useStore` with `useRequest` + `useUpdateRequest` + `useAddTimelineEvent`
  - `PropertyDetail` — replace `useStore` with `useProperty` + `useRequestList({ propertyId })`
  - `UsersPage` — replace `useStore` with `useUserList` + `useCreateUser`
  - `Reports` — replace `useStore` with `useRequestList` + `usePropertyList` + `useTechnicianList`
  - `ManagementSettings` — replace `useStore` with `usePreferences` + `useUpdatePreferences`

- Migrate remaining tenant pages to React Query:
  - `ResidentSupport` — replace `useStore` with `useCreateRequest`
  - `MyRequests` — replace `useStore` with `useRequestList({ tenantId })`
  - `TenantRequestDetail` — replace `useStore` with `useRequest` + `useAddTimelineEvent`
  - `TenantSettings` — replace `useStore` with `usePreferences` + `useUpdatePreferences`
  - `TenantProfile` — replace `useStore` with `useAuth` session data
  - `EmergencyContact` — static content, minimal changes needed

### Medium Priority
- Remove `useStore` from layouts once emergency badge count is moved to a query hook
- Implement Supabase adapter (`src/data/client/supabase/`) — all stubs exist, need real SQL calls
- Add form validation using the Zod schemas already defined in `schemas.ts`
- Expand test coverage to include page-level component tests

### Low Priority
- `ExecutivePage.tsx` — purpose unclear, may need PM role review
- `FinanceComingSoon.tsx` — placeholder, no work needed yet
- Remove `StoreContext` entirely once all pages are migrated

---

## Invariants — Never Break These

1. **No base64 in state.** File uploads always go through `dataSource.storage.upload()`.
2. **`signIn` returns `Session`.** `LoginPage` depends on this for role-based redirect.
3. **`/pm` redirect is wrapped in `RequireRole`.** Prevents auth bypass.
4. **`LandingPage` passes `{ state: { portal } }` to `/login`.** Without this, users see a duplicate portal picker.
5. **`IpcContent` takes `{ projectId, isRtl }`.** It fetches the project internally. Do not add a `project` prop back.
6. **`DocumentsContent` takes `{ projectId, isRtl }`.** Same as above.
7. **`uiStore` is the canonical UI state store.** Do not add language/suite/toast to `StoreContext`.
8. **`StoreContext` re-exports `useToast` from `uiStore`.** This keeps backward compat for unmigrated pages.
9. **All route-level components are lazy-loaded.** Layouts and auth pages are the only exceptions.
10. **`typecheck` and `test` must stay green.** Run both before committing any change.
11. **Message `threadId` = tenant's `session.userId`.** Format: `mock-<email>` in mock mode. Never use a flat shared thread — each tenant has their own isolated thread.
12. **Logout always navigates to `/` (SuiteHub), never `/login`.** Navigating to `/login` after logout shows the portal picker which looks broken.
13. **Tenant notifications are in `db.tenantNotifications[tenantEmail]`, not `db.notifications`.** Management notifications are in `db.notifications`. Never mix the two buckets.
14. **`NotificationBell` is role-aware.** It reads from the tenant bucket for `role === 'tenant'` and the management bucket for all other roles. Do not revert this to a single global query.
15. **Technician `technicianId` is derived from `session.email` in mock mode.** `salem@mdrar.sa` → `tech-1`, `fahad@mdrar.sa` → `tech-2`. When implementing Supabase, join the technicians table by `userId` instead.

---

## Quick Reference: Adding a New Page

1. Create the page file in the appropriate `src/pages/` subfolder
2. Use React Query hooks from `src/queries/` for all data — never `useStore` for server data
3. Add a lazy import in `App.tsx`
4. Add the route in `AppRoutes` wrapped in `RequireRole` with the correct roles
5. Add nav item to the relevant layout if needed
6. Add i18n keys to both `ar/common.json` and `en/common.json`

## Quick Reference: Adding a New Query Hook

1. Add the method to `DataSource` interface in `src/data/client/dataSource.ts`
2. Implement it in `src/data/client/mock/[domain].mock.ts`
3. Add a stub in `src/data/client/supabase/[domain].supabase.ts`
4. Add the hook to the relevant `src/queries/use[Domain].ts` file
5. Export the cache key factory if it's a new domain

## Quick Reference: Demo Credentials

| Portal | Email | Password | Role |
|---|---|---|---|
| Management | khalid@mdrar.sa | password | management |
| Tenant | m.alotaibi@example.com | password | tenant |
| PM | pm@mdrar.sa | password | pm_manager |
| Technician | salem@mdrar.sa | password | technician (tech-1) |
| Technician | fahad@mdrar.sa | password | technician (tech-2) |
