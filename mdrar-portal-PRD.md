# MDRAR PORTAL — PRODUCT REQUIREMENTS DOCUMENT

**Client:** Mdrar Real Estate, Riyadh, Saudi Arabia
**Product:** Unified Facility Management, Project Management & Finance platform
**Document purpose:** Complete A-to-Z reference so any developer can pick this up and understand the full system — current scope, exact field-level specs, what was deliberately removed, and why.
**Status:** Front-end prototype (no backend) approved through multiple client review rounds; ready for production build.

---

## 1. Product Overview

Mdrar Real Estate needed one connected system to replace scattered spreadsheets, WhatsApp threads, and manual processes across three areas of their business:

1. **Facility Management** — tenant-facing maintenance requests and internal property/ticket management.
2. **Project Management** — tracking real estate development projects from mobilization to handover, including schedule, budget, units, documents, risks, and payment documentation.
3. **Finance** — not yet built; a future module that will consolidate cost/profit data from the other two. Currently a placeholder.

The three modules are unified under one **Suite Hub** entry point.

### 1.1 Non-Negotiable Product Principles

- **Arabic-first.** The application opens in Arabic (`ar`) with RTL layout by default. English is a toggle, not the default.
- **Real RTL, not mirrored text.** Logical CSS properties, mirrored icons/sidebars/chevrons, and — critically — timelines/Gantt charts must flow right-to-left in Arabic, not just have RTL text pasted onto an LTR chart.
- **Mobile-first.** Every screen must work at 360–430px with zero horizontal scrolling, before scaling up to desktop.
- **No emojis anywhere**, in any language, in any UI copy.
- **This is a front-end design prototype.** No real backend, no database, no API calls. All data is mock/dummy, held in local shared state (React Context+reducer or Zustand — pick one and use it consistently throughout), persisted to `localStorage`. Every button must be functionally wired against this mock state — nothing should look clickable and do nothing.
- **Full CRUD everywhere data is entered.** Add/Edit/Delete must work live, with no page reload, for every entity in this document unless explicitly marked read-only.

---

## 2. Brand & Design System

**Important distinction — two related but separate design contexts exist. Do not conflate them:**

### 2.1 The Application UI (all in-app screens)

Use Mdrar's real brand identity, based on their company profile materials:

- **Primary/dark accent:** deep burgundy/maroon (approx. `#3B0B12`)
- **Background:** warm cream/off-white (approx. `#EDE6D8`), never cold white/grey
- **Alternating content blocks:** soft powder-blue (`#D9EEFB`) and soft butter-yellow (`#F5ECD3`)
- **Typography:** elegant serif (Playfair Display / Fraunces) for headings, clean sans-serif (Inter/Manrope) for body/UI. Arabic uses a proper Arabic-supporting font (Noto Kufi Arabic, Tajawal, or IBM Plex Sans Arabic) — never a fallback font.
- **Brand mark:** the Mdrar horse motif + "مـدرار / MDRAR" logo lockup, used sparingly (headers, empty states) — never overused.
- **Shape language:** soft rounded corners (10–14px), thin hairline borders instead of heavy shadows, generous whitespace.
- **Status colors:** desaturated, on-brand — never neon, never generic SaaS blue. On Track/Completed = muted slate blue or olive-green; At Risk/Pending = muted amber; Delayed/Emergency = muted terracotta-red.

### 2.2 The Standalone PDF Executive Report (Section 9 below)

This is a **separate, client-approved artifact** with its own specific palette — **navy blue (`#1F3A5F`) and gold/amber (`#C9A227`)**, on a **plain white background** (not cream). This palette was explicitly approved by the client from a reference design and must be followed exactly as specified in Section 9 — do not substitute the app's burgundy/cream theme into this report.

---

## 3. Suite Hub (Application Entry Point)

The application root (`/`) loads the Suite Hub — the first thing any user sees, in Arabic/RTL by default.

- Mdrar wordmark + horse mark, headline ("منصة مدرار المتكاملة" / "The Mdrar Integrated Platform"), short subtext.
- Three cards: **Facility Management**, **Project Management**, **Finance** (styled identically — Finance is a real roadmap item, not greyed out).
- Facility Management → the FM role-selection screen (Section 4.1).
- **Project Management → a choice screen** with two options:
  - **"Go to PM Management System"** → the normal internal Projects Dashboard (Section 5).
  - **"View Executive"** → prompts a project picker (since the Executive Page is per-project), then opens that project's Executive Page (Section 6).
