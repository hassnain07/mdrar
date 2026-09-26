# MDRAR Platform — Project Context

## What Is This

MDRAR is a bilingual (Arabic/English, RTL/LTR) property and project management platform built as a React SPA. It is a **prototype** — all data is currently served from an in-memory mock backend. A Supabase migration path is fully scaffolded and ready to activate via an env var.

The platform has three suites accessible from a central hub:

| Suite | Path prefix | Roles allowed |
|---|---|---|
| Facility Management (FM) | `/management`, `/tenant` | `management`, `tenant` |
| Project Management (PM) | `/pm` | `pm_manager`, `pm_viewer`, `management` |
| Hub (entry point) | `/` | public |

---

## Tech Stack

| Concern | Library / Tool |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite 5 |
| Routing | React Router v7 |
| Server state | TanStack React Query v5 |
| UI state | Custom `useReducer` context (`uiStore`) |
| Styling | Tailwind CSS v3 (custom theme) |
| i18n | i18next + react-i18next |
| Validation | Zod v4 |
| Charts | Recharts |
| Icons | Lucide React |
| Auth | Custom `AuthProvider` wrapping `dataSource.auth` |
| Backend (mock) | In-memory JS objects, persisted to `localStorage` under `mdrar-state-v4` |
| Backend (prod) | Supabase (stubbed, activated via `VITE_DATA_SOURCE=supabase`) |
| Testing | Vitest + jsdom + Testing Library |

---

## Directory Structure

