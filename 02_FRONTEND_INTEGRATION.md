# MDRAR Platform — Frontend Integration (Run This Second)

**Prerequisite:** `01_SUPABASE_BACKEND.md` has been applied to a Supabase project (schema, RLS,
triggers, storage, realtime) and at least the seed users from its Section 18 exist.

**What this file contains:** the exact file-by-file changes needed so the existing React app talks
to that backend instead of the mock. The codebase already has the right shape for this — a
`DataSource` interface (`src/data/client/dataSource.ts`), a mock implementation, and an _unimplemented_
Supabase stub (`src/data/client/supabase/index.ts`, every method throws `notImpl(...)`). This file
replaces the stub with a real implementation and finishes the handful of pages that still bypass the
`DataSource` abstraction entirely (`context.md`'s "Pages Not Yet Migrated to React Query" list).

Work through the sections in order. After each section, run `npm run typecheck` before moving on.

---

## 1. Environment

Edit `.env.local` (create it from `.env.example` if it doesn't exist):

```env
VITE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
VITE_MOCK_LATENCY_MS=350
VITE_MOCK_FAILURE_RATE=0
```

Both values come from **Supabase Dashboard → Project Settings → API**. Use the `anon`/`public` key
only — never the `service_role` key in frontend code (the seed script in Section 10 is the one place
`service_role` is used, and it runs in Node, never shipped to the browser).

No new npm dependencies are required — `@supabase/supabase-js` is already in `package.json`.

---

## 2. `src/types.ts` — additions

Add these types (the backend now has entities the frontend types don't yet model: leases,
property-level documents, and per-project document categories as real records instead of a fixed
enum):

```ts
// Add near FmUnit/FmDocument — replaces both going forward (see Section 8)
export interface Lease {
  id: string;
  propertyId: string;
  tenantId?: string;
  unit: string;
  tenantName: string;
  tenantEmail?: string;
  termStart: string;
  termEnd: string;
  rent: number;
  deposit: number;
  rentStatus: "paid" | "due";
  status: "occupied" | "vacant";
}

export interface PropertyDocument {
  id: string;
  propertyId: string;
  name: string;
  nameEn: string;
  type: string;
  fileUrl?: string;
  uploadDate: string;
}

// Replaces the DocumentCategory string-union: categories are now real per-project records.
export interface DocumentCategoryRecord {
  id: string;
  projectId: string;
  key: string;
  name: string;
  nameEn: string;
  isDefault: boolean;
}
```

Change `ProjectDocument.category` from `DocumentCategory` to `categoryId: string` (the FK), and keep
a denormalized `categoryName`/`categoryNameEn` on the type for convenient rendering without an extra
join in every list view:

```ts
export interface ProjectDocument {
  id: string;
  name: string;
  nameEn: string;
  type: string;
  uploadDate: string;
  categoryId: string;
  categoryName: string;
  categoryNameEn: string;
}
```

Remove `documentCategoryNames` and `customDocumentCategories` from `Project` — that responsibility
now belongs entirely to `document_categories` rows, fetched via a new `documents.listCategories()`
method (Section 3). Remove `FmUnit`/`FmDocument`/`Lease` (old shape)/`ADD_FM_UNIT`/`ADD_FM_DOCUMENT`
from the `Action` union and `AppState` — `StoreContext` is retired in this pass (Section 8).

---

## 3. `src/data/client/dataSource.ts` — additions

### 3.0 `Session` needs a real `technicianId`

`TechnicianDashboard.tsx` currently resolves "which requests are mine" with a hardcoded hack:

```ts
// current code — src/pages/technician/TechnicianDashboard.tsx
const technicianId =
  session?.email === "salem@mdrar.sa"
    ? "tech-1"
    : session?.email === "fahad@mdrar.sa"
      ? "tech-2"
      : (session?.userId ?? "");
```

This only works because the mock hardcodes `tech-1`/`tech-2` as IDs for those two specific seed
emails. Against the real backend, `technicians.id` is a generated UUID with no relationship to the
signed-in technician's email or `profiles.id` — this code would silently show the wrong technician's
requests (or none) for every technician. Fix it at the source: add `technicianId` to `Session` and
populate it once at sign-in, the same way `tenantPropertyId` already works for tenants.

```ts
// src/data/client/dataSource.ts — Session
export interface Session {
  userId: string;
  email: string;
  role: "tenant" | "management" | "pm_manager" | "pm_viewer" | "technician";
  managementRole?: ManagementRole;
  name: string;
  tenantPropertyId?: string;
  tenantUnit?: string;
  /** For technician sessions — technicians.id (NOT profiles.id) used to filter assigned requests */
  technicianId?: string;
  expiresAt: number;
}
```

Populate it in `getSupabaseSession()` (Section 6.1 below) and update `TechnicianDashboard.tsx`:

```ts
// src/pages/technician/TechnicianDashboard.tsx — replace the hack with:
const technicianId = session?.technicianId ?? "";
```

The mock adapter's `getSession()`/`signInWithPassword()` should also set `technicianId` (from
`db.technicians.find(t => t.profileId ...)` or simply keep returning `'tech-1'`/`'tech-2'` there,
matching mock, since only the Supabase adapter needs the real fix — mock mode is unaffected either
way since it's shipped/tested code today).

Add a `leases` domain, replace `documents` methods that referenced the old category model, and add a
`documents.listCategories()` / `documents.addCategory()` / `documents.renameCategory()` /
`documents.removeCategory()` set that operate on `DocumentCategoryRecord` instead of the enum:

```ts
export type LeaseInput = Omit<Lease, "id">;
export type PropertyDocumentInput = Omit<PropertyDocument, "id" | "uploadDate">;

export interface DataSource {
  // ...existing domains unchanged...

  leases: {
    list(propertyId?: string): Promise<Lease[]>;
    create(input: LeaseInput): Promise<Lease>;
    update(id: string, changes: Partial<Lease>): Promise<Lease>;
    delete(id: string): Promise<void>;
  };

  propertyDocuments: {
    list(propertyId: string): Promise<PropertyDocument[]>;
    upload(propertyId: string, file: File): Promise<PropertyDocument>;
    delete(propertyId: string, documentId: string): Promise<void>;
  };

  documents: {
    list(
      projectId: string,
      params?: PaginationParams,
    ): Promise<PaginatedResult<ProjectDocument>>;
    listCategories(projectId: string): Promise<DocumentCategoryRecord[]>;
    upload(
      projectId: string,
      file: File,
      categoryId: string,
    ): Promise<ProjectDocument>;
    /** Manual add (no file) — DocumentsContent.tsx's "or add manually" form uses this */
    create(
      projectId: string,
      categoryId: string,
      doc: { name: string; nameEn: string; type: string; uploadDate: string },
    ): Promise<ProjectDocument>;
    update(
      projectId: string,
      documentId: string,
      changes: Partial<Pick<ProjectDocument, "name" | "nameEn" | "categoryId">>,
    ): Promise<ProjectDocument>;
    delete(projectId: string, documentId: string): Promise<void>;
    renameCategory(
      projectId: string,
      categoryId: string,
      names: { name: string; nameEn: string },
    ): Promise<void>;
    addCategory(
      projectId: string,
      names: { name: string; nameEn: string },
    ): Promise<DocumentCategoryRecord>;
    removeCategory(projectId: string, categoryId: string): Promise<void>;
  };
}
```

Everything else in the interface (`auth`, `properties`, `requests`, `technicians`, `users`,
`messages`, `notifications`, `preferences`, `projects`, `activities`, `risks`, `ipc`,
`announcements`, `storage`) stays exactly as it is today — the Supabase adapter implements it
as-is, no interface changes needed there.

---

## 4. `src/data/client/supabase/client.ts` — no change

The existing file is already correct:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient =
  url && key
    ? createClient(url, key)
    : new Proxy({} as SupabaseClient, {
        get(_t, prop) {
          if (prop === "then") return undefined;
          throw new Error(
            "VITE_DATA_SOURCE=supabase requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to be set in .env.local",
          );
        },
      });
```

Leave it as-is.

---

## 5. `src/data/client/supabase/mappers.ts` — new file

One mapper per table, converting snake_case DB rows to the camelCase shapes in `types.ts`. Keeping
these in one file (instead of scattered across every adapter) makes it trivial to audit the full
snake_case ↔ camelCase boundary in one place:

```ts
import type {
  Property,
  Request,
  TimelineEvent,
  Technician,
  User,
  Message,
  Preferences,
  Notification,
  Announcement,
  Lease,
  PropertyDocument,
  Project,
  ProjectUnit,
  UnitInstance,
  ProjectActivity,
  ActivityPhoto,
  ProjectDocument,
  DocumentCategoryRecord,
  ProjectRisk,
  IpcEntry,
  IpcAttachment,
} from "@/types";

export function mapProperty(r: any): Property {
  return {
    id: r.id,
    name: r.name,
    nameEn: r.name_en,
    location: r.location,
    units: r.units,
    occupied: r.occupied,
    openRequests: r.open_requests ?? 0,
    emergency: r.emergency ?? 0,
    accent: r.accent,
    unitLabels: r.unit_labels ?? [],
  };
}

export function mapTimelineEvent(r: any): TimelineEvent {
  return {
    id: r.id,
    status: r.status,
    label: r.label,
    time: r.created_at,
    actor: r.actor,
  };
}

export function mapRequest(r: any, timeline: TimelineEvent[] = []): Request {
  return {
    id: r.id,
    propertyId: r.property_id,
    unit: r.unit,
    tenant: r.tenant_name,
    tenantEmail: r.tenant_email,
    type: r.type,
    category: r.category,
    description: r.description,
    status: r.status,
    priority: r.priority,
    date: r.created_at,
    photo: r.photo_url ?? undefined,
    technicianId: r.technician_id ?? undefined,
    timeline,
  };
}

export function mapTechnician(r: any): Technician {
  return {
    id: r.id,
    name: r.name,
    nameEn: r.name_en,
    specialty: r.specialty,
    resolved: r.resolved_count,
    sla: r.sla,
  };
}

export function mapUser(r: any): User {
  return {
    id: r.id,
    name: r.full_name,
    email: r.email,
    role: r.role,
    properties: r.properties ?? [],
  };
}

export function mapMessage(r: any): Message {
  return {
    id: r.id,
    from: r.sender_role,
    text: r.text,
    textEn: r.text_en,
    time: r.created_at,
  };
}

export function mapNotification(r: any): Notification {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    time: r.created_at,
    read: r.read,
    emergency: r.emergency,
    projectId: r.project_id ?? undefined,
  };
}

export function mapPreferences(r: any): Preferences {
  return {
    immediateEmergency: r.immediate_emergency,
    dailySummary: r.daily_summary,
    smsAlerts: r.sms_alerts,
    requestUpdates: r.request_updates,
    announcements: r.announcements,
    rentReminders: r.rent_reminders,
  };
}

export function mapAnnouncement(r: any): Announcement {
  return {
    id: r.id,
    title: r.title,
    titleEn: r.title_en,
    body: r.body,
    bodyEn: r.body_en,
    propertyId: r.property_id ?? "all",
    createdAt: r.created_at,
    createdBy: r.created_by ?? "",
  };
}

export function mapLease(r: any): Lease {
  return {
    id: r.id,
    propertyId: r.property_id,
    tenantId: r.tenant_id ?? undefined,
    unit: r.unit,
    tenantName: r.tenant_name,
    tenantEmail: r.tenant_email ?? undefined,
    termStart: r.term_start,
    termEnd: r.term_end,
    rent: Number(r.rent),
    deposit: Number(r.deposit),
    rentStatus: r.rent_status,
    status: r.status,
  };
}

export function mapPropertyDocument(r: any): PropertyDocument {
  return {
    id: r.id,
    propertyId: r.property_id,
    name: r.name,
    nameEn: r.name_en,
    type: r.type,
    fileUrl: r.file_url ?? undefined,
    uploadDate: r.uploaded_at,
  };
}

export function mapProject(
  r: any,
  unitTypes: ProjectUnit[] = [],
  unitInstances: UnitInstance[] = [],
): Project {
  return {
    id: r.id,
    name: r.name,
    nameEn: r.name_en,
    location: r.location,
    locationEn: r.location_en,
    totalUnits: r.total_units,
    unitTypes,
    unitInstances,
    startDate: r.start_date,
    endDate: r.end_date,
    totalDays: r.total_days,
    contractor: r.contractor,
    contractorEn: r.contractor_en,
    budget: Number(r.budget),
    status: r.status,
    description: r.description ?? undefined,
    descriptionEn: r.description_en ?? undefined,
    contractNumber: r.contract_number ?? undefined,
    consultant: r.consultant ?? undefined,
    consultantEn: r.consultant_en ?? undefined,
  };
}

export function mapUnitType(r: any): ProjectUnit {
  return {
    id: r.id,
    type: r.type,
    typeEn: r.type_en,
    size: Number(r.size),
    bedrooms: r.bedrooms,
    unitCount: r.unit_count,
    image: r.image_url ?? "",
    floorPlan: r.floor_plan_url ?? "",
    model3d: r.model_3d_url ?? "",
    brochure: r.brochure_url ?? "",
    category: r.category ?? undefined,
  };
}

export function mapUnitInstance(r: any): UnitInstance {
  return {
    id: r.id,
    modelId: r.model_id,
    label: r.label,
    labelEn: r.label_en,
    floor: r.floor,
    status: r.status,
    floorPlan: r.floor_plan_url ?? "",
    model3d: r.model_3d_url ?? "",
    brochure: r.brochure_url ?? "",
    price: r.price != null ? Number(r.price) : undefined,
    space: r.space != null ? Number(r.space) : undefined,
    attachmentName: r.attachment_name ?? undefined,
    floorLevel: r.floor_level ?? undefined,
    townhouseType: r.townhouse_type ?? undefined,
  };
}

export function mapActivityPhoto(r: any): ActivityPhoto {
  return {
    id: r.id,
    dataUrl: r.file_url,
    uploadDate: r.uploaded_at,
    fileType: r.file_type,
    fileName: r.file_name ?? undefined,
  };
}

export function mapActivity(
  r: any,
  photos: ActivityPhoto[] = [],
): ProjectActivity {
  return {
    id: r.id,
    activityId: r.activity_code,
    name: r.name,
    nameEn: r.name_en,
    phase: r.phase,
    startDay: r.start_day,
    endDay: r.end_day,
    duration: r.duration,
    percentComplete: r.percent_complete,
    actualProgress: r.actual_progress ?? undefined,
    status: r.status,
    team: r.team,
    teamEn: r.team_en,
    description: r.description,
    descriptionEn: r.description_en,
    actualCost: Number(r.actual_cost),
    plannedCost: Number(r.planned_cost),
    changeOrderAmount: Number(r.change_order_amount ?? 0),
    startDate: r.start_date ?? undefined,
    endDate: r.end_date ?? undefined,
    actualStartDate: r.actual_start_date ?? undefined,
    actualEndDate: r.actual_end_date ?? undefined,
    photos,
  };
}

export function mapDocumentCategory(r: any): DocumentCategoryRecord {
  return {
    id: r.id,
    projectId: r.project_id,
    key: r.key,
    name: r.name,
    nameEn: r.name_en,
    isDefault: r.is_default,
  };
}

export function mapProjectDocument(
  r: any,
  category: DocumentCategoryRecord,
): ProjectDocument {
  return {
    id: r.id,
    name: r.name,
    nameEn: r.name_en,
    type: r.type,
    uploadDate: r.uploaded_at,
    categoryId: r.category_id,
    categoryName: category.name,
    categoryNameEn: category.name_en,
  };
}

export function mapRisk(r: any, photos: ActivityPhoto[] = []): ProjectRisk {
  return {
    id: r.id,
    name: r.name,
    nameEn: r.name_en,
    dateRaised: r.date_raised,
    responsible: r.responsible,
    responsibleEn: r.responsible_en,
    description: r.description,
    descriptionEn: r.description_en,
    deadline: r.deadline ?? "",
    reason: r.reason,
    reasonEn: r.reason_en,
    photos,
    result: r.result,
  };
}

export function mapIpcAttachment(r: any): IpcAttachment {
  return {
    id: r.id,
    fileName: r.file_name,
    fileType: r.file_type,
    uploadDate: r.uploaded_at,
  };
}

export function mapIpc(r: any, attachments: IpcAttachment[] = []): IpcEntry {
  return {
    id: r.id,
    projectId: r.project_id,
    direction: r.direction,
    source: r.source ?? undefined,
    partyName: r.party_name ?? undefined,
    partyNameEn: r.party_name_en ?? undefined,
    reference: r.reference ?? undefined,
    activityId: r.activity_id ?? undefined,
    amount: Number(r.amount),
    description: r.description,
    descriptionEn: r.description_en ?? undefined,
    status: r.status,
    dateLogged: r.date_logged,
    attachments,
  };
}

export function throwIfError(
  error: { message: string; code?: string } | null,
): void {
  if (error) throw { code: "UNKNOWN", message: error.message };
}
```

---

## 6. `src/data/client/supabase/index.ts` — full replacement

Replace the entire file (every `notImpl(...)` body) with the real implementation below. It's split
into logical blocks in this doc for readability, but goes into the single existing file.

### 6.1 Auth

```ts
import type { DataSource, Session, PaginatedResult } from '@/data/client/dataSource';
import { supabase } from './client';
import * as M from './mappers';

async function getSupabaseSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, role, tenant_property_id, tenant_unit')
    .eq('id', data.session.user.id)
    .single();
  if (error || !profile) return null;

  const roleMap: Record<string, Session['role']> = {
    tenant: 'tenant', pm_manager: 'pm_manager', pm_viewer: 'pm_viewer', technician: 'technician',
  };
  const role: Session['role'] = roleMap[profile.role] ?? 'management';

  let technicianId: string | undefined;
  if (profile.role === 'technician') {
    const { data: tech } = await supabase.from('technicians').select('id').eq('profile_id', data.session.user.id).single();
    technicianId = tech?.id;
  }

  return {
    userId: data.session.user.id,
    email: data.session.user.email ?? '',
    role,
    managementRole: role === 'management' || role === 'technician' ? profile.role : undefined,
    name: profile.full_name,
    tenantPropertyId: profile.tenant_property_id ?? undefined,
    tenantUnit: profile.tenant_unit ?? undefined,
    technicianId,
    expiresAt: new Date(data.session.expires_at ? data.session.expires_at * 1000 : 0).getTime(),
  };
}