- Finance → a polished "Coming Soon" screen with 2–3 greyed-out preview stat cards ("Portfolio Revenue," "Project Costs," "Net Profit") and a "Back to Hub" button.
- A persistent Suite Switcher in the header lets the user jump between modules without losing context.

---

## 4. Facility Management Module

### 4.1 Role Selection

Two cards: **Owner/Manager Portal** and **Tenant Portal**.

### 4.2 Tenant Portal

Bottom tab bar: **Home / Requests / Profile**. (No "Bookings" tab — a "Book a Facility" feature was explicitly scoped out and removed; do not build it.)

**Home:** Mdrar wordmark, notification bell (unread badge), language switcher, personalized greeting, property/unit, rent-status chip, announcement card, "Quick Actions" — exactly three tiles: **Maintenance Support**, **Contact Manager**, **Emergency Contact** (laid out cleanly as 3 tiles, not a broken 2×2 grid with an empty slot — "My Lease" was here originally and has been fully removed, including its route, page, and all references). Below that, a "Recent Requests" list with type badge and status.

**Maintenance Support** (renamed from "Resident Support" — apply this rename everywhere: headings, buttons, i18n dictionaries, empty states, toasts): the request form, **exact field order, no additions**:

1. **Request Type** (required): Preventive / وقائي, Corrective / تصحيحي, Emergency / طارئ.
2. **Category** (required, disabled until Request Type selected): Air Conditioning, Plumbing, Electrical, Common Area.
3. **Description** (textarea).
4. **Add Photo** (mock upload, dashed-border drop zone).
5. **Submit Request** button (prominent burgundy).

If Emergency is selected: show an inline warning and an urgent (non-neon) visual treatment. On submit: validate required fields → create request (status = Submitted) → add to Recent Requests → create a management-side notification and increment its bell badge **instantly, no reload** → success toast → return to Home.

Layout: desktop = compact centered modal (not full-width); mobile = near full-width, safe padding, internally scrollable, never causes horizontal page scroll.

**Request Detail:** type, category, description, photo, status, timeline (Submitted → Acknowledged → Technician Assigned → In Progress → Resolved), "Message Property Manager" (opens chat).

**Contact Manager:** mobile-style chat thread, message list + input + send, updates live.

**Profile/Settings:** editable contact fields, notification toggles, language toggle.

### 4.3 Management Dashboard

Stat cards: Total Properties, Portfolio Occupancy, Open Requests, **Emergency Requests** (always visible, never buried). Property grid (mock data: Jazly Plaza, Wahat Qurtuba, Al-Ajou Square, MDRAR Al-Arid Villas, Al-Nasriyah Residential Compound, Wahat Al-Munsiyah, Wahat Al-Narjis, Wadi Al Dawasir Residences), each showing occupancy/open-requests/emergency flag.

**Property Detail:** tabs — Overview / Units & Leases / Requests / Documents.

**Request Management (portfolio-wide):** filters (Property, Request Type, Status, Category, date-range, text search — all instant/combinable). Emergency requests remain visually distinct regardless of active filters.

**Emergency View:** same list, permanently filtered to Emergency, reachable from the dashboard's Emergency stat card.

**Request Detail (Management):** Assign Technician dropdown, status actions (Acknowledge / Start Progress / Mark Resolved), each appending a timestamped timeline entry with an optional "Tenant notified" tag.

**Reports & KPIs:** ticket volume, average resolution time, recurring-issue flags, technician performance, SLA compliance, date-range/property filters, PDF/Excel export.

**Users & Roles:** Super Admin, Facility Manager, Technician, Owner (Read-Only). Table: Name, Email, Role, Assigned Properties. "Add User" creates a row immediately.

**Settings:** notification toggles (Emergency alerts, daily summary, SMS), language.

---

## 5. Project Management Module

### 5.1 Portfolio Dashboard (`/pm`)

Stat cards: Total Projects, Average Progress, Projects On Track, Total Units. Two charts: **Progress by Project** (horizontal bar) and **Portfolio Timeline Overview** (rolled-up Gantt strip with a "today" marker) — themed to the app's brand colors (Section 2.1), never default chart-library colors. (Note: the per-status donut belongs on each project's own Overview tab, not here — see 5.2.)