```
src/
├── App.tsx                        # Root: providers, lazy routes, ErrorBoundary
├── main.tsx                       # Entry point, i18n init
├── i18n.ts                        # i18next config (ar + en, namespaces: translation, pm)
├── types.ts                       # ALL shared TypeScript types and the Action union
│
├── auth/
│   ├── AuthProvider.tsx           # Session state, signIn (returns Session), signOut
│   └── ProtectedRoute.tsx         # ProtectedRoute + RequireRole components
│
├── state/
│   └── uiStore.tsx                # UiProvider, useUi, useToast — language, suite, toast, sidebar
│
├── store/
│   └── StoreContext.tsx           # Legacy StoreProvider, useStore — still used by layouts + unmigrated pages
│
├── data/
│   ├── mockData.ts                # initialState: properties, requests, users, technicians, lease, messages
│   ├── pmMockData.ts              # projects, projectActivities, projectDocuments, projectRisks, projectIpcEntries
│   └── client/
│       ├── dataSource.ts          # DataSource interface (the contract all backends must implement)
│       ├── index.ts               # Exports `dataSource` — picks mock or supabase via VITE_DATA_SOURCE
│       ├── schemas.ts             # Zod schemas for all create/update inputs
│       ├── mock/                  # In-memory mock implementation (14 files, one per domain)
│       │   ├── index.ts           # Assembles mockDataSource from all mock modules
│       │   ├── auth.mock.ts
│       │   ├── properties.mock.ts
│       │   ├── requests.mock.ts
│       │   ├── technicians.mock.ts
│       │   ├── users.mock.ts
│       │   ├── messages.mock.ts
│       │   ├── notifications.mock.ts
│       │   ├── preferences.mock.ts
│       │   ├── projects.mock.ts
│       │   ├── activities.mock.ts
│       │   ├── documents.mock.ts
│       │   ├── risks.mock.ts
│       │   ├── ipc.mock.ts
│       │   └── storage.mock.ts    # Returns blob:// URLs, no base64
│       └── supabase/              # Supabase stubs (not yet implemented, structure mirrors mock/)
│
├── queries/                       # React Query hooks — one file per domain
│   ├── useRequests.ts             # useRequestList, useRequest, useCreateRequest, useUpdateRequest, useAddTimelineEvent
│   ├── useProperties.ts           # usePropertyList, useProperty
│   ├── useProjects.ts             # useProjectList, useProject, useCreateProject, useUpdateProject, unit/instance CRUD
│   ├── useActivities.ts           # useActivityList, useCreateActivity, useUpdateActivity, useDeleteActivity, useAddActivityPhoto
│   ├── useDocuments.ts            # useDocumentList, useCreateDocument, useUpdateDocument, useDeleteDocument, useRenameDocumentCategory
│   ├── useRisks.ts                # useRiskList, useCreateRisk, useUpdateRisk, useDeleteRisk, useAddRiskPhoto
│   ├── useIpc.ts                  # useIpcList, useCreateIpc, useUpdateIpc, useDeleteIpc, useAddIpcAttachment
│   └── useShared.ts               # useNotificationList, useMarkNotificationsRead, useMessageList, useSendMessage,
│                                  # usePreferences, useUpdatePreferences, useTechnicianList, useUserList, useCreateUser
│
├── components/
│   ├── layouts/
│   │   ├── SuiteHub.tsx           # Home screen: FM card → /facility, PM card → /login?portal=pm
│   │   ├── LandingPage.tsx        # FM portal picker: Management → /login?portal=management, Tenant → /login?portal=tenant
│   │   ├── ManagementLayout.tsx   # Sidebar layout for /management/* routes
│   │   ├── PmLayout.tsx           # Sidebar layout for /pm/* routes
│   │   └── TenantLayout.tsx       # Top-nav + bottom-nav layout for /tenant/* routes
│   ├── shared/
│   │   ├── Brand.tsx
│   │   ├── LanguageSwitcher.tsx
│   │   ├── NotificationBell.tsx
│   │   └── SuiteSwitcher.tsx
│   └── ui/
│       ├── ErrorBoundary.tsx      # Class-based React ErrorBoundary with reload button
│       ├── PageStates.tsx         # PageSkeleton (pulse animation) + PageError (with retry)
│       ├── Badge.tsx / Badges.tsx
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Modal.tsx
│       ├── PageHeader.tsx
│       └── Toast.tsx
│
├── pages/
│   ├── LoginPage.tsx              # Portal picker + login form; reads portal from location.state
│   ├── UnauthorizedPage.tsx
│   ├── management/
│   │   ├── ManagementDashboard.tsx    # Uses useRequestList + usePropertyList (migrated)
│   │   ├── ManagementRequests.tsx     # Uses useRequestList (migrated)
│   │   ├── ManagementRequestDetail.tsx # Still uses useStore (not yet migrated)
│   │   ├── PropertyDetail.tsx         # Still uses useStore (not yet migrated)
│   │   ├── Reports.tsx                # Still uses useStore (not yet migrated)
│   │   ├── UsersPage.tsx              # Still uses useStore (not yet migrated)
│   │   └── ManagementSettings.tsx     # Still uses useStore (not yet migrated)
│   ├── tenant/
│   │   ├── TenantHome.tsx             # Uses useRequestList + useAuth (migrated)
│   │   ├── ResidentSupport.tsx        # Still uses useStore (not yet migrated)
│   │   ├── MyRequests.tsx             # Still uses useStore (not yet migrated)
│   │   ├── TenantRequestDetail.tsx    # Still uses useStore (not yet migrated)
│   │   ├── ContactManager.tsx         # Still uses useStore (not yet migrated)
│   │   ├── TenantSettings.tsx         # Still uses useStore (not yet migrated)
│   │   ├── TenantProfile.tsx          # Still uses useStore (not yet migrated)
│   │   └── EmergencyContact.tsx       # Still uses useStore (not yet migrated)
│   └── pm/
│       ├── PmDashboard.tsx            # Uses useProjectList (migrated)
│       ├── ProjectDetail.tsx          # Thin container, delegates to tab components
│       ├── ProjectOverviewTab.tsx     # Charts, IPC summary, report export
│       ├── ProjectActivitiesTab.tsx   # Gantt-style list, CRUD, file upload via dataSource.storage
│       ├── ProjectRisksTab.tsx        # Risk CRUD, file upload via dataSource.storage
│       ├── ProjectUnitsTab.tsx        # Unit types + unit instances CRUD
│       ├── ProjectQuantityTab.tsx     # Quantity/cost table
│       ├── ProjectEditModal.tsx       # Uses useUpdateProject
│       ├── DocumentsContent.tsx       # Uses useDocumentList + document CRUD hooks (migrated)
│       ├── IpcContent.tsx             # Uses useIpcList + IPC CRUD hooks (migrated)
│       ├── AddProject.tsx
│       ├── ExecutivePage.tsx
│       └── FinanceComingSoon.tsx
│
├── lib/
│   ├── helpers.ts                 # genId(), formatSar(), date helpers
│   └── reportGenerator.ts        # PDF/Excel export utilities
│
├── locales/
│   ├── ar/
│   │   ├── common.json            # Default namespace (translation)
│   │   └── projectManagement.json # pm namespace
│   └── en/
│       ├── common.json
│       └── projectManagement.json
│
└── test/
    ├── setup.ts                   # jest-dom matchers + URL.createObjectURL mock
    ├── auth.test.ts               # 7 tests: sign-in, roles, persistence, sign-out, listeners
    ├── mockAdapters.test.ts       # 7 tests: requests CRUD, projects, activities
    └── storage.test.ts            # 2 tests: upload returns blob URL, remove
```

---

## Authentication & Navigation Flow

```
/ (SuiteHub)
├── Facility Management → /facility (LandingPage)
│   ├── Owner/Manager → /login { state: { portal: 'management' } }
│   └── Resident     → /login { state: { portal: 'tenant' } }
└── Project Management → /login { state: { portal: 'pm' } }

/login
  - Reads portal from location.state to skip the portal picker
  - Pre-fills demo credentials (email + 'password')
  - On success: signIn() returns Session → redirects by role:
      management  → /management
      tenant      → /tenant
      pm_manager  → /pm/dashboard
      pm_viewer   → /pm/dashboard
  - If navigated to directly (no portal state): shows 3-card portal picker first
```