export const supabaseDataSource: DataSource = {
  auth: {
    async getSession() { return getSupabaseSession(); },
    async signInWithPassword(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) throw { code: 'UNAUTHORIZED', message: error?.message ?? 'Sign in failed' };
      const session = await getSupabaseSession();
      if (!session) throw { code: 'UNAUTHORIZED', message: 'No profile found for this account' };
      return session;
    },
    async signOut() { await supabase.auth.signOut(); },
    onAuthStateChange(cb) {
      const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!session) { cb(null); return; }
        cb(await getSupabaseSession());
      });
      return () => data.subscription.unsubscribe();
    },
  },
  // ...continued in 6.2 onward, same object literal
```

### 6.2 Properties

```ts
  properties: {
    async list(params) {
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize;
      let q = supabase.from('properties_with_stats').select('*', { count: 'exact' }).order('name_en');
      if (pageSize) q = q.range((page - 1) * pageSize, page * pageSize - 1);
      const { data, error, count } = await q;
      M.throwIfError(error);
      return { data: (data ?? []).map(M.mapProperty), total: count ?? 0 };
    },
    async get(id) {
      const { data, error } = await supabase.from('properties_with_stats').select('*').eq('id', id).single();
      M.throwIfError(error);
      return M.mapProperty(data);
    },
    async create(input) {
      const { data, error } = await supabase.from('properties').insert({
        name: input.name, name_en: input.nameEn, location: input.location,
        units: input.units, occupied: input.occupied, accent: input.accent, unit_labels: input.unitLabels ?? [],
      }).select().single();
      M.throwIfError(error);
      return M.mapProperty({ ...data, open_requests: 0, emergency: 0 });
    },
  },
