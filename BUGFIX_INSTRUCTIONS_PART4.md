# MDRAR Portal — Follow-up Report #4

**Audience:** coding agent. Builds on Parts 1–3 — apply those first if any haven't landed yet (Part 3's password-update work and provisioning Edge Function are prerequisites for several items below). 10 items total: 6 in the Owner (management) portal, 3 in the Resident portal, 1 app-wide. Each has a confirmed root cause found directly in the code.

---

# OWNER'S PORTAL

## Owner-1 — "Add User" just tells you to use the Supabase dashboard

### Root cause
`src/pages/management/UsersPage.tsx`'s "Add User" button does nothing but show a toast:
```tsx
<button onClick={() => showToast(isRtl ? 'لإضافة مستخدم، استخدم لوحة Supabase → Authentication → Invite User' : 'To add a user, use Supabase Dashboard → Authentication → Invite User')} ...>
  {t('addUser')}
</button>
```
And the data layer backs this up — `src/data/client/supabase/index.ts`'s `users.create()` deliberately throws:
```ts
async create() {
  throw { code: 'VALIDATION', message: 'Create users via Settings → Invite User (uses the invite-user Edge Function).' };
},
```
There is no "Invite User" Edge Function in the repo (`supabase/functions/` doesn't exist), and no form to collect a new user's details. You asked for every role **except resident** to be addable from here — residents are handled separately (they're provisioned automatically when a unit is occupied, per Part 3's Issue #2).

### Fix
**1. Reuse the `provision-user` Edge Function from Part 3.** That function already accepts an arbitrary `role`, not just `'tenant'` — it was designed generically for exactly this reuse. No changes needed to the function itself beyond what Part 3 already specified, other than allowing an optional list of `propertyIds` to assign (see step 3).

**2. Build the "Add User" modal.** Replace the toast button in `UsersPage.tsx` with a modal (reuse `src/components/ui/Modal.tsx`) collecting:
- Full name
- Email
- Role — a `<select>` of `super_admin | facility_manager | technician | owner` (whatever subset your business rules allow an admin to grant — exclude `tenant`, `pm_manager`, `pm_viewer` here since those are provisioned elsewhere)
- Assigned properties — a multi-select of `usePropertyList()`'s results, relevant for `facility_manager`/`technician` (leave empty = "all properties", matching the existing `u.properties.length === 0 ? t('allProperties') : ...` display logic)
- A generated temporary password, shown once after creation so the admin can hand it to the new user (see step 4)

**3. Wire it up.** In `src/data/client/supabase/index.ts`, replace the throwing `users.create()`:
```ts
async create(input: CreateUserInput & { propertyIds?: string[] }) {
  const { data, error } = await supabase.functions.invoke('provision-user', {
    body: { email: input.email, fullName: input.name, role: input.role },
  });
  if (error) throw { code: 'VALIDATION', message: error.message };
  const userId = (data as { userId: string }).userId;
  if (input.propertyIds?.length) {
    const { error: pmErr } = await supabase
      .from('property_managers')
      .insert(input.propertyIds.map((propertyId) => ({ property_id: propertyId, profile_id: userId })));
    if (pmErr) throw { code: 'VALIDATION', message: pmErr.message };
  }
  return { ...input, id: userId };
},
```
You'll need to extend `CreateUserInput` (`src/data/client/dataSource.ts`) to optionally carry `propertyIds`, and extend the `provision-user` function's response to also accept/ignore roles other than `tenant` cleanly (it already does — it just upserts whatever `role` you pass into `profiles`).

**4. Generate and surface the temporary password.** Staff accounts are higher-privilege than resident accounts, so don't hardcode `123456` here — generate a random one-time password client-side (e.g. 10 random alphanumeric characters) and pass it as `password` in the `provisionUser`/Edge Function call body (the function already accepts an optional `password` and falls back to `123456` only if omitted — pass an explicit one here instead). After creation succeeds, show it in a "copy password" dialog (not just a toast, since a toast disappears too fast to copy) telling the admin to share it securely and that the new user should change it after first sign-in — following the same one-time-password UX called for in Owner accounts as recommended for residents in Part 3.

**5. Mock mode.** `src/data/client/mock/users.mock.ts`'s `create()` already just appends to `db.users` — that's fine as-is for the *user record*, but per Part 3's mock changes (`authMock` moving to a persisted `db.users`-backed login list), make sure this `usersMock.create()` and `authMock.createUser()` write to the **same** underlying list so a staff member created here can actually sign in afterward (today they're two separate mock concepts — `db.users` in `users.mock.ts` for the directory listing vs. the static `SEED_USERS` array in `auth.mock.ts` for login — reconcile these into one, as already called for in Part 3).

### Verification
- Create a new Facility Manager, assign them to two properties, confirm they appear correctly in the Users table with those two properties listed.
- Sign in as that new user with the generated password and confirm they land in the management portal with the right access.

---

## Owner-2 — Reports page: export buttons do nothing real, and the requests graph is fake

### Root cause A — exports are pure theater
Every export button in `src/pages/management/Reports.tsx` does the same thing:
```tsx
<Button variant="outline" size="sm" onClick={() => showToast(t('exportSuccess'))}>
  <Download className="w-4 h-4" />{t('export')}
</Button>
...
<Button variant="outline" size="sm" onClick={() => showToast(t('exportSuccess'))}><Download className="w-4 h-4" />{t('exportPdf')}</Button>
<Button variant="outline" size="sm" onClick={() => showToast(t('exportSuccess'))}><Download className="w-4 h-4" />{t('exportExcel')}</Button>
```
They just show a "success" toast — no file is ever generated, nothing is downloaded. This is placeholder code that was never finished.

### Root cause B — the request volume chart is hardcoded fake data
```tsx
const bars = [58, 72, 48, 88, 66, 92, 74, 81, 63, 76, 89, 70];
```
These 12 numbers are a static, made-up array — not derived from `requests` at all. No matter what's actually in your data, the "Request Volume" chart always renders the same fixed shape.

### Fix — real CSV export (no new dependency needed)
A CSV export can be built with nothing but the browser's `Blob`/anchor-download APIs already used implicitly elsewhere in the app — no new package required:
```tsx
function exportRequestsCsv(requests: Request[], properties: Property[], isRtl: boolean) {
  const header = ['ID', 'Property', 'Unit', 'Tenant', 'Type', 'Category', 'Status', 'Priority', 'Date'];
  const rows = requests.map((r) => [
    r.id,
    properties.find((p) => p.id === r.propertyId)?.[isRtl ? 'name' : 'nameEn'] ?? r.propertyId,
    r.unit, r.tenant, r.type, r.category, r.status, r.priority, r.date,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM so Excel opens Arabic text correctly
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mdrar-requests-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```
Wire the "Export Excel" button to this (a `.csv` opens directly in Excel — this satisfies "Excel export" without adding a binary `.xlsx` library). Then:
```tsx
<Button variant="outline" size="sm" onClick={() => exportRequestsCsv(requests, properties, isRtl)}>
  <Download className="w-4 h-4" />{t('exportExcel')}
</Button>
```

For "Export PDF", the simplest real option with no new dependency is the browser's own print pipeline:
```tsx
<Button variant="outline" size="sm" onClick={() => window.print()}>
  <Download className="w-4 h-4" />{t('exportPdf')}
</Button>
```
Add a `@media print` stylesheet rule hiding the sidebar/nav/buttons so only the report content prints cleanly, and the person can "Save as PDF" from their browser's print dialog. If you want a real one-click PDF file (no print dialog), add a small dependency like `jspdf` + `jspdf-autotable` and generate the table programmatically — flag this trade-off to the person before adding a new dependency, since the print-based approach needs none.

Remove the top "Export" button that duplicates the bottom two ambiguous ones, or make clear what it exports (currently it's a third button with no distinct destination — `t('export')` — that overlaps with `exportPdf`/`exportExcel` below it).

### Fix — real Request Volume chart
Replace the fake `bars` array with an actual aggregation over `requests`, grouped by day (or week/month depending on the selected range — the `<select>` next to the page title already offers "Last 30 days"/"Last 90 days" but nothing reads its value; wire that up too):
```tsx
const [rangeDays, setRangeDays] = useState(30);

const volumeByDay = useMemo(() => {
  const days: { label: string; count: number }[] = [];
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayKey = d.toISOString().slice(0, 10);
    const count = requests.filter((r) => r.date.slice(0, 10) === dayKey).length; // adjust to however `r.date`/`created_at` is actually formatted — see note below
    days.push({ label: String(d.getDate()), count });
  }
  return days;
}, [requests, rangeDays]);

const maxVolume = Math.max(...volumeByDay.map((d) => d.count), 1);
```
```tsx
<select className="filter-select w-auto" value={rangeDays} onChange={(e) => setRangeDays(Number(e.target.value))}>
  <option value={30}>{t('last30')}</option>
  <option value={90}>{isRtl ? 'آخر 90 يوماً' : 'Last 90 days'}</option>
</select>
...
{volumeByDay.map((d, i) => (
  <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1">
    <div className="w-full max-w-7 rounded-t bg-copper-300 hover:bg-copper-500 transition-colors" style={{ height: `${(d.count / maxVolume) * 100}%` }} />
    <span className="text-[9px] text-stone-400">{d.label}</span>
  </div>
))}
```
**Note on date format:** `Request.date` is currently populated as a locale-formatted display string (`new Date().toLocaleDateString(...)` — see `ResidentSupport.tsx`), not a sortable/parseable ISO date. This makes day-bucketing unreliable across locales. Recommend switching `Request.date` (and its Supabase equivalent, which should really just be `created_at`) to a proper ISO timestamp and formatting it for *display* only at render time (the same pattern already recommended in Part 3, Issue 4a, for messages) — do this once and reuse the fix across Reports, request lists, and anywhere else `r.date` is shown.

With 90+ days of bars at once, consider switching to a weekly bucket for the 90-day option so the chart doesn't get illegibly cramped — not required, but worth doing while you're in this code.

### Verification
- Click "Export Excel" and confirm a `.csv` file downloads and opens correctly in Excel/Google Sheets with real request rows (not a fake success toast with nothing behind it).
- Create a few test requests on different simulated days (or check against your existing seed data's real dates) and confirm the Request Volume chart bars actually reflect real counts per day, and that switching the date-range dropdown changes the chart.

---

## Owner-3 — Property cards show "NaN%" for occupancy

### Root cause
`src/pages/management/PropertyDetail.tsx` (`PropertiesList` component):
```tsx
<div><p className="text-lg font-serif font-semibold text-navy-800">{Math.round((p.occupied / p.units) * 100)}%</p>...
```
When `p.units` is `0` (a brand-new property with no units added yet in the Units & Leases tab — this is now the normal starting state after Part 2's fix making occupancy derive from real lease records), `p.occupied / p.units` is `0 / 0 = NaN`, and `Math.round(NaN)` is still `NaN`, rendered as the literal text "NaN%". The exact same calculation elsewhere in the app (`src/pages/management/ManagementDashboard.tsx`) already guards against this:
```tsx
const pct = property.units > 0 ? Math.round((property.occupied / property.units) * 100) : 0;
```
`PropertiesList`'s card just never got the same guard.

### Fix
```tsx
<div>
  <p className="text-lg font-serif font-semibold text-navy-800">
    {p.units > 0 ? Math.round((p.occupied / p.units) * 100) : 0}%
  </p>
  <p className="text-[11px] text-stone-400">{t('occupancyLabel')}</p>
</div>
```

### Verification
Create a brand-new property with zero units added yet — confirm its card shows "0%" occupancy, not "NaN%".

---

## Owner-4 — Property cards show "0 open" even when the property genuinely has activity

### Two separate contributing causes — fix both

**A. The Properties list page reads a static, never-recalculated field.** `PropertiesList`'s card (`PropertyDetail.tsx`) shows:
```tsx
<div><p className="text-lg font-serif font-semibold text-warning-600">{p.openRequests}</p><p className="text-[11px] text-stone-400">{t('open')}</p></div>
```
`p.openRequests` is a **static field on the `Property` object itself**, not a live count. In Supabase mode this is fine — it comes from the `properties_with_stats` view, which correctly recomputes it from the `requests` table on every read. But in **mock mode**, `src/data/client/mock/properties.mock.ts` sets it once at creation and never touches it again:
```ts
async create(input) {
  const property: Property = { ...input, id: genId('prop'), openRequests: 0, emergency: 0 };
  ...
},
```
Nothing in `requests.mock.ts`'s `create()`/`update()` ever increments/decrements `db.properties[i].openRequests`/`.emergency` when a request is created or resolved. So in mock mode, **every property's "open" badge on the Properties list page is frozen at `0` forever**, regardless of how many real requests exist for it — this is the same class of bug as the units/occupied issue fixed in Part 2, just for a different pair of fields.

Compare with `src/pages/management/ManagementDashboard.tsx`, which never reads the static field at all — it recomputes live from the fetched `requests` list (`requests.filter((r) => r.propertyId === property.id && r.status !== 'resolved')`), which is why the Dashboard's own portfolio cards are accurate while the Properties page's cards are not.

**Fix (mock):** stop trusting the static field — compute it the same way the Dashboard does, inside `propertiesMock.list()`/`.get()`:
```ts
function withComputedStats(p: Property): Property {
  const propRequests = db.requests.filter((r) => r.propertyId === p.id && r.status !== 'resolved');
  return {
    ...p,
    openRequests: propRequests.length,
    emergency: propRequests.filter((r) => r.type === 'emergency').length,
    // if Part 2's units/occupied-from-leases fix is already applied, keep that logic here too
  };
}
```
Apply `withComputedStats` in `list()`/`get()` exactly as already recommended for `units`/`occupied` in Part 2's Issue #4 — this is the same fix, extended to cover these two fields as well. (If Part 2's `withComputedStats` helper already exists in your codebase, just add these two fields to it rather than creating a second helper.)

**B. Requests can be attributed to the wrong property in the first place.** This compounds the above: `src/pages/tenant/ResidentSupport.tsx`'s property/unit selectors are **not locked** to the tenant's own property — see Resident-1 below for the full detail. A tenant can currently pick *any* property/unit from the dropdown when submitting a request, not just their own. If a resident's request ever gets attributed to the wrong property (whether by mistake or because their profile's `tenantPropertyId` wasn't set correctly), the property that actually has an active issue can show `0 open` while an unrelated property absorbs the count instead. Fixing Resident-1 (locking the property/unit fields) removes this source of misattribution going forward. If you suspect existing data has already been affected, a quick way to check is comparing each request's `unit`/`propertyId` against the submitting tenant's `tenant_unit`/`tenant_property_id` on their profile, and correcting any mismatches you find.

### Verification
- In mock mode, create a fresh property, submit a request against it as a tenant, and confirm the Properties page's card badge updates to reflect it (not stuck at 0).
- Resolve that request and confirm the badge goes back down.

---

## Owner-5 — Resident-uploaded photos never actually get uploaded, so requests can't show them

### Root cause
`src/pages/tenant/ResidentSupport.tsx`'s photo picker **throws away the actual file** and keeps only its file name as a string:
```tsx
const [photoName, setPhotoName] = useState('');
...
<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setPhotoName(file.name); }} />
...
photo: photoName || undefined,
```
The `File` object itself is never read or uploaded anywhere — `dataSource.storage.upload(...)` (which exists and works — `src/data/client/supabase/index.ts` already implements it against Supabase Storage buckets, including a `request-photos` bucket with RLS policies already defined in the migration) is never called from this form. So `request.photo` ends up being nothing more than a plain filename string like `"IMG_2481.jpg"` with no actual image data behind it anywhere. That's why every request-detail page that tries to show it (`src/pages/tenant/TenantRequestDetail.tsx`) can only render the filename as text next to a broken-image icon:
```tsx
{req.photo && (
  <div className="flex items-center gap-2 text-sm text-stone-500">
    <ImageOff className="w-4 h-4" />
    {req.photo}
  </div>
)}
```
And `src/pages/management/ManagementRequestDetail.tsx` / `src/pages/technician/TechnicianRequestDetail.tsx` don't show the photo field **at all** — there's no matching UI block in either file.

### Fix
**1. Actually upload the file, after the request is created.** The Supabase storage RLS policy for `request-photos` requires the request row to already exist (`storage_request_photos_write` checks `exists (select 1 from requests r where r.id = (storage.foldername(name))[1] and r.tenant_id = auth.uid())`), so the flow has to be: create the request first, then upload using the new request's id as the folder, then patch the request with the resulting URL.
```tsx
const handleSubmit = async () => {
  ...
  try {
    const req = await createRequest({ ...., photo: undefined }); // create without a photo first
    if (photoFile) {
      const { url } = await dataSource.storage.upload('request-photos', `${req.id}/${photoFile.name}`, photoFile);
      await dataSource.requests.update(req.id, { photo: url });
    }
    setSubmittedId(req.id);
    ...
  } catch {
    showToast(t('errorSaving'));
  }
};
```
Replace the `photoName` string state with the actual `File` object:
```tsx
const [photoFile, setPhotoFile] = useState<File | null>(null);
...
<input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setPhotoFile(file); }} />
<span className="text-xs text-stone-500 text-center px-2">{photoFile?.name || t('attachPhotoHint')}</span>
```
Drop the `multiple` attribute on the input unless you're prepared to actually support several photos (see step 4) — right now it lets someone pick multiple files but only ever uses `files[0]`, silently discarding the rest, which is misleading UI.

**2. Allow `photo`/`photo_url` to actually be patched.** `src/data/client/supabase/index.ts`'s `requests.update()` currently whitelists only a few fields:
```ts
async update(id, changes) {
  const patch: Record<string, unknown> = {};
  if (changes.status !== undefined) patch.status = changes.status;
  if (changes.priority !== undefined) patch.priority = changes.priority;
  if (changes.technicianId !== undefined) patch.technician_id = changes.technicianId;
  if (changes.description !== undefined) patch.description = changes.description;
  ...
```
Add:
```ts
  if (changes.photo !== undefined) patch.photo_url = changes.photo;
```
(Mock mode's `update()` already accepts any field via `Partial<Request>`, so no change needed there — just make sure `ResidentSupport.tsx`'s mock-mode photo handling stores something renderable. Since mock mode has no real file storage, convert the picked file to a base64 data URL with `FileReader` and store that directly as `photo`, e.g. `const photo = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(file); });` — this works fine for a demo-scale mock DB.)

**3. Actually render the image**, not just its filename/URL as text, on all three request-detail pages:
```tsx
{req.photo && (
  <div>
    <p className="text-xs text-stone-400 mb-1">{t('photo')}</p>
    <img src={req.photo} alt="" className="rounded-lg border border-stone-200 max-h-64 object-cover" />
  </div>
)}
```
Add this block to `TenantRequestDetail.tsx` (replacing the current filename-with-`ImageOff`-icon block), `ManagementRequestDetail.tsx`, and `TechnicianRequestDetail.tsx` (both currently missing it entirely).

**4. (Optional) Support more than one photo.** If residents should be able to attach several images per request, the schema needs a `request_photos` child table (`request_id`, `photo_url`) instead of the single `photo_url` column on `requests`, plus a matching `RequestPhoto`-style type and a small UI change (a thumbnail strip instead of a single `<img>`). Not required to satisfy "the request page should also show the image" at a basic level — flag it as a follow-up if the person wants multi-photo support later.

### Verification
- Submit a request as a resident with a photo attached, then view that request as: the resident, a manager, and (if assigned) the technician — confirm the actual image renders on all three detail pages, not a filename.

---

## Owner-6 — Units & Leases "occupy" form says "Annual Rent" — should say "Monthly Rent"

### Root cause
Purely a label/copy issue. `src/pages/management/PropertyDetail.tsx`:
```tsx
<label className="text-xs text-stone-500 mb-1 block">{isRtl ? 'الإيجار السنوي (ر.س)' : 'Annual Rent (SAR)'}</label>
<input className="form-input" type="number" min="0" value={occupyRent} onChange={(e) => setOccupyRent(e.target.value)} />
```
The underlying `rent` field itself is just a plain number with no unit attached anywhere in the schema — this is purely a labeling mismatch with what you actually want it to mean.

### Fix
```tsx
<label className="text-xs text-stone-500 mb-1 block">{isRtl ? 'الإيجار الشهري (ر.س)' : 'Monthly Rent (SAR)'}</label>
```
Also check the unit card display a few lines up, which shows the raw number with no period qualifier at all:
```tsx
{u.rent && <p className="text-xs text-copper-600 mt-0.5">{u.rent.toLocaleString()} {isRtl ? 'ر.س' : 'SAR'}</p>}
```
Consider adding a "/mo" (`{isRtl ? '/شهرياً' : '/mo'}`) suffix here too so it reads unambiguously anywhere the figure is shown, not just on the entry form. Grep the rest of the codebase for any other place this same `rent` value is displayed (e.g. a lease summary elsewhere) and apply the same "/mo" suffix for consistency.

### Verification
Open "Occupy Unit" on any vacant unit and confirm the field now reads "Monthly Rent (SAR)" in both languages.

---

# RESIDENT PORTAL

## Resident-1 — Service request form: unit should be pre-selected and locked, not just defaulted

### Root cause
`src/pages/tenant/ResidentSupport.tsx` only **defaults** the property/unit to the tenant's own, but leaves both fully editable:
```tsx
const [selectedPropertyId, setSelectedPropertyId] = useState(session?.tenantPropertyId ?? '');
const [selectedUnit, setSelectedUnit] = useState(session?.tenantUnit ?? '');
...
<select
  value={selectedPropertyId}
  onChange={(e) => { setSelectedPropertyId(e.target.value); setSelectedUnit(''); setErrors({ ...errors, property: false }); }}
  ...
>
  <option value="">{isRtl ? 'اختر العقار' : 'Select property'}</option>
  {properties.map((p) => (<option key={p.id} value={p.id}>{isRtl ? p.name : p.nameEn}</option>))}
</select>
...
<select
  disabled={!selectedPropertyId}
  value={selectedUnit}
  onChange={(e) => { setSelectedUnit(e.target.value); setErrors({ ...errors, unit: false }); }}
  ...
>
```
Both dropdowns list every property/unit in the system and are fully changeable by the tenant — nothing locks them to the resident's actual home. This is both a UX problem (you asked for it to be locked) and a data-integrity one: a resident submitting against the wrong property/unit is exactly what can cause the "0 open" mismatch described in Owner-4 above.

### Fix
When the resident's own property/unit is known (`session.tenantPropertyId`/`session.tenantUnit` are set — which they will reliably be for anyone provisioned through Part 3's Issue #2 flow), show them as **read-only, pre-filled fields**, not editable dropdowns:
```tsx
const hasKnownUnit = Boolean(session?.tenantPropertyId && session?.tenantUnit);
const knownProperty = properties.find((p) => p.id === session?.tenantPropertyId);

...

<div>
  <label className={labelClass}>{t('propertyName')}</label>
  {hasKnownUnit ? (
    <input className={inputClass()} value={knownProperty ? (isRtl ? knownProperty.name : knownProperty.nameEn) : ''} readOnly />
  ) : (
    <div className="relative">
      <select value={selectedPropertyId} onChange={(e) => { setSelectedPropertyId(e.target.value); setSelectedUnit(''); }} className={`${inputClass(errors.property)} appearance-none pe-9`}>
        <option value="">{isRtl ? 'اختر العقار' : 'Select property'}</option>
        {properties.map((p) => (<option key={p.id} value={p.id}>{isRtl ? p.name : p.nameEn}</option>))}
      </select>
      <ChevronDown className="w-4 h-4 text-stone-400 absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  )}
  {errors.property && <p className="text-danger-600 text-xs mt-1">{t('required')}</p>}
</div>
<div>
  <label className={labelClass}>{t('unitNumber')}</label>
  {hasKnownUnit ? (
    <input className={inputClass()} value={selectedUnit} readOnly />
  ) : (
    <div className="relative">
      <select disabled={!selectedPropertyId} value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)} className={`${inputClass(errors.unit)} appearance-none pe-9 ${!selectedPropertyId ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <option value="">{isRtl ? 'اختر الوحدة' : 'Select unit'}</option>
        {unitOptions.map((u) => (<option key={u} value={u}>{u}</option>))}
      </select>
      <ChevronDown className="w-4 h-4 text-stone-400 absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  )}
  {errors.unit && <p className="text-danger-600 text-xs mt-1">{t('required')}</p>}
</div>
```
The fallback dropdowns stay in place only for the edge case where a resident's profile genuinely has no linked property/unit (shouldn't normally happen once Part 3's provisioning flow is used consistently, but is a reasonable safety net rather than blocking them from submitting anything at all).

### Verification
Sign in as a resident whose profile has a linked property/unit and open "Raise a Service Request" — confirm the property and unit fields show as plain read-only text matching their real home, with no dropdown to change them.

---

## Resident-2 — Profile page has no way to change password

This is Part 3's Issue #3, which doesn't appear to have been built yet (or was only partially applied). Restating the essentials here since it's now explicitly requested again:

1. Add `updatePassword(newPassword: string): Promise<void>` to `src/data/client/dataSource.ts`'s `auth` interface.
2. Supabase implementation (`src/data/client/supabase/index.ts`): `const { error } = await supabase.auth.updateUser({ password: newPassword });`
3. Mock implementation (`src/data/client/mock/auth.mock.ts`): update the matching record in the persisted mock users list.
4. Expose `updatePassword` from `src/auth/AuthProvider.tsx`'s context value.
5. Add a "Change Password" form — either on `src/pages/tenant/TenantProfile.tsx` directly (since that's literally the page you're describing) or on `src/pages/tenant/TenantSettings.tsx` under a new "Security" card; two password fields (new + confirm), a minimum-length check, and a success/error toast.

See Part 3's Issue #3 for the full sample component code — it can be dropped in largely as-is.

### Verification
Sign in as a resident, set a new password from the Profile (or Settings) page, sign out, sign back in with the new password and confirm the old one no longer works.

---

## Resident-3 — Notification bell should only show the top 3

### Root cause
`src/components/shared/NotificationBell.tsx` renders every notification with no limit:
```tsx
{notifications.length === 0 ? (
  <div className="px-4 py-8 text-center text-stone-400 text-sm">{t('noNotifications')}</div>
) : (
  notifications.map((n) => (
    ...
  ))
)}
```

### Fix
```tsx
notifications.slice(0, 3).map((n) => (
  ...
))
```
This component is shared across all portals (management and tenant both use it), and you only mentioned this for the Resident portal. If you want it limited everywhere for consistency, use the change above as-is. If you specifically want residents capped at 3 while management still sees the full list, condition it:
```tsx
(isTenant ? notifications.slice(0, 3) : notifications).map((n) => ( ... ))
```
Either way, consider adding a small "View all" link at the bottom of the panel (routing to a dedicated notifications page, if one exists or is worth adding later) so capping the dropdown doesn't hide older notifications entirely — not required to satisfy the request, but worth flagging so people don't lose access to older alerts.

### Verification
Trigger 4+ notifications for a resident account and confirm the bell dropdown shows only the 3 most recent.

---

# OVERALL

## Add a confirmation step before signing out

### Root cause
Every "Sign Out" button in the app calls `signOut()` immediately on click, with no confirmation step — in `ManagementLayout.tsx`, `PmLayout.tsx`, `TenantLayout.tsx`, `TechnicianLayout.tsx`, and `TenantProfile.tsx`.

### Fix
Build one small reusable confirm dialog on top of the existing `src/components/ui/Modal.tsx`, then use it everywhere sign-out happens instead of calling `signOut()` directly.

`src/components/shared/ConfirmDialog.tsx` (new):
```tsx
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, danger }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-stone-600 mb-5">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
        <Button onClick={onConfirm} className={danger ? 'bg-danger-600 hover:bg-danger-700 text-white border-none' : ''}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
```

In each layout (shown for `ManagementLayout.tsx`, apply the same pattern to the other three layouts and `TenantProfile.tsx`):
```tsx
const [confirmingLogout, setConfirmingLogout] = useState(false);

const handleLogout = () => {
  void signOut().then(() => navigate('/', { replace: true }));
};

// change the Sign Out button's onClick from handleLogout directly to:
<button onClick={() => setConfirmingLogout(true)} ...>{t('signOut')}</button>

// and render, once per layout:
<ConfirmDialog
  open={confirmingLogout}
  title={isRtl ? 'تسجيل الخروج' : 'Sign Out'}
  message={isRtl ? 'هل أنت متأكد أنك تريد تسجيل الخروج؟' : 'Are you sure you want to sign out?'}
  confirmLabel={t('signOut')}
  cancelLabel={t('cancel')}
  onConfirm={() => { setConfirmingLogout(false); handleLogout(); }}
  onCancel={() => setConfirmingLogout(false)}
  danger
/>
```

### Verification
Click "Sign Out" in each of the four portals and on the resident Profile page — confirm a dialog appears asking to confirm, "Cancel" leaves you signed in, and confirming actually signs you out.

---

## Summary of files touched by this report

- `src/pages/management/UsersPage.tsx`, `src/data/client/supabase/index.ts`, `src/data/client/dataSource.ts`, `src/data/client/mock/users.mock.ts`, `src/data/client/mock/auth.mock.ts` — real "Add User" flow via the `provision-user` Edge Function (Owner-1).
- `src/pages/management/Reports.tsx` — real CSV export, print-based PDF export, real request-volume chart (Owner-2).
- `src/pages/management/PropertyDetail.tsx` — fix NaN occupancy guard, fix "Annual" → "Monthly" rent label (Owner-3, Owner-6).
- `src/data/client/mock/properties.mock.ts` — compute `openRequests`/`emergency` live instead of a static field (Owner-4).
- `src/pages/tenant/ResidentSupport.tsx`, `src/data/client/supabase/index.ts`, `src/pages/tenant/TenantRequestDetail.tsx`, `src/pages/management/ManagementRequestDetail.tsx`, `src/pages/technician/TechnicianRequestDetail.tsx` — actually upload and render request photos (Owner-5), and lock the property/unit fields (Resident-1).
- `src/data/client/dataSource.ts`, `src/data/client/supabase/index.ts`, `src/data/client/mock/auth.mock.ts`, `src/auth/AuthProvider.tsx`, `src/pages/tenant/TenantProfile.tsx`/`TenantSettings.tsx` — password change (Resident-2, restating Part 3 Issue #3).
- `src/components/shared/NotificationBell.tsx` — cap the dropdown at 3 (Resident-3).
- `src/components/shared/ConfirmDialog.tsx` (new), `src/components/layouts/ManagementLayout.tsx`, `PmLayout.tsx`, `TenantLayout.tsx`, `TechnicianLayout.tsx`, `src/pages/tenant/TenantProfile.tsx` — logout confirmation (Overall).