### Demo Credentials

| Portal | Email | Password | Role |
|---|---|---|---|
| Management | khalid@mdrar.sa | password | management |
| Tenant | m.alotaibi@example.com | password | tenant |
| PM | pm@mdrar.sa | password | pm_manager |

### Route Guards

- `ProtectedRoute` — redirects to `/login` if no session
- `RequireRole` — redirects to `/unauthorized` if role not in allowed list
- All `/management/*`, `/tenant/*`, `/pm/*` routes are wrapped in `RequireRole`
- `/pm` redirect is also wrapped in `RequireRole` (prevents auth bypass)

---

## State Architecture

### Two separate stores

**`uiStore` (canonical UI state)**
- Managed by `UiProvider` / `useUi`
- Holds: `language`, `currentSuite`, `toast`, `sidebarOpen`
- Persisted to `localStorage` under key `mdrar_ui`
- Used by: `App.tsx` (LanguageSync), all layouts, all pages

**`StoreContext` (legacy server-mirror state)**
- Managed by `StoreProvider` / `useStore`
- Holds: all FM data (requests, properties, users, technicians, messages, preferences, lease, notifications) + PM data (projects, activities, documents, risks, IPC entries)
- Persisted to `localStorage` under key `mdrar-state-v4`
- Still used by: layouts (for emergency badge count), unmigrated pages
- Being phased out — migrated pages use React Query hooks instead

### React Query (server state — the target architecture)
- `QueryClient` configured with `retry: 1`, `staleTime: 30_000`
- All hooks in `src/queries/` call `dataSource.*` methods
- Cache keys follow the pattern: `[domain, 'list', filters?]` and `[domain, 'detail', id]`
- Mutations invalidate relevant query keys on success

---

## DataSource Interface

Defined in `src/data/client/dataSource.ts`. All backends must implement this interface exactly.

**Domains:** `auth`, `properties`, `requests`, `technicians`, `users`, `messages`, `notifications`, `preferences`, `projects`, `activities`, `documents`, `risks`, `ipc`, `storage`

**Switching backends:** Set `VITE_DATA_SOURCE=supabase` in `.env.local`. Default is `mock`.

**File uploads:** Always go through `dataSource.storage.upload(bucket, path, file)` which returns `{ url: string, path: string }`. No base64 anywhere in the codebase.

---

## i18n

- Default language: Arabic (`ar`)
- Namespaces: `translation` (common.json) and `pm` (projectManagement.json)
- Usage: `t('key')` for common, `t('pm:key')` for PM namespace
- RTL detection: `ui.language === 'ar'` → `isRtl` boolean used throughout
- HTML `dir` and `lang` attributes are synced by `UiProvider` and `LanguageSync` in `App.tsx`
- Language persisted in `localStorage` under `mdrar_ui`

---

## Key Conventions

- `genId()` from `src/lib/helpers.ts` — generates all new entity IDs
- `formatSar(n)` from `src/lib/helpers.ts` — formats SAR currency
- All bilingual fields follow the pattern: `name` (Arabic) + `nameEn` (English)
- `IpcContent` takes `{ projectId: string, isRtl: boolean }` — project fetched internally
- `DocumentsContent` takes `{ projectId: string, isRtl: boolean }` — project fetched internally
- Layouts (`ManagementLayout`, `PmLayout`, `TenantLayout`) still import `useStore` for the emergency badge count — this is acceptable legacy usage
- `StoreContext.tsx` re-exports `useToast` from `uiStore` for backward compatibility

---

## Build & Scripts

```bash
npm run dev          # Vite dev server
npm run build        # Production build
npm run typecheck    # tsc --noEmit (0 errors expected)
npm run test         # Vitest run (16/16 tests pass)
npm run test:watch   # Vitest watch mode
npm run lint         # ESLint
```

---

## Environment Variables

```env
VITE_DATA_SOURCE=mock          # or 'supabase'
VITE_SUPABASE_URL=             # required if supabase
VITE_SUPABASE_ANON_KEY=        # required if supabase
```

---

## Pages Not Yet Migrated to React Query

These pages still read from `useStore` for server data. They work correctly because mock data is seeded into `StoreContext` on load. Migration follows the same pattern as the already-migrated pages.

- `ManagementRequestDetail`, `PropertyDetail`, `Reports`, `UsersPage`, `ManagementSettings`
- `ResidentSupport`, `MyRequests`, `TenantRequestDetail`, `ContactManager`, `TenantSettings`, `TenantProfile`, `EmergencyContact`