```

### 6.3 Requests

```ts
  requests: {
    async list(filters, params) {
      let q = supabase.from('requests').select('*', { count: 'exact' }).order('created_at', { ascending: false });
      if (filters?.propertyId) q = q.eq('property_id', filters.propertyId);
      if (filters?.status) q = q.eq('status', filters.status);
      if (filters?.tenantId) q = q.eq('tenant_id', filters.tenantId);
      if (filters?.technicianId) q = q.eq('technician_id', filters.technicianId);
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize;
      if (pageSize) q = q.range((page - 1) * pageSize, page * pageSize - 1);
      const { data, error, count } = await q;
      M.throwIfError(error);
      return { data: (data ?? []).map((r) => M.mapRequest(r)), total: count ?? 0 };
    },
    async get(id) {
      const { data: r, error } = await supabase.from('requests').select('*').eq('id', id).single();
      M.throwIfError(error);
      const { data: tl } = await supabase.from('request_timeline_events').select('*').eq('request_id', id).order('created_at');
      return M.mapRequest(r, (tl ?? []).map(M.mapTimelineEvent));
    },
    async create(input) {
      const { data: idRow, error: idErr } = await supabase.rpc('next_request_id');
      M.throwIfError(idErr);
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('requests').insert({
        id: idRow as string,
        property_id: input.propertyId, unit: input.unit,
        tenant_id: sessionData.session?.user.id ?? null,
        tenant_name: input.tenant, tenant_email: input.tenantEmail,
        type: input.type, category: input.category, description: input.description,
        status: input.status ?? 'submitted', priority: input.priority ?? 'normal',
        photo_url: input.photo ?? null, technician_id: input.technicianId ?? null,
      }).select().single();
      M.throwIfError(error);
      // The requests_notify_new trigger (Section 12 of the backend doc) fires automatically —
      // no client-side notifications.push() call needed or wanted here.
      return M.mapRequest(data, []);
    },
    async update(id, changes) {
      const patch: Record<string, unknown> = {};
      if (changes.status !== undefined) patch.status = changes.status;
      if (changes.priority !== undefined) patch.priority = changes.priority;
      if (changes.technicianId !== undefined) patch.technician_id = changes.technicianId;
      if (changes.description !== undefined) patch.description = changes.description;
      const { data, error } = await supabase.from('requests').update(patch).eq('id', id).select().single();
      M.throwIfError(error);
      const { data: tl } = await supabase.from('request_timeline_events').select('*').eq('request_id', id).order('created_at');
      return M.mapRequest(data, (tl ?? []).map(M.mapTimelineEvent));
    },
    async addTimelineEvent(id, event) {
      const { data: sessionData } = await supabase.auth.getSession();
      const { error } = await supabase.from('request_timeline_events').insert({
        request_id: id, status: event.status, label: event.label,
        actor: event.actor, actor_id: sessionData.session?.user.id ?? null,
      });
      M.throwIfError(error);
      // request_timeline_notify trigger fans out to tenant + management automatically.
      return this.get ? await (supabaseDataSource.requests.get(id)) : (undefined as never);
    },
  },
```

### 6.4 Technicians, users, messages

```ts
  technicians: {
    async list() {
      const { data, error } = await supabase.from('technicians').select('*').order('name_en');
      M.throwIfError(error);
      return (data ?? []).map(M.mapTechnician);
    },
  },
  users: {
    async list() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('role', ['super_admin', 'facility_manager', 'technician', 'owner'])
        .order('full_name');
      M.throwIfError(error);
      const { data: pmRows } = await supabase.from('property_managers').select('profile_id, property_id');
      return (data ?? []).map((r) => M.mapUser({
        ...r, properties: (pmRows ?? []).filter((p) => p.profile_id === r.id).map((p) => p.property_id),
      }));
    },
    async create() {
      // User creation requires the Admin API (service_role), which cannot run in the browser.
      // See "Inviting a new management user" in Section 9 of the integration doc — this
      // triggers a call to a Supabase Edge Function instead of a direct table insert.
      throw { code: 'VALIDATION', message: 'Create users via Settings → Invite User (uses the invite-user Edge Function).' };
    },
  },
  messages: {
    async list(threadId) {
      const { data, error } = await supabase.from('messages').select('*').eq('thread_id', threadId).order('created_at');
      M.throwIfError(error);
      return (data ?? []).map(M.mapMessage);
    },
    async send(threadId, msg) {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('messages').insert({
        thread_id: threadId, sender_id: sessionData.session?.user.id ?? null,
        sender_role: msg.from, text: msg.text, text_en: msg.textEn,
      }).select().single();
      M.throwIfError(error);
      return M.mapMessage(data);
    },
    async listThreads() {
      const { data, error } = await supabase.from('messages').select('*').order('created_at');
      M.throwIfError(error);
      const byThread = new Map<string, typeof data>();
      (data ?? []).forEach((m) => {
        if (!byThread.has(m.thread_id)) byThread.set(m.thread_id, []);
        byThread.get(m.thread_id)!.push(m);
      });
      return Array.from(byThread.entries()).map(([threadId, messages]) => ({
        threadId, messages: (messages ?? []).map(M.mapMessage),
      }));
    },
  },
```

### 6.5 Notifications & preferences & announcements

```ts
  notifications: {
    async list() {
      const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
      M.throwIfError(error);
      return (data ?? []).map(M.mapNotification);
    },
    async markAllRead() {
      const { data: sessionData } = await supabase.auth.getSession();
      const { error } = await supabase.from('notifications').update({ read: true })
        .eq('recipient_id', sessionData.session?.user.id ?? '').eq('read', false);
      M.throwIfError(error);
    },
    async push() {
      // Notifications are generated exclusively by server-side triggers (see the backend doc,
      // Section 12) — direct client inserts are blocked by RLS on purpose. This is a no-op so
      // existing call sites don't throw; see Section 7 of this doc for the two call sites that
      // should be deleted outright since they're now redundant.
    },
    async listForTenant() {
      return supabaseDataSource.notifications.list();
    },
    async markAllReadForTenant() {
      return supabaseDataSource.notifications.markAllRead();
    },
    async pushForTenant() { /* no-op — see notifications.push() note above */ },
  },
  preferences: {
    async get() {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('preferences').select('*').eq('profile_id', sessionData.session?.user.id ?? '').single();
      M.throwIfError(error);
      return M.mapPreferences(data);
    },
    async update(changes) {
      const { data: sessionData } = await supabase.auth.getSession();
      const patch: Record<string, unknown> = {};
      if (changes.immediateEmergency !== undefined) patch.immediate_emergency = changes.immediateEmergency;
      if (changes.dailySummary !== undefined) patch.daily_summary = changes.dailySummary;
      if (changes.smsAlerts !== undefined) patch.sms_alerts = changes.smsAlerts;
      if (changes.requestUpdates !== undefined) patch.request_updates = changes.requestUpdates;
      if (changes.announcements !== undefined) patch.announcements = changes.announcements;
      if (changes.rentReminders !== undefined) patch.rent_reminders = changes.rentReminders;
      const { data, error } = await supabase.from('preferences').update(patch).eq('profile_id', sessionData.session?.user.id ?? '').select().single();
      M.throwIfError(error);
      return M.mapPreferences(data);
    },
  },
  announcements: {
    async list(propertyId) {
      let q = supabase.from('announcements').select('*').order('created_at', { ascending: false });
      if (propertyId) q = q.or(`property_id.eq.${propertyId},property_id.is.null`);
      const { data, error } = await q;
      M.throwIfError(error);
      return (data ?? []).map(M.mapAnnouncement);
    },
    async create(input) {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('announcements').insert({
        title: input.title, title_en: input.titleEn, body: input.body, body_en: input.bodyEn,
        property_id: input.propertyId === 'all' ? null : input.propertyId,
        created_by: sessionData.session?.user.id ?? null,
      }).select().single();
      M.throwIfError(error);
      return M.mapAnnouncement(data);
    },
    async delete(id) {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      M.throwIfError(error);
    },
  },