Project cards grid, 7 mock projects (Al Rimal Villas — 64 villas, Wahat Al-Narjis Phase 2, Jazly Plaza Expansion, Al-Ajou Residences, Wahat Al-Munsiyah Towers, Al-Nasriyah Phase 3, Wadi Al Dawasir Extension), each with progress bar, status badge, target handover date. "Add Project" form: Name (both languages), Location, Total Units, Unit Types, Start/Completion Dates, Contractor, Consultant, Contract Number, Total Budget — creates a new card immediately.

### 5.2 Project Detail — Tabs

`Overview | Schedule | Units | Documents | Schedule KPI | Risks & Responsibilities | IPC`

Plus a separate, one-page **Executive** view reachable outside this tab set (Section 6).

#### 5.2.1 Overview Tab

- Key facts, project description, **Edit button** (opens a form to update name, location, units, dates, contractor, budget, and description).
- **Status Distribution donut chart** — per-project only (Not Started / In Progress / Completed / Delayed breakdown for that project's own activities). Never an aggregated portfolio figure.
- **IPC summary section** — live status tiles for the most recent Contractor IPC, Consultant Claim, and Outgoing IPC entries (mirrors the Executive Page's IPC tiles, same data source — Section 7).

#### 5.2.2 Schedule Tab

Activity structure (translate every phase/activity name into natural Arabic, no transliteration):

```
MILE-01   Project Start Milestone
MOB-01    Mobilization & Site Establishment
ENG-01    Design Coordination & Shop Drawings
ENG-02    Mockup Preparation & Approvals
PRO-01    Procurement of Long Lead Items
CON-01    Surveying & Setting Out
CON-02    Excavation & Earthworks
CON-03    Foundations & Substructure
CON-04    Superstructure (Concrete Frame)
CON-05    Masonry (Block Works)
CON-06    MEP First Fix (Internal)
CON-07    Roofing & Waterproofing
CON-08    Internal Plastering Works
CON-09    External Plaster & Façade
CON-10    Ceiling & Partition Works
CON-11    Floor & Wall Finishes
CON-12    Aluminum, Windows & Glazing
CON-13    Doors & Joinery Works
CON-14    External Works & Infrastructure
FIN-01    Painting Works (Final Coat)
FIN-02    MEP Second Fix & Testing
FIN-03    Landscaping & Irrigation
TST-01    Testing & Commissioning
TST-02    Snagging & Rectification
TST-03    Final Cleaning & Handover
```

**Gantt chart:**

- X-axis shows **both a real calendar date and the day-count** under it (e.g. "28 Feb 2026" / "D0"), calculated from the project's Start Date. Date is the primary label; day-count is secondary.
- A **vertical "Today" line** spans the full chart height (through the date axis and every activity row), recalculating daily, with a small "Today" label. Equivalent indicator on the mobile stacked view.
- Each activity bar shows **Planned** timeline (the base bar) with **Actual Start** (green vertical marker/hairline) and **Actual End** (red vertical marker/hairline) overlaid on top — letting the PM see at a glance whether work started/finished early, on time, or late, both visually and as a numeric day-difference.
- **Actual Progress** renders as a segmented pill-track-with-thumb slider overlaid on the bar (rounded track, small tick segments, one enlarged colored "thumb" segment positioned at the real percentage, with the percentage number shown on the thumb) — replacing any plain floating percentage badge. On short-duration bars, the track overflows outside the bar rather than compressing illegibly. Exactly one percentage renders per bar — never duplicated/stacked text.
- **Planned Progress** is separate from Actual Progress: read-only, auto-calculated continuously from `(days elapsed since Start Date) / (total duration) × 100`, clamped 0–100%. It is never manually set.

**Activity Edit form fields:**

- Activity Name (AR/EN), Activity ID, Phase (dropdown)
- **Start Date / End Date** — real calendar date pickers, always editable (not locked). **Duration (days)** is read-only, auto-derived from Start/End Date.
- Assigned Team (AR/EN)
- **Planned Progress** — read-only, auto-calculated, labeled "Calculated automatically from dates."
- **Actual Progress** — a manual, freely-draggable slider (0–100%, quick-select marks at 0/60/100), clearly visually distinct from Planned Progress. No "calculated automatically" label on this one.
- Update Status dropdown: Not Started / In Progress / Completed / Delayed
- Description (textarea)
- **Planned Cost (SAR)** and **Actual Cost Spent (SAR)** — both present; every mock activity is seeded with both values (never left empty — this feeds Schedule KPI, Section 5.2.5)
- **Change Order Amount (SAR)** — a separate field per activity; sums live into the project's Change Order Budget (shown on Overview)
- **Photos** — a repeatable gallery sub-tab within the activity (not a single-attachment field): "Upload Photo" auto-tags each photo with today's date; date-range filter/search within the gallery; multiple uploads never overwrite previous ones.
- Save / Cancel

Full CRUD: Add/Edit/Delete Activity, with live recalculation of the project's overall progress, the Overview status chart, and the two S-curve charts (below) on every change.

**S-Curve charts** (on the Overview tab, alongside the Status Distribution donut):

- **Progress Curve** — Planned Progress Line (auto, cumulative) vs Actual Progress Line (cumulative from manual entries), plotted over the project timeline, with a "today" marker.
- **Cost Curve** — same pattern for Planned Cost vs Actual Cost, cumulative over time.

**Report export:** a "Download Report" button on the Schedule tab generates a **real, saved PDF** (not mock) — Activity ID, Name, Phase, Start/End Date, Duration, Team, Planned/Actual Progress, Planned/Actual Cost, photo count/dates.

**View Range filter:** full preset list — **1 through 12 individual month options**, plus **Full Project** and **Custom** (date-range or a custom multi-month span). Use a dropdown if a button row is too crowded. Apply the same full preset range on the Executive Page's Schedule KPI filter (Section 6).

#### 5.2.3 Units Tab — Models → Units (Two-Level, Full CRUD)

**This hierarchy must be built correctly the first time** (it broke in earlier iterations — get the parent/child relationship right):

1. **Units tab shows Models only** — a grid/list of Model cards (e.g. "Type B Villa," "Type B Apartment"), each showing name, size, bedrooms, total unit count. No floor-plan/3D-model/brochure buttons at this level.
2. **Tapping a Model opens that Model's own page**: model info + Edit/Delete, an **"Add Unit"** button, and a list of unit blocks **belonging only to that model** (every Unit record stores a parent Model ID; filter strictly by it — a unit created under Model A must never appear under Model B). If units already exist, they display immediately; the empty "add your first unit" state shows only when a model genuinely has zero units.
3. Each unit block: name, size, bedrooms, unit reference, **View Floor Plan / View 3D Model / Download Brochure** buttons — each asset individually editable/replaceable via mock upload. Full Edit/Delete per unit.

**Unit-type-specific fields** (client-mandated, apply within the Model/Unit forms above):

| Unit Type                                      | Field Changes                                                                                                                                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Villa**                                      | **Remove** the Floor field entirely (doesn't apply). **Add:** Price (SAR), Space (sqm), Attachment (mock upload).                                                                                                               |
| **Floor-based unit** (apartment/building unit) | Floor becomes a **dropdown**: Ground / 1st / 2nd (not free text/number). **Add:** Price (SAR), Space (sqm).                                                                                                                     |
| **Townhouse**                                  | **Add** a dropdown: **Townhouse A / Townhouse B** (A = ground-level unit, B = the unit above it — a townhouse is conceptually half a villa; one villa footprint = 2 townhouses). **Add:** Price (SAR), Space (sqm), Attachment. |

#### 5.2.4 Documents Tab

Categories render as **interactive buttons/tiles** (Construction Contracts, Master Plan, Construction Files, etc.), not static text rows. Clicking a category opens its own dedicated page for multiple file uploads (drawings, specs, reports, correspondence — any file type, repeatable, never overwritten). Full CRUD: upload, view, update/replace, delete, download.

**Categories must be renameable** by the Project Manager — an edit/rename action on each category. Renaming must not disconnect documents already filed under it (associate by category ID, not display name).

#### 5.2.5 Schedule KPI Tab (renamed from "Quantity Table" — apply this rename everywhere: tab label, headings, exports, both i18n dictionaries; no leftover old name anywhere)

Planned-vs-actual cost comparison, populated on first load (never empty):

- Columns, in order: Activity Name → Budget/Planned Cost → **Actual Spent** → **Actual Progress %** (this exact position — after Actual Spent, before Variance; pulled from the same Schedule-tab value, not a separate entry) → **Variance** (Planned − Actual, SAR) → **Variance %** (2 decimal places, e.g. "4.27%"), both color-coded (muted green = on/under budget, muted red = over).
- Summary row: totals for Planned, Actual, Variance, Variance %.
- Reads live from Schedule tab data — editing an activity's cost there updates this table instantly.
- Date-range filter (full 1–12 month presets, Section 5.2.2) and text search.
- Downloadable (PDF/Excel).

#### 5.2.6 Risks & Responsibilities Tab

Table + "Add Risk" form: Risk Name (AR/EN), Date Raised, Deadline, Responsible Person (AR/EN), Description, Reason if Delayed, **Attachments** (any file type — PDF, photo, video; repeatable, multi-file, same pattern as Schedule photos), and a **Result/Status** field: **Pending / In Progress / Resolved (Done) / Delayed**. Full CRUD.

**The Result/Status must show as a color-coded badge on the outer risk list itself**, not only inside the edit form.

#### 5.2.7 IPC Tab (replaces the old external-portal approval workflow — see Section 8 for what was removed)

No login, no role-picker — this is a Project-Manager-only internal logging tool. Two pages:

**Incoming IPC** — two sections:

- **Contractor IPC**
- **Consultant Claim**

**Outgoing IPC** — a single list (the IPC Mdrar itself raises and sends to the bank, to then pay the contractor/consultant). Uses a "Reference" field instead of a contractor/consultant name field.

Every entry form (all three sections) has: name/reference, **Phase/Task dropdown** (populated from that project's real Schedule activities), Amount (SAR), Attachments (any file type, repeatable), Description, and a **Status dropdown with exactly three options — In Progress, Delayed, Completed** (no "Pending"). New entries default to **In Progress**. The submit button reads **"Store,"** not "Submit" — this is a deliberate wording choice (this represents documentation of something already handled by email, not a request for approval). Full CRUD; status can be changed manually at any time and updates everywhere it's displayed (Overview tab summary, Executive Page tiles) instantly.

---

## 6. Executive Page (One Page Per Project)

A separate, **single-page**, CEO-facing summary — reachable via the Suite Hub's "View Executive" path (Section 3) or from within a project. **No further tab drill-down from this page** — it does not link into Schedule/Units/Documents. This is additional to, not a replacement of, the internal Project Detail tabs in Section 5.2, which the PM still uses day-to-day.

Contents:

- Header (project name, contract no., contractor, consultant, report date).
- **Five KPI cards** (Budget, Executed To Date, Financial Progress [highlighted], Remaining Value, Change Orders Budget).
- Financial Position bar chart + Executed vs. Remaining donut chart (app's brand colors per Section 2.1, rounded arc end-caps, dark/legible text — see the white-text bug note in Section 10).
- Project Stage Position bar.
- **Schedule KPI** embedded here too, with the full 1–12 month + Full Project + Custom filter (Section 5.2.2/5.2.5).
- **Live IPC status tiles** — the 2 most recent entries each for Contractor IPC, Consultant Claims, and Outgoing IPC, color-coded by status, updating instantly from Section 5.2.7's data.
- **Risks & Responsibilities — strictly read-only** on this page (no add/edit/delete controls; the PM manages risks from Section 5.2.6).
- **No "Download Report" button on this page** — that functionality lives only in the standalone PDF Executive Report (Section 9), which is a separate artifact from this live page.

---

## 7. Finance Module

Placeholder only. Route `/finance`: on-brand "Coming Soon" screen — icon, headline (قريباً / Coming Soon), description (future profit/loss linking Project Management costs with Facility Management revenue), 2–3 greyed-out preview stat cards, "Back to Hub" button. Do not build real functionality here yet.

---

## 8. Explicitly Removed / Deleted Features

**Do not reintroduce any of these** — they were deliberately removed after client review, replaced by what's described above:

- **"Book a Facility"** (Tenant Portal) — fully removed, no Bookings tab.
- **"My Lease"** (Tenant Portal) — fully removed: quick action, route, page, all references.
- **The old external-portal approval workflow**: Contractor Portal, Consultant Portal, Project Manager — Requests (approve/reject chain), Finance Portal, and all associated multi-stage submit → Consultant-approve → PM-approve → Finance-process logic, rejection/resubmission cycles, and role-based logins/standalone routes for these four. Rejected by client management because a court will not recognize approvals that only happened inside a dashboard — real approval now happens over email, outside the system. **Fully deleted, not hidden** — replaced entirely by the simple IPC logging system (Section 5.2.7).
- **"Create Request Manually"** button (was part of the old workflow) — removed.
- **"Download Report" button on the Executive Page** (Section 6) — removed per final client instruction, even though an earlier round had kept it; the standalone PDF report (Section 9) is unaffected and still exists.

---

## 9. Standalone PDF Executive Report

A **separate, real, downloadable PDF** (distinct from the live Executive Page in Section 6), reachable via a "Download Report" button on the Project **Overview** tab (positioned directly above the Status Distribution chart). Uses the navy/gold palette on white background (Section 2.2) — this is an approved, fixed design; replicate it exactly, not the app's cream/burgundy theme.

**Critical technical constraint:** use a **standard PDF base-14 font** (Helvetica-equivalent) for this export specifically. Custom/embedded brand fonts previously caused text to render as solid black boxes in Chrome's PDF viewer and blank/invisible in macOS Preview — same underlying file, different failure per renderer, while the text still extracted correctly (proving the content was fine but the embedded font's glyph data was corrupted). **Verify by opening the actual downloaded PDF in at least two different real PDF viewers** — never trust an in-app preview or text-extraction check alone for this.

### Page 1 — Executive Snapshot

- Header: Project Name; subtitle **exactly once** — "Contract No. [value] · Payment Certificate No. [latest cert ID] Summary" (a duplicated-label bug recurred here across multiple rounds — test this specifically on more than one project before considering it fixed). Right-aligned Contractor / Consultant / Report Date.
- **Five KPI cards** (no "Latest Certificate Value" — explicitly removed): Budget, Executed To Date Value, **Financial Progress** (highlighted, dark background, white text — ensure sufficient contrast; label text needs enough row height to wrap onto two lines without a border line cutting through it, a bug that occurred once), Remaining Value, Change Orders Budget.
- Two chart panels: **Financial Position** (real bar chart, 3 bars: Budget/Executed/Remaining, values labeled above bars) and **Executed vs. Remaining** (real donut chart with rounded arc end-caps, center percentage in dark/legible text — a white-on-white text bug occurred here once, verify contrast explicitly).
- **"PROJECT STAGE POSITION — [N] STAGES TRACKED"** — exact format: all caps, em dash (—), number-before-label. A plain hyphen instead of em dash was a recurring bug.
- Two tables: **"Payment Certificates Requiring Attention"** (unpaid only) and **"Consultant Claims"** (all) — Status column shows **only "Paid" or "Not Paid"**, never internal workflow-stage labels.
- No redundant footer summary row (a Budget/Change Orders/Total row here was flagged as duplicating the KPI cards and removed).
- Ensure both tables' combined width fits the page with margin to spare — a column-width miscalculation previously caused a status pill to spill off the page edge.
- Page background and all card/panel backgrounds are **plain white**, not cream.

### Page 2 — All Project Tasks, Planned vs Actual

Every real Schedule activity, no filtering, **six columns exactly**: Task Name, Planned Progress %, Actual Progress %, **Planned Spent (SAR)**, Actual Spent (SAR), Status.

### Data Integrity Rule

Every field/label/number must trace to real dashboard data. No template-inherited placeholder text (an earlier draft had a stray "Revised IPC"-style label with no backing data — this class of bug must not recur). Genuinely unset values show "N/A," never a broken character.

---

## 10. Known-Tricky Bugs (context so they aren't reintroduced)

- **Font embedding in PDFs**: see Section 9's critical constraint — use base-14 fonts for the PDF export path only.
- **Certificate label duplication**: "Payment Certificate No. Payment Certificate No. X" — recurred after a first "fix." Test across multiple projects.
- **Gantt percentage badges**: rendered duplicated/stacked at one point; must show exactly once per bar.
- **Units hierarchy**: units were rendering flat/disconnected from their parent Model at one point — enforce the parent Model ID relationship strictly.
- **White-on-white text**: occurred on the Financial Progress value after a chart recoloring pass — always verify contrast after any chart/color styling change.
- **Table overflow off page edge**: column widths must be calculated to fit within the actual available content width (page width minus margins minus panel padding), not just assumed.

---

## 11. Glossary

- **IPC** — Interim Payment Certificate (a claim for partial payment during a construction project).
- **BOQ** — Bill of Quantities (referred to in this app as the "Schedule KPI" tab, formerly "Quantity Table").
- **S-Curve** — a cumulative progress/cost chart over time, standard in construction project management, used to compare Planned vs Actual trajectories.

---

## 12. Out of Scope (Roadmap, Not Built Now)

- A future payment-approval cycle was discussed (Construction Company uploads a progress-payment request → a "Consulting Office" review stage → Project Manager approval → automatic routing to Finance) but was explicitly deprioritized by the client ("don't rush into it") and later superseded entirely by the simpler IPC logging approach in Section 5.2.7. Do not build the old approval-cycle version.
- Full Finance module functionality (Section 7 is a placeholder only).
- Real backend/database/API — this entire document describes a front-end prototype.