```

### 6.6 Leases & property documents

```ts
  leases: {
    async list(propertyId) {
      let q = supabase.from('leases').select('*').order('unit');
      if (propertyId) q = q.eq('property_id', propertyId);
      const { data, error } = await q;
      M.throwIfError(error);
      return (data ?? []).map(M.mapLease);
    },
    async create(input) {
      const { data, error } = await supabase.from('leases').insert({
        property_id: input.propertyId, tenant_id: input.tenantId ?? null, unit: input.unit,
        tenant_name: input.tenantName, tenant_email: input.tenantEmail ?? null,
        term_start: input.termStart, term_end: input.termEnd,
        rent: input.rent, deposit: input.deposit, rent_status: input.rentStatus, status: input.status,
      }).select().single();
      M.throwIfError(error);
      return M.mapLease(data);
    },
    async update(id, changes) {
      const patch: Record<string, unknown> = {};
      if (changes.rentStatus !== undefined) patch.rent_status = changes.rentStatus;
      if (changes.status !== undefined) patch.status = changes.status;
      if (changes.rent !== undefined) patch.rent = changes.rent;
      if (changes.termEnd !== undefined) patch.term_end = changes.termEnd;
      const { data, error } = await supabase.from('leases').update(patch).eq('id', id).select().single();
      M.throwIfError(error);
      return M.mapLease(data);
    },
    async delete(id) {
      const { error } = await supabase.from('leases').delete().eq('id', id);
      M.throwIfError(error);
    },
  },
  propertyDocuments: {
    async list(propertyId) {
      const { data, error } = await supabase.from('property_documents').select('*').eq('property_id', propertyId).order('uploaded_at', { ascending: false });
      M.throwIfError(error);
      return (data ?? []).map(M.mapPropertyDocument);
    },
    async upload(propertyId, file) {
      const { url, path } = await supabaseDataSource.storage.upload('property-documents', `${propertyId}/${Date.now()}-${file.name}`, file);
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('property_documents').insert({
        property_id: propertyId, name: file.name, name_en: file.name,
        type: file.type.split('/')[1] ?? 'file', file_url: url, file_path: path,
        uploaded_by: sessionData.session?.user.id ?? null,
      }).select().single();
      M.throwIfError(error);
      return M.mapPropertyDocument(data);
    },
    async delete(_propertyId, documentId) {
      const { error } = await supabase.from('property_documents').delete().eq('id', documentId);
      M.throwIfError(error);
    },
  },
```

### 6.7 Projects, units

```ts
  projects: {
    async list(params) {
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize;
      let q = supabase.from('projects').select('*', { count: 'exact' }).order('created_at', { ascending: false });
      if (pageSize) q = q.range((page - 1) * pageSize, page * pageSize - 1);
      const { data, error, count } = await q;
      M.throwIfError(error);
      return { data: (data ?? []).map((r) => M.mapProject(r)), total: count ?? 0 };
    },
    async get(id) {
      const { data: p, error } = await supabase.from('projects').select('*').eq('id', id).single();
      M.throwIfError(error);
      const [{ data: types }, { data: instances }] = await Promise.all([
        supabase.from('project_unit_types').select('*').eq('project_id', id),
        supabase.from('project_unit_instances').select('*').eq('project_id', id),
      ]);
      return M.mapProject(p, (types ?? []).map(M.mapUnitType), (instances ?? []).map(M.mapUnitInstance));
    },
    async create(input) {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('projects').insert({
        name: input.name, name_en: input.nameEn, location: input.location, location_en: input.locationEn,
        total_units: input.totalUnits, start_date: input.startDate, end_date: input.endDate,
        total_days: input.totalDays, contractor: input.contractor, contractor_en: input.contractorEn,
        budget: input.budget, status: input.status, description: input.description ?? null,
        description_en: input.descriptionEn ?? null, contract_number: input.contractNumber ?? null,
        consultant: input.consultant ?? null, consultant_en: input.consultantEn ?? null,
        created_by: sessionData.session?.user.id ?? null,
      }).select().single();
      M.throwIfError(error);
      // projects_seed_doc_categories trigger already created the 6 default document categories;
      // the app does NOT need to seed project_activities client-side — do it here explicitly
      // because (unlike document categories) the 24-activity template intentionally isn't a
      // DB trigger, so a PM can create a project with a custom/blank schedule if they want:
      if (input.unitTypes?.length) {
        await supabase.from('project_unit_types').insert(input.unitTypes.map((u) => ({
          project_id: data.id, type: u.type, type_en: u.typeEn, size: u.size, bedrooms: u.bedrooms,
          unit_count: u.unitCount, category: u.category ?? null,
        })));
      }
      return supabaseDataSource.projects.get(data.id);
    },
    async update(id, changes) {
      const patch: Record<string, unknown> = {};
      const map: Record<string, string> = {
        name: 'name', nameEn: 'name_en', location: 'location', locationEn: 'location_en',
        totalUnits: 'total_units', startDate: 'start_date', endDate: 'end_date', totalDays: 'total_days',
        contractor: 'contractor', contractorEn: 'contractor_en', budget: 'budget', status: 'status',
        description: 'description', descriptionEn: 'description_en', contractNumber: 'contract_number',
        consultant: 'consultant', consultantEn: 'consultant_en',
      };
      Object.entries(changes).forEach(([k, v]) => { if (map[k]) patch[map[k]] = v; });
      const { error } = await supabase.from('projects').update(patch).eq('id', id);
      M.throwIfError(error);
      return supabaseDataSource.projects.get(id);
    },
    async addUnit(projectId, unit) {
      const { data, error } = await supabase.from('project_unit_types').insert({
        project_id: projectId, type: unit.type, type_en: unit.typeEn, size: unit.size,
        bedrooms: unit.bedrooms, unit_count: unit.unitCount, category: unit.category ?? null,
        image_url: unit.image || null, floor_plan_url: unit.floorPlan || null,
        model_3d_url: unit.model3d || null, brochure_url: unit.brochure || null,
      }).select().single();
      M.throwIfError(error);
      return M.mapUnitType(data);
    },
    async updateUnit(_projectId, unitId, changes) {
      const patch: Record<string, unknown> = {};
      if (changes.type !== undefined) patch.type = changes.type;
      if (changes.typeEn !== undefined) patch.type_en = changes.typeEn;
      if (changes.size !== undefined) patch.size = changes.size;
      if (changes.bedrooms !== undefined) patch.bedrooms = changes.bedrooms;
      if (changes.unitCount !== undefined) patch.unit_count = changes.unitCount;
      if (changes.floorPlan !== undefined) patch.floor_plan_url = changes.floorPlan;
      if (changes.model3d !== undefined) patch.model_3d_url = changes.model3d;
      if (changes.brochure !== undefined) patch.brochure_url = changes.brochure;
      const { data, error } = await supabase.from('project_unit_types').update(patch).eq('id', unitId).select().single();
      M.throwIfError(error);
      return M.mapUnitType(data);
    },
    async deleteUnit(_projectId, unitId) {
      const { error } = await supabase.from('project_unit_types').delete().eq('id', unitId);
      M.throwIfError(error);
    },
    async addUnitInstance(projectId, unit) {
      const { data, error } = await supabase.from('project_unit_instances').insert({
        project_id: projectId, model_id: unit.modelId, label: unit.label, label_en: unit.labelEn,
        floor: unit.floor, status: unit.status, price: unit.price ?? null, space: unit.space ?? null,
        attachment_name: unit.attachmentName ?? null, floor_level: unit.floorLevel ?? null,
        townhouse_type: unit.townhouseType ?? null,
        floor_plan_url: unit.floorPlan || null, model_3d_url: unit.model3d || null, brochure_url: unit.brochure || null,
      }).select().single();
      M.throwIfError(error);
      return M.mapUnitInstance(data);
    },
    async updateUnitInstance(_projectId, unitId, changes) {
      const patch: Record<string, unknown> = {};
      if (changes.status !== undefined) patch.status = changes.status;
      if (changes.price !== undefined) patch.price = changes.price;
      if (changes.space !== undefined) patch.space = changes.space;
      if (changes.floorPlan !== undefined) patch.floor_plan_url = changes.floorPlan;
      if (changes.model3d !== undefined) patch.model_3d_url = changes.model3d;
      if (changes.brochure !== undefined) patch.brochure_url = changes.brochure;
      const { data, error } = await supabase.from('project_unit_instances').update(patch).eq('id', unitId).select().single();
      M.throwIfError(error);
      return M.mapUnitInstance(data);
    },
    async deleteUnitInstance(_projectId, unitId) {
      const { error } = await supabase.from('project_unit_instances').delete().eq('id', unitId);
      M.throwIfError(error);
    },
  },
```

### 6.8 Activities

```ts
  activities: {
    async list(projectId, params) {
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize;
      let q = supabase.from('project_activities').select('*', { count: 'exact' }).eq('project_id', projectId).order('start_day');
      if (pageSize) q = q.range((page - 1) * pageSize, page * pageSize - 1);
      const { data, error, count } = await q;
      M.throwIfError(error);
      const ids = (data ?? []).map((a) => a.id);
      const { data: photos } = ids.length ? await supabase.from('activity_photos').select('*').in('activity_id', ids) : { data: [] };
      return {
        data: (data ?? []).map((a) => M.mapActivity(a, (photos ?? []).filter((p) => p.activity_id === a.id).map(M.mapActivityPhoto))),
        total: count ?? 0,
      };
    },
    async create(projectId, activity) {
      const { data, error } = await supabase.from('project_activities').insert({
        project_id: projectId, activity_code: activity.activityId, name: activity.name, name_en: activity.nameEn,
        phase: activity.phase, start_day: activity.startDay, end_day: activity.endDay, duration: activity.duration,
        actual_progress: activity.actualProgress ?? null, status: activity.status,
        team: activity.team, team_en: activity.teamEn, description: activity.description, description_en: activity.descriptionEn,
        actual_cost: activity.actualCost, planned_cost: activity.plannedCost, change_order_amount: activity.changeOrderAmount ?? 0,
        start_date: activity.startDate ?? null, end_date: activity.endDate ?? null,
        actual_start_date: activity.actualStartDate ?? null, actual_end_date: activity.actualEndDate ?? null,
      }).select().single();
      M.throwIfError(error);
      return M.mapActivity(data, []);
    },
    async update(_projectId, activityId, changes) {
      const patch: Record<string, unknown> = {};
      const map: Record<string, string> = {
        name: 'name', nameEn: 'name_en', phase: 'phase', startDay: 'start_day', endDay: 'end_day', duration: 'duration',
        actualProgress: 'actual_progress', status: 'status', team: 'team', teamEn: 'team_en',
        description: 'description', descriptionEn: 'description_en', actualCost: 'actual_cost', plannedCost: 'planned_cost',
        changeOrderAmount: 'change_order_amount', startDate: 'start_date', endDate: 'end_date',
        actualStartDate: 'actual_start_date', actualEndDate: 'actual_end_date',
      };
      // percentComplete is intentionally NOT mapped — it's server-computed (see the
      // compute_planned_progress trigger in the backend doc); any client-sent value is ignored.
      Object.entries(changes).forEach(([k, v]) => { if (map[k]) patch[map[k]] = v; });
      const { data, error } = await supabase.from('project_activities').update(patch).eq('id', activityId).select().single();
      M.throwIfError(error);
      const { data: photos } = await supabase.from('activity_photos').select('*').eq('activity_id', activityId);
      return M.mapActivity(data, (photos ?? []).map(M.mapActivityPhoto));
    },
    async delete(_projectId, activityId) {
      const { error } = await supabase.from('project_activities').delete().eq('id', activityId);
      M.throwIfError(error);
    },
    async addPhoto(_projectId, activityId, file) {
      const { url, path } = await supabaseDataSource.storage.upload('activity-photos', `${activityId}/${Date.now()}-${file.name}`, file);
      const { data: sessionData } = await supabase.auth.getSession();
      const fileType = guessFileType(file.name);
      const { data, error } = await supabase.from('activity_photos').insert({
        activity_id: activityId, file_url: url, file_path: path, file_type: fileType, file_name: file.name,
        uploaded_by: sessionData.session?.user.id ?? null,
      }).select().single();
      M.throwIfError(error);
      return M.mapActivityPhoto(data);
    },
  },
```

Add this small helper near the top of the file (used by `activities.addPhoto`, `risks.addPhoto`,
`ipc.addAttachment`):

```ts
function guessFileType(fileName: string): "image" | "pdf" | "video" | "other" {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (["mp4", "mov", "avi", "mkv"].includes(ext)) return "video";
  return "other";
}
```

### 6.9 Documents & categories

```ts
  documents: {
    async list(projectId, params) {
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize;
      let q = supabase.from('project_documents').select('*, document_categories(*)', { count: 'exact' }).eq('project_id', projectId).order('uploaded_at', { ascending: false });
      if (pageSize) q = q.range((page - 1) * pageSize, page * pageSize - 1);
      const { data, error, count } = await q;
      M.throwIfError(error);
      return {
        data: (data ?? []).map((r: any) => M.mapProjectDocument(r, M.mapDocumentCategory(r.document_categories))),
        total: count ?? 0,
      };
    },
    async listCategories(projectId) {
      const { data, error } = await supabase.from('document_categories').select('*').eq('project_id', projectId).order('is_default', { ascending: false });
      M.throwIfError(error);
      return (data ?? []).map(M.mapDocumentCategory);
    },
    async upload(projectId, file, categoryId) {
      const { url, path } = await supabaseDataSource.storage.upload('project-documents', `${projectId}/${categoryId}/${Date.now()}-${file.name}`, file);
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('project_documents').insert({
        project_id: projectId, category_id: categoryId, name: file.name, name_en: file.name,
        type: file.name.split('.').pop() ?? 'file', file_url: url, file_path: path,
        uploaded_by: sessionData.session?.user.id ?? null,
      }).select('*, document_categories(*)').single();
      M.throwIfError(error);
      return M.mapProjectDocument(data, M.mapDocumentCategory((data as any).document_categories));
    },
    async create(projectId, categoryId, doc) {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('project_documents').insert({
        project_id: projectId, category_id: categoryId, name: doc.name, name_en: doc.nameEn,
        type: doc.type, file_url: null, file_path: null,
        uploaded_by: sessionData.session?.user.id ?? null,
      }).select('*, document_categories(*)').single();
      M.throwIfError(error);
      return M.mapProjectDocument(data, M.mapDocumentCategory((data as any).document_categories));
    },
    async update(_projectId, documentId, changes) {
      const patch: Record<string, unknown> = {};
      if (changes.name !== undefined) patch.name = changes.name;
      if (changes.nameEn !== undefined) patch.name_en = changes.nameEn;
      if (changes.categoryId !== undefined) patch.category_id = changes.categoryId;
      const { data, error } = await supabase.from('project_documents').update(patch).eq('id', documentId).select('*, document_categories(*)').single();
      M.throwIfError(error);
      return M.mapProjectDocument(data, M.mapDocumentCategory((data as any).document_categories));
    },
    async delete(_projectId, documentId) {
      const { error } = await supabase.from('project_documents').delete().eq('id', documentId);
      M.throwIfError(error);
    },
    async renameCategory(_projectId, categoryId, names) {
      const { error } = await supabase.from('document_categories').update({ name: names.name, name_en: names.nameEn }).eq('id', categoryId);
      M.throwIfError(error);
    },
    async addCategory(projectId, names) {
      const key = names.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40) || `custom_${Date.now()}`;
      const { data, error } = await supabase.from('document_categories').insert({
        project_id: projectId, key, name: names.name, name_en: names.nameEn, is_default: false,
      }).select().single();
      M.throwIfError(error);
      return M.mapDocumentCategory(data);
    },
    async removeCategory(_projectId, categoryId) {
      // The guard_delete_document_category trigger (backend doc §9) rejects this with a clear
      // Postgres error if the category is a default one or still has documents — surface that.
      const { error } = await supabase.from('document_categories').delete().eq('id', categoryId);
      if (error) throw { code: 'VALIDATION', message: error.message };
    },
  },
```

### 6.10 Risks

```ts
  risks: {
    async list(projectId, params) {
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize;
      let q = supabase.from('project_risks').select('*', { count: 'exact' }).eq('project_id', projectId).order('date_raised', { ascending: false });
      if (pageSize) q = q.range((page - 1) * pageSize, page * pageSize - 1);
      const { data, error, count } = await q;
      M.throwIfError(error);
      const ids = (data ?? []).map((r) => r.id);
      const { data: photos } = ids.length ? await supabase.from('risk_photos').select('*').in('risk_id', ids) : { data: [] };
      return {
        data: (data ?? []).map((r) => M.mapRisk(r, (photos ?? []).filter((p) => p.risk_id === r.id).map(M.mapActivityPhoto))),
        total: count ?? 0,
      };
    },
    async create(projectId, risk) {
      const { data, error } = await supabase.from('project_risks').insert({
        project_id: projectId, name: risk.name, name_en: risk.nameEn, date_raised: risk.dateRaised,
        responsible: risk.responsible, responsible_en: risk.responsibleEn,
        description: risk.description, description_en: risk.descriptionEn,
        deadline: risk.deadline || null, reason: risk.reason, reason_en: risk.reasonEn, result: risk.result ?? 'pending',
      }).select().single();
      M.throwIfError(error);
      return M.mapRisk(data, []);
    },
    async update(_projectId, riskId, changes) {
      const patch: Record<string, unknown> = {};
      const map: Record<string, string> = {
        name: 'name', nameEn: 'name_en', dateRaised: 'date_raised', responsible: 'responsible', responsibleEn: 'responsible_en',
        description: 'description', descriptionEn: 'description_en', deadline: 'deadline', reason: 'reason', reasonEn: 'reason_en', result: 'result',
      };
      Object.entries(changes).forEach(([k, v]) => { if (map[k]) patch[map[k]] = v; });
      const { data, error } = await supabase.from('project_risks').update(patch).eq('id', riskId).select().single();
      M.throwIfError(error);
      const { data: photos } = await supabase.from('risk_photos').select('*').eq('risk_id', riskId);
      return M.mapRisk(data, (photos ?? []).map(M.mapActivityPhoto));
    },
    async delete(_projectId, riskId) {
      const { error } = await supabase.from('project_risks').delete().eq('id', riskId);
      M.throwIfError(error);
    },
    async addPhoto(_projectId, riskId, file) {
      const { url, path } = await supabaseDataSource.storage.upload('risk-photos', `${riskId}/${Date.now()}-${file.name}`, file);
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('risk_photos').insert({
        risk_id: riskId, file_url: url, file_path: path, file_type: guessFileType(file.name), file_name: file.name,
        uploaded_by: sessionData.session?.user.id ?? null,
      }).select().single();
      M.throwIfError(error);
      return M.mapActivityPhoto(data);
    },
  },
```

### 6.11 IPC

```ts
  ipc: {
    async list(projectId, params) {
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize;
      let q = supabase.from('ipc_entries').select('*', { count: 'exact' }).eq('project_id', projectId).order('date_logged', { ascending: false });
      if (pageSize) q = q.range((page - 1) * pageSize, page * pageSize - 1);
      const { data, error, count } = await q;
      M.throwIfError(error);
      const ids = (data ?? []).map((e) => e.id);
      const { data: atts } = ids.length ? await supabase.from('ipc_attachments').select('*').in('ipc_entry_id', ids) : { data: [] };
      return {
        data: (data ?? []).map((e) => M.mapIpc(e, (atts ?? []).filter((a) => a.ipc_entry_id === e.id).map(M.mapIpcAttachment))),
        total: count ?? 0,
      };
    },
    async create(projectId, entry) {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('ipc_entries').insert({
        project_id: projectId, direction: entry.direction, source: entry.source ?? null,
        party_name: entry.partyName ?? null, party_name_en: entry.partyNameEn ?? null, reference: entry.reference ?? null,
        activity_id: entry.activityId ?? null, amount: entry.amount, description: entry.description,
        description_en: entry.descriptionEn ?? null, status: entry.status, date_logged: entry.dateLogged,
        created_by: sessionData.session?.user.id ?? null,
      }).select().single();
      M.throwIfError(error);
      return M.mapIpc(data, []);
    },
    async update(_projectId, entryId, changes) {
      const patch: Record<string, unknown> = {};
      const map: Record<string, string> = {
        source: 'source', partyName: 'party_name', partyNameEn: 'party_name_en', reference: 'reference',
        activityId: 'activity_id', amount: 'amount', description: 'description', descriptionEn: 'description_en',
        status: 'status', dateLogged: 'date_logged',
      };
      Object.entries(changes).forEach(([k, v]) => { if (map[k]) patch[map[k]] = v; });
      const { data, error } = await supabase.from('ipc_entries').update(patch).eq('id', entryId).select().single();
      M.throwIfError(error);
      const { data: atts } = await supabase.from('ipc_attachments').select('*').eq('ipc_entry_id', entryId);
      return M.mapIpc(data, (atts ?? []).map(M.mapIpcAttachment));
    },
    async delete(_projectId, entryId) {
      const { error } = await supabase.from('ipc_entries').delete().eq('id', entryId);
      M.throwIfError(error);
    },
    async addAttachment(_projectId, entryId, file) {
      const { url, path } = await supabaseDataSource.storage.upload('ipc-attachments', `${entryId}/${Date.now()}-${file.name}`, file);
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('ipc_attachments').insert({
        ipc_entry_id: entryId, file_name: file.name, file_type: guessFileType(file.name), file_url: url, file_path: path,
        uploaded_by: sessionData.session?.user.id ?? null,
      }).select().single();
      M.throwIfError(error);
      return M.mapIpcAttachment(data);
    },
  },
```

### 6.12 Storage (closes the object literal)

```ts
  storage: {
    async upload(bucket, path, file) {
      const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) throw { code: 'UNKNOWN', message: error.message };
      const isPublic = bucket === 'unit-assets' || bucket === 'avatars';
      if (isPublic) {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
        return { url: urlData.publicUrl, path: data.path };
      }
      const { data: signed, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(data.path, 60 * 60 * 24 * 7);
      if (signErr) throw { code: 'UNKNOWN', message: signErr.message };
      return { url: signed.signedUrl, path: data.path };
    },
    async remove(bucket, path) {
      const { error } = await supabase.storage.from(bucket).remove([path]);
      if (error) throw { code: 'UNKNOWN', message: error.message };
    },
  },
}; // end of supabaseDataSource
```

Private-bucket files get a **7-day signed URL** at upload time. Since request/activity/risk/IPC
photos are viewed far more often than they're uploaded, and Storage RLS already protects the objects
directly, re-signing on every list-fetch (instead of storing a URL that expires) is the more robust
long-term approach — see the optional hardening note in Section 11.

---

## 7. Remove now-redundant client-side notification pushes

Two call sites manually push notifications that the backend's triggers (backend doc, Section 12)
now generate automatically. Leaving them in would double-notify. Delete these blocks entirely:

**`src/pages/management/ManagementRequestDetail.tsx`** (~line 46) — remove the
`dataSource.notifications.pushForTenant(...)` call after the timeline event is added; the
`addTimelineEvent` mutation alone is now sufficient (the `request_timeline_notify` trigger fires from
that insert).

**`src/pages/technician/TechnicianRequestDetail.tsx`** (~line 48) — remove the
`dataSource.notifications.push(...)` call for the same reason.

(The `notifications.push`/`pushForTenant` methods in the Supabase adapter are already no-ops per
Section 6.5, so leaving these calls in wouldn't break anything — but removing them keeps the intent
of the code honest: notification generation is a server responsibility now.)

---

## 8. Retire `StoreContext` and finish migrating the remaining pages

`context.md`'s own "Pages Not Yet Migrated to React Query" list is the exact punch list for this
section: `ManagementRequestDetail`, `PropertyDetail`, `Reports`, `UsersPage`, `ManagementSettings`,
`ResidentSupport`, `MyRequests`, `TenantRequestDetail`, `ContactManager`, `TenantSettings`,
`TenantProfile`, `EmergencyContact`. Every one of these currently reads server data from
`useStore()` (`StoreContext.tsx`), which only ever holds mock-seeded, `localStorage`-persisted data —
switching `VITE_DATA_SOURCE` to `supabase` does **nothing** for these pages until they're migrated,
because they never call `dataSource` at all. This is the single most important step for "nothing
left in the backend" — without it, roughly a third of the app's screens would silently keep showing
stale local mock data after go-live.

The pattern to follow is already fully demonstrated by the pages `context.md` marks "(migrated)" —
`ManagementDashboard.tsx`, `ManagementRequests.tsx`, `TenantHome.tsx`, `PmDashboard.tsx`,
`DocumentsContent.tsx`, `IpcContent.tsx`. For each page in the punch list:

1. Replace `const { state, dispatch } = useStore();` with the relevant `useXList()`/`useX(id)` React
   Query hook(s) from `src/queries/`.
2. Replace any `dispatch({ type: 'ADD_...' / 'UPDATE_...' / 'DELETE_...' })` call with the matching
   mutation hook (`useCreateX()`, `useUpdateX()`, `useDeleteX()`), and call `.mutate(...)` /
   `.mutateAsync(...)` from the form's submit handler.
3. Add loading/error handling using the existing `PageSkeleton`/`PageError` components from
   `src/components/ui/PageStates.tsx` (already used by every migrated page — copy their pattern
   exactly, e.g. `if (query.isLoading) return <PageSkeleton />; if (query.isError) return <PageError onRetry={query.refetch} />;`).
4. Remove the `useStore` import once nothing on the page references `state`/`dispatch` anymore.

Two hook files need small additions to cover this punch list (everything else it needs already
exists in `src/queries/`):

**`src/queries/useProperties.ts`** — add:

```ts
export const leaseKeys = {
  forProperty: (id: string) => ["leases", id] as const,
};
export function useLeases(propertyId: string) {
  return useQuery({
    queryKey: leaseKeys.forProperty(propertyId),
    queryFn: () => dataSource.leases.list(propertyId),
    enabled: !!propertyId,
  });
}
export function useCreateLease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LeaseInput) => dataSource.leases.create(input),
    onSuccess: (lease) =>
      qc.invalidateQueries({
        queryKey: leaseKeys.forProperty(lease.propertyId),
      }),
  });
}
export function useUpdateLease(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: Partial<Lease> }) =>
      dataSource.leases.update(id, changes),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: leaseKeys.forProperty(propertyId) }),
  });
}

export const propertyDocKeys = {
  forProperty: (id: string) => ["propertyDocuments", id] as const,
};
export function usePropertyDocuments(propertyId: string) {
  return useQuery({
    queryKey: propertyDocKeys.forProperty(propertyId),
    queryFn: () => dataSource.propertyDocuments.list(propertyId),
    enabled: !!propertyId,
  });
}
export function useUploadPropertyDocument(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) =>
      dataSource.propertyDocuments.upload(propertyId, file),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: propertyDocKeys.forProperty(propertyId),
      }),
  });
}
```

**`src/queries/useShared.ts`** — no new exports needed, but see Section 9 for a Realtime upgrade to
the existing `useNotifications`/`useTenantNotifications`/`useMessages` hooks.

Page-by-page notes (only where the mapping isn't 1:1 obvious):

- **`PropertyDetail.tsx`**: "Units & Leases" tab → `useLeases(propertyId)` +
  `useCreateLease`/`useUpdateLease` instead of `FmUnit`/`ADD_FM_UNIT`. "Documents" tab →
  `usePropertyDocuments(propertyId)` + `useUploadPropertyDocument` instead of `FmDocument`.
  "Requests" tab → `useRequestList({ propertyId })` (already exists, used elsewhere).
- **`UsersPage.tsx`**: `useUsers()`/`useCreateUser()` already exist (`src/queries/useShared.ts`);
  this page was simply never switched over. Note from Section 6.4: `users.create()` in the Supabase
  adapter throws — wire the "Add User" button to the invite flow in Section 9 instead of expecting a
  direct insert to succeed.
- **`ManagementSettings.tsx`** / **`TenantSettings.tsx`**: `usePreferences()`/`useUpdatePreferences()`
  already exist.
- **`Reports.tsx`**: derive ticket volume / resolution time / SLA compliance from
  `useRequestList()` + `useTechnicians()` client-side (as it does today from `state.requests`) — just
  swap the data source, the aggregation logic is unchanged.
- **`ResidentSupport.tsx`** (the request form) / **`MyRequests.tsx`** / **`TenantRequestDetail.tsx`**:
  `useCreateRequest()`, `useRequestList({ tenantId: session.userId })`, `useRequest(id)` — all already
  exist in `useRequests.ts`.
- **`ContactManager.tsx`**: `useMessages(session.userId)` + `useSendMessage()` — already exist.
- **`TenantProfile.tsx`** / **`EmergencyContact.tsx`**: mostly static/profile display — read from
  `useAuth().session` directly; `EmergencyContact.tsx` has no backend data at all (it's static
  contact info per the PRD) and needs no query hook.

### 8.1 `DocumentsContent.tsx` — already on React Query, but still needs a real patch

`DocumentsContent.tsx` (and `useDocuments.ts`) is _not_ in the "not yet migrated" list — it already
uses `dataSource.documents.*` — but Section 9's schema redesign (fixed `DocumentCategory` enum →
real `document_categories` rows) changes its data contract, so switching the data source alone isn't
enough here; the component still reads `project.documentCategoryNames`/`project.customDocumentCategories`
(removed from `Project` in Section 2) and calls `documents.create(...)` with a `category` enum value
(now `categoryId`). Without this patch, this page breaks immediately in Supabase mode even though it
"looks" migrated.

**`src/queries/useDocuments.ts`** — replace with:

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dataSource } from "@/data/client/index";
import type { ProjectDocument, DocumentCategoryRecord } from "@/types";

export const documentKeys = {
  all: ["documents"] as const,
  list: (projectId: string) =>
    [...documentKeys.all, "list", projectId] as const,
  categories: (projectId: string) =>
    [...documentKeys.all, "categories", projectId] as const,
};

export function useDocumentList(projectId: string) {
  return useQuery({
    queryKey: documentKeys.list(projectId),
    queryFn: () => dataSource.documents.list(projectId),
    enabled: !!projectId,
  });
}

export function useDocumentCategories(projectId: string) {
  return useQuery({
    queryKey: documentKeys.categories(projectId),
    queryFn: () => dataSource.documents.listCategories(projectId),
    enabled: !!projectId,
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      file,
      categoryId,
    }: {
      projectId: string;
      file: File;
      categoryId: string;
    }) => dataSource.documents.upload(projectId, file, categoryId),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: documentKeys.list(projectId) }),
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      categoryId,
      doc,
    }: {
      projectId: string;
      categoryId: string;
      doc: { name: string; nameEn: string; type: string; uploadDate: string };
    }) => dataSource.documents.create(projectId, categoryId, doc),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: documentKeys.list(projectId) }),
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      documentId,
      changes,
    }: {
      projectId: string;
      documentId: string;
      changes: Partial<Pick<ProjectDocument, "name" | "nameEn" | "categoryId">>;
    }) => dataSource.documents.update(projectId, documentId, changes),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: documentKeys.list(projectId) }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      documentId,
    }: {
      projectId: string;
      documentId: string;
    }) => dataSource.documents.delete(projectId, documentId),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: documentKeys.list(projectId) }),
  });
}

export function useRenameDocumentCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      categoryId,
      names,
    }: {
      projectId: string;
      categoryId: string;
      names: { name: string; nameEn: string };
    }) => dataSource.documents.renameCategory(projectId, categoryId, names),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: documentKeys.categories(projectId) }),
  });
}

export function useAddDocumentCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      names,
    }: {
      projectId: string;
      names: { name: string; nameEn: string };
    }) => dataSource.documents.addCategory(projectId, names),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: documentKeys.categories(projectId) }),
  });
}

export function useRemoveDocumentCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      categoryId,
    }: {
      projectId: string;
      categoryId: string;
    }) => dataSource.documents.removeCategory(projectId, categoryId),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: documentKeys.categories(projectId) }),
  });
}
```

**`src/pages/pm/DocumentsContent.tsx`** — the JSX layout (category tiles, upload modal, edit/delete
modals) stays the same; only the data plumbing changes. Apply these replacements:

1. Add `const { data: categories = [] } = useDocumentCategories(projectId);` alongside the existing
   `useDocumentList(projectId)` call. Delete the `useProject(projectId)` call and the
   `categoryNames`/`customCategories` derivation entirely — category display data now comes straight
   from `categories`, not from the project object.
2. Replace `allBuiltin: DocumentCategory[] = [...]` with
   `const builtinCategories = categories.filter((c) => c.isDefault);` and
   `const customCategories = categories.filter((c) => !c.isDefault);` (both `DocumentCategoryRecord[]`
   now, not strings/objects-by-id).
3. `activeCategory` state becomes `useState<DocumentCategoryRecord | null>(null)` instead of
   `DocumentCategory | null` — set it to the whole category object when a tile is clicked
   (`onClick={() => setActiveCategory(cat)}`), not just an id.
4. `builtinConfig` (the icon/color lookup) is keyed by `category.key` instead of the old enum value —
   e.g. `builtinConfig[category.key]` — since the seeded `key` values (`contracts`, `master_plan`,
   `construction_files`, `permits`, `reports`, `correspondence`) are exactly what the backend doc's
   Section 9 seeds, this lookup keeps working unchanged, just change every `builtinConfig[cat]` to
   `builtinConfig[cat.key]`.
5. `getCategoryName(cat)`/`getCategoryDesc(cat)` simplify drastically — the category's current name
   already comes straight from the DB row (renaming is now a real row update, not a project-level
   override map), so `getCategoryName` becomes `(cat: DocumentCategoryRecord) => isRtl ? cat.name : cat.nameEn`.
   For the description subtitle under each tile, keep the existing `t('pm:docCategory_${cat.key}_desc')`
   translation lookup for default categories (falls back to `t('pm:customCategory')` when `!cat.isDefault`).
6. `countsByCategory`: key by `d.categoryId` instead of `d.category`:
   `documents.forEach((d) => { counts[d.categoryId] = (counts[d.categoryId] || 0) + 1; });`
7. `categoryDocs`: filter by `d.categoryId === activeCategory.id`.
8. `handleUploadSubmit`/`ManualDocForm`'s `onSave` /`handleDocSave` (`isNew` branch): call
   `createDoc.mutateAsync({ projectId, categoryId: activeCategory.id, doc: {...} })` (drop `category`
   from the payload, add `categoryId`).
9. `handleCategoryRename`: always call
   `renameCategory.mutateAsync({ projectId, categoryId: cat.id, names })` — the branch that called
   `addCategoryMut` for custom categories is no longer needed, since renaming a custom category is now
   the same row-update endpoint as renaming a default one (`renameCategory` works uniformly because
   both are just rows in `document_categories`).
10. `handleAddCategory`: `addCategoryMut.mutateAsync({ projectId, names: { name, nameEn } })` (no more
    client-generated `id: custom_${Date.now()}` — the backend generates the id and slugs the `key`).
11. `handleRemoveCategory`: unchanged shape (`{ projectId, categoryId }`), but now surface a toast on
    failure with the actual server message instead of the generic `errorSaving` string, since the
    `guard_delete_document_category` trigger (backend doc §9) returns a specific, useful error
    ("Default document categories cannot be deleted" / "Cannot delete a category that still has
    documents") that's worth showing the user verbatim:
    ```ts
    const handleRemoveCategory = () => {
      if (!deletingCategoryId) return;
      removeCategoryMut
        .mutateAsync({ projectId, categoryId: deletingCategoryId })
        .then(() => {
          setDeletingCategoryId(null);
          if (activeCategory?.id === deletingCategoryId)
            setActiveCategory(null);
          toast(t("pm:categoryDeleted"));
        })
        .catch((e: { message?: string }) =>
          toast(e?.message ?? t("errorSaving")),
        );
    };
    ```
12. Everywhere the JSX currently reads `cat` as a bare string/id from `allBuiltin.map((cat) => ...)`
    or `customCategories.map((cat) => ...)`, it now iterates `DocumentCategoryRecord` objects directly
    — `cat.id` replaces the old `cat`/`cat.id` string key, `cat.name`/`cat.nameEn` replace the
    `getCategoryName`/lookup-map calls in the tile render (keep `getCategoryName(cat)` as a thin
    wrapper per point 5 so the JSX itself barely changes).

This is the one page in the whole app where the schema redesign (Section 9 of the backend doc)
genuinely changes behavior rather than just plumbing — worth a manual smoke test after patching: add a
custom category, upload a doc into it, rename the category, confirm the doc's card still shows under
the new name, then try deleting a default category and confirm the toast shows the trigger's real
error message instead of silently failing.

Once every page above compiles against hooks instead of `useStore`, delete `src/store/StoreContext.tsx`,
its import in `App.tsx`, and the legacy `useStore` imports still left in `ManagementLayout.tsx`,
`PmLayout.tsx`, `TenantLayout.tsx` for the emergency-badge count — replace that specific usage with
`useRequestList({ status: undefined })` filtered client-side for `type === 'emergency' && status !== 'resolved'`,
or (cleaner) add a tiny dedicated hook:

```ts
// src/queries/useRequests.ts — add
export function useEmergencyCount() {
  const { data } = useRequestList({ status: undefined }); // reuse existing cache key shape
  return (data?.data ?? []).filter(
    (r) => r.type === "emergency" && r.status !== "resolved",
  ).length;
}
```

---

## 9. Realtime — instant notification bell (upgrade from polling)

`useNotifications()`/`useTenantNotifications()`/`useMessages()` currently poll every 5 seconds
(`refetchInterval: 5000`). That still works against Supabase as-is (no change required for
correctness), but since the backend now has Realtime enabled (backend doc, Section 17), upgrade the
bell to push-based updates so new emergency requests appear instantly instead of up-to-5s late.

**`src/components/shared/NotificationBell.tsx`** — add a subscription effect. Note the component
always calls **both** `useNotifications()` (management, cache key `notificationKeys.all`) and
`useTenantNotifications(tenantEmail)` (cache key `tenantNotifKeys.forTenant(tenantEmail)`) and picks
whichever applies via `isTenant` — so the realtime handler must invalidate whichever one of those two
keys the current session actually uses, not just the management one:

```tsx
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/data/client/supabase/client";
import { notificationKeys, tenantNotifKeys } from "@/queries/useShared";

// inside NotificationBell(), alongside the existing hooks (after `isTenant`/`tenantEmail` are defined):
const qc = useQueryClient();
useEffect(() => {
  if (!session || import.meta.env.VITE_DATA_SOURCE !== "supabase") return;
  const channel = supabase
    .channel(`notifications:${session.userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${session.userId}`,
      },
      () => {
        if (isTenant)
          qc.invalidateQueries({
            queryKey: tenantNotifKeys.forTenant(tenantEmail),
          });
        else qc.invalidateQueries({ queryKey: notificationKeys.all });
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}, [session, qc, isTenant, tenantEmail]);
```

The `VITE_DATA_SOURCE !== 'supabase'` guard matters because the mock's `supabase` client (Section 4)
throws on any property access when credentials aren't set — this effect must never touch it in mock
mode.

Do the same pattern for `ContactManager.tsx` (subscribe to `messages` where `thread_id = auth.uid()`)
and `ManagementMessages.tsx` (subscribe to all `messages` inserts) so chat feels instant too. Keep
the existing `refetchInterval: 5000` as a fallback in both hooks — belt-and-suspenders, costs
nothing, and covers any brief Realtime disconnect.

### 9.1 Fix `ManagementMessages.tsx`'s thread display name

Separately from Realtime, this page has a display bug that only shows up once real UUIDs are in
play. Today it derives a human-readable name straight from the thread ID string:

```ts
// current code — src/pages/management/ManagementMessages.tsx
function displayName(threadId: string): string {
  return threadId.replace(/^mock-/, "");
}
```

This works only because the mock's thread IDs are literally `mock-{email}` strings. Under Supabase,
`thread_id` is the tenant's real `profiles.id` (a UUID) — stripping a `mock-` prefix from a UUID just
shows the raw UUID in the thread list, which is useless to a management user trying to find "the
tenant in A-204." Replace it with a real lookup: fetch the relevant profiles' names in bulk once you
have the thread list, and use a lookup map instead of string-parsing the ID.

```tsx
// src/pages/management/ManagementMessages.tsx — replace displayName() and its usages
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/data/client/supabase/client";

function useThreadNames(threadIds: string[]) {
  return useQuery({
    queryKey: ["threadNames", ...threadIds.slice().sort()],
    queryFn: async () => {
      if (threadIds.length === 0) return {} as Record<string, string>;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, tenant_unit")
        .in("id", threadIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((p) => {
        map[p.id] = p.tenant_unit
          ? `${p.full_name} — ${p.tenant_unit}`
          : p.full_name;
      });
      return map;
    },
    enabled:
      threadIds.length > 0 && import.meta.env.VITE_DATA_SOURCE === "supabase",
  });
}

// where the component builds `threads` from useMessageThreads():
const { data: names = {} } = useThreadNames(threads.map((t) => t.threadId));
// then everywhere it currently calls displayName(threadId), use: names[threadId] ?? threadId
```

In mock mode this hook is disabled (`enabled: ... === 'supabase'`) and the old `displayName()` string
logic can stay as the mock-mode fallback — keep both, branching on `VITE_DATA_SOURCE`, so this page
still works correctly with `npm run dev` against the mock adapter during development.

---

## 10. Seed script (Node, Admin API) — alternative to the Dashboard method

For a repeatable/CI-friendly setup instead of the Dashboard steps in the backend doc's Section 18,
add `scripts/seed-users.mjs` (run with `node scripts/seed-users.mjs`, **never** commit the
`service_role` key — read it from an untracked `.env.seed`):

```js
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // service_role — server-side only, never in the app bundle
);

const users = [
  {
    email: "khalid@mdrar.sa",
    password: "password",
    metadata: {
      role: "super_admin",
      full_name: "خالد الشهري",
      full_name_en: "Khalid Al-Shehri",
    },
  },
  {
    email: "sarah@mdrar.sa",
    password: "password",
    metadata: {
      role: "facility_manager",
      full_name: "Sarah Miller",
      full_name_en: "Sarah Miller",
    },
  },
  {
    email: "salem@mdrar.sa",
    password: "password",
    metadata: {
      role: "technician",
      full_name: "سالم القحطاني",
      full_name_en: "Salem Al-Qahtani",
      specialty: "AC & Plumbing",
    },
  },
  {
    email: "fahad@mdrar.sa",
    password: "password",
    metadata: {
      role: "technician",
      full_name: "فهد العتيبي",
      full_name_en: "Fahad Al-Otaibi",
      specialty: "Electrical",
    },
  },
  {
    email: "owner@mdrar.sa",
    password: "password",
    metadata: {
      role: "owner",
      full_name: "عبدالرحمن الراجحي",
      full_name_en: "Abdulrahman Al-Rajhi",
    },
  },
  {
    email: "pm@mdrar.sa",
    password: "password",
    metadata: {
      role: "pm_manager",
      full_name: "مدير المشاريع",
      full_name_en: "PM Manager",
    },
  },
  {
    email: "pmviewer@mdrar.sa",
    password: "password",
    metadata: {
      role: "pm_viewer",
      full_name: "مشاهد المشاريع",
      full_name_en: "PM Viewer",
    },
  },
  {
    email: "m.alotaibi@example.com",
    password: "password",
    metadata: {
      role: "tenant",
      full_name: "محمد العتيبي",
      full_name_en: "Mohammed Al-Otaibi",
      tenant_unit: "A-204",
    },
  },
  {
    email: "sarah.j@example.com",
    password: "password",
    metadata: {
      role: "tenant",
      full_name: "Sarah Johnson",
      full_name_en: "Sarah Johnson",
      tenant_unit: "B-110",
    },
  },
];

for (const u of users) {
  const { error } = await supabase.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: u.metadata,
  });
  console.log(u.email, error ? `FAILED: ${error.message}` : "created");
}

// Link tenant profiles to their seeded properties (run after 01_SUPABASE_BACKEND.md §19 seed data exists)
const { data: jazly } = await supabase
  .from("properties")
  .select("id")
  .eq("name_en", "Jazly Plaza")
  .single();
const { data: qurtuba } = await supabase
  .from("properties")
  .select("id")
  .eq("name_en", "Wahat Qurtuba")
  .single();
await supabase
  .from("profiles")
  .update({ tenant_property_id: jazly?.id })
  .eq("email", "m.alotaibi@example.com");
await supabase
  .from("profiles")
  .update({ tenant_property_id: qurtuba?.id })
  .eq("email", "sarah.j@example.com");
```

**Inviting a new management user in production** (referenced from Section 6.4's `users.create()`):
create a Supabase **Edge Function** `invite-user` that wraps this same
`supabase.auth.admin.createUser` (or `inviteUserByEmail`) call server-side, deployed with the
`service_role` key as a function secret (never exposed to the browser), and have `UsersPage.tsx` call
`supabase.functions.invoke('invite-user', { body: { email, role, fullName } })` instead of
`dataSource.users.create(...)`. This is the one piece of genuinely new backend surface (a Function,
not just a table) — everything else in this pass is schema + RLS + a typed client.

---

## 11. Optional hardening (do once the core flow is verified end-to-end)

- **Signed URL refresh**: Section 6.12 signs private-bucket URLs for 7 days at upload time. For a
  bucket accessed far more often than uploaded to over a long project lifetime (e.g.
  `ipc-attachments` reviewed years later), add a `storage.createSignedUrl` call in the `list()`
  adapters instead of trusting a URL stored at upload time — trivial addition once needed, skip for
  launch.
- **Rate limiting** on `requests.create` (a compromised tenant session spamming request rows): add a
  Postgres check constraint or a trigger capping requests-per-tenant-per-hour; not required for
  launch at MDRAR's current portfolio size but cheap to add later.
- **`pg_cron` daily summary**: `preferences.daily_summary` exists in the schema but nothing consumes
  it yet — a `pg_cron` job + Edge Function emailing a daily digest to opted-in management users is
  the natural implementation, deliberately left out of this pass since it needs an email provider
  decision (Resend/SendGrid/etc.) the client hasn't made.

---

## 12. Final checklist

- [ ] `.env.local` has real `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, `VITE_DATA_SOURCE=supabase`.
- [ ] `src/data/client/supabase/mappers.ts` added, `src/data/client/supabase/index.ts` fully replaces
      every `notImpl(...)`.
- [ ] `src/types.ts`, `src/data/client/dataSource.ts` updated per Sections 2–3.
- [ ] The two redundant `notifications.push`/`pushForTenant` call sites removed (Section 7).
- [ ] Every page in `context.md`'s "not yet migrated" list now uses `dataSource`-backed hooks, not
      `useStore` (Section 8); `StoreContext.tsx` deleted once confirmed unused.
- [ ] `useDocuments.ts` and `DocumentsContent.tsx` patched for the real `document_categories` model
      (Section 8.1) — this page already used React Query but still breaks without this patch.
- [ ] `NotificationBell.tsx` (and chat pages) subscribe to Realtime, invalidating the correct
      management-vs-tenant query key (Section 9).
- [ ] `Session.technicianId` added and populated in `getSupabaseSession()`; `TechnicianDashboard.tsx`
      uses it instead of the hardcoded `salem@mdrar.sa`/`fahad@mdrar.sa` → `tech-1`/`tech-2` mapping
      (Section 3.0).
- [ ] `ManagementMessages.tsx` resolves thread display names from `profiles`, not by string-parsing
      the thread ID (Section 9.1).
- [ ] Seed users exist (Dashboard or `scripts/seed-users.mjs`) and can sign in.
- [ ] `npm run typecheck && npm run build` pass.
- [ ] End-to-end smoke test: sign in as a tenant, submit an emergency request → sign in as
      `khalid@mdrar.sa` in a second browser/profile → notification appears within ~1s, unread badge
      increments, "Mark all read" clears it; assign a technician → `salem@mdrar.sa` gets a
      notification; add a timeline event → the tenant sees both the timeline update and a
      notification without refreshing.
- [ ] Upload a photo on a PM activity as `pm@mdrar.sa`, confirm it's visible, then sign in as
      `pmviewer@mdrar.sa` and confirm the Edit/Delete controls are gone (or the calls are rejected)
      — verifies `is_pm_write()` is actually being enforced by RLS, not just hidden by the UI.
