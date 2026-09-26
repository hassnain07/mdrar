# Task: Restore missing features/charts from old `pm.zip` into the optimized `pm (1).zip`

## Context
`pm.zip` (OLD) is a working but monolithic version of these Project Management pages.
`pm (1).zip` (NEW) is a refactored/optimized version: the old 2164-line `ProjectDetail.tsx`
was split into `ProjectDetail.tsx` + `ProjectOverviewTab.tsx` + `ProjectActivitiesTab.tsx` +
`ProjectUnitsTab.tsx` + `ProjectQuantityTab.tsx` + `ProjectRisksTab.tsx` + `ProjectEditModal.tsx`,
and data access moved from a monolithic `useStore()` context to React Query hooks
(`useProject`, `useActivityList`, `useIpcList`, `useCreateActivity`, etc.) plus a
`dataSource.storage.upload(...)` file-upload service.

**Ground rule: do not revert any of this new architecture.** Do not reintroduce
`useStore`/`StoreContext`, do not merge files back together, do not remove React Query
hooks, and do not remove the `dataSource.storage.upload` pattern. Every fix below must be
implemented **inside the new modular files**, using the new data/hook patterns. The OLD
file is a reference for *what UI/logic to port*, not a template to copy wholesale.

Work through the tasks in order. Each task names the exact NEW file to edit and the exact
OLD file section to port the logic/JSX from (`pm/ProjectDetail.tsx` in the OLD zip unless
stated otherwise). After each task, run the type checker / linter before moving on.

---

## 0. Critical bugs first (silent data loss — fix before anything else)

### 0.1 Activity photo uploads are never saved
**File:** `pm_new/pm/ProjectActivitiesTab.tsx` (`ActivityForm`, ~line 260-300, and `handleSave` ~line 90)
**Problem:** `ActivityForm` uploads files to `dataSource.storage.upload('activity-photos', ...)` and
stores the returned URLs in local state `photoUrls`, but `photoUrls` is **never included** in the
object passed to `onSave(...)`. Every photo a user uploads is silently discarded on save. The form
also never loads/shows `activity.photos` that already exist on the record being edited (so editing
an activity with photos looks like it has none).
**Fix:**
- Initialize `photoUrls` from the activity being edited (`activity?.photos` — check the actual
  `ProjectActivity`/`ActivityPhoto` type for the correct field/shape in this codebase; it may be an
  array of URLs or an array of `{id, dataUrl/url, fileName, fileType, uploadDate}` objects — match
  whatever shape `useActivityList`/`useCreateActivity`/`useUpdateActivity` already expect).
- Include the photo list in the `onSave(...)` payload (the `handleSave` function in
  `ProjectActivitiesTab.tsx` builds the `activity` object — add a `photos`/`photoUrls` key there,
  named to match the existing type).

### 0.2 Risk attachment uploads are never saved
**File:** `pm_new/pm/ProjectRisksTab.tsx` (`RiskForm`, ~line 150-215)
**Problem:** identical bug — `photoUrls` is uploaded to `dataSource.storage.upload('risk-photos', ...)`
but never included in the `onSave(...)` call (~line 212).
**Fix:** same pattern as 0.1 — initialize from the existing risk's attachments when editing, and
include the uploaded URLs in the `onSave(...)` payload.

---

## 1. Overview tab — restore the missing Cost Curve chart and budget rows
**File:** `pm_new/pm/ProjectOverviewTab.tsx`
**Reference in OLD file:** `pm/ProjectDetail.tsx` lines ~647-663 (Cost Curve chart) and
lines ~588-596 (Key Facts budget rows).

1. **Cost Curve chart** — the Overview tab currently renders only the "Progress Curve" line chart
   (`planned`/`actual` %). The OLD version also rendered a second card directly below it titled
   `t('pm:costCurve')` with a `LineChart` plotting `plannedCost` vs `actualCost` (same `curveData`
   array, same axis/legend style, using `t('pm:plannedCost')` / `t('pm:actualCost')` as series
   names, stroke colors `#637b8e` / `#b86b4b`). Add this second chart card back, reusing the
   existing `curveData` memo in `ProjectOverviewTab.tsx` — extend that memo to also compute
   cumulative/at-day `plannedCost` and `actualCost` per activity (mirror the % logic already used
   for `planned`/`actual`, but summing `a.plannedCost` / `a.actualCost` instead of progress).
2. **Key Facts card** — add back two rows after "Budget" that were dropped:
   - `t('pm:changeOrderBudget')`: sum of `activities.reduce((s, a) => s + (a.changeOrderAmount ?? 0), 0)`.
   - `t('pm:totalBudgetWithChanges')`: `project.budget + <the sum above>`, styled as a bold summary
     row with a top border (see OLD file for exact classNames).

---

## 2. Schedule tab — restore the interactive Gantt chart (desktop) and variance UI
This is the biggest piece of missing functionality. The NEW `ProjectActivitiesTab.tsx` replaced
the entire OLD Gantt/timeline UI with a plain phase-grouped list (no timeline at all). Port the
following from the OLD `pm/ProjectDetail.tsx` **without breaking the new data hooks**
(`useActivityList`, `useCreateActivity`, `useUpdateActivity`, `useDeleteActivity`).

**File:** `pm_new/pm/ProjectActivitiesTab.tsx`

### 2.1 Port the `GanttChart` component
Copy the `GanttChart` function from OLD `pm/ProjectDetail.tsx` (lines ~1363-1644) into
`ProjectActivitiesTab.tsx` (or a new sibling file `GanttChart.tsx` imported by it — prefer a
separate file to keep the tab file lean, matching the codebase's new modular style). Keep it
functionally identical: draggable/touch-scrollable timeline, phase-collapsible rows, today
marker line, actual-start/actual-end vertical markers on each bar, and the legend row
(`plannedDates`, `actualStartMarker`, `actualEndMarker`, `todayMarker`).
Render it for **desktop** (`md:block` / hidden on mobile, matching how the OLD file switched
between the desktop Gantt and the mobile checklist), feeding it `filtered` activities (already
computed in the tab) instead of the OLD file's `filteredActivities`.

### 2.2 Port the view-range controls
OLD file lines ~740-770: a `<select>` bound to `viewRangePreset` with options
`1 / 3 / 4 / 5 months`, `t('pm:rangeFull')`, `t('pm:rangeCustom')`, and — when `custom` is
selected — two date inputs (`t('pm:customStart')`, `t('pm:customEnd')`). Add the three new
`useState` fields (`viewRangePreset` default `'3'`, `customRangeStart`, `customRangeEnd`) to
`ProjectActivitiesTab.tsx` and pass them into the ported `GanttChart` (it already accepts these
props — see its signature).

### 2.3 Port the variance helpers
Copy these pure functions from OLD `pm/ProjectDetail.tsx` (lines ~78-98) into
`ProjectActivitiesTab.tsx` (or a shared utils file if one exists in this codebase):
`dateToDay`, `startVarianceLabel`, `endVarianceLabel`, and the `varianceToneClass` map.
These are needed by 2.4 and 2.5 below.

### 2.4 Restore variance badges on the mobile/list activity rows
The current list rows in `ProjectActivitiesTab.tsx` only show planned start/end + a progress
bar. Port from OLD file lines ~815-865: for each activity row, also render:
- A status badge computed from today's date vs the activity's day range:
  `behindSchedule` / `pastActivity` / `futureActivity` / `inProgress` (see OLD file's
  `isPast`/`isFuture`/`isBehind` logic and `timelineBadge` object).
- An "Actual Dates" line (`t('pm:actualDates')`) showing `actualStartDate → actualEndDate`,
  or `t('pm:notYetStarted')` / `t('pm:notYetCompleted')` when missing.
- Start/End variance pill badges next to the actual dates, using `startVarianceLabel` /
  `endVarianceLabel` + `varianceToneClass` from 2.3.

### 2.5 Restore variance badges + auto-calculated caption inside `ActivityForm`
OLD file lines ~1735-1765. In the NEW `ActivityForm` (inside `ProjectActivitiesTab.tsx`):
- Next to the Actual Start/Actual End date inputs, show the same variance pill badges
  (`startVarianceLabel`/`endVarianceLabel`) when both a planned and actual date exist.
- Under the "Planned Progress" readout, add the small caption `t('pm:autoCalculated')`.

### 2.6 Restore the photo gallery inside `ActivityForm` (view + date filter)
OLD file lines ~1671-1810. On top of fixing the save bug (Task 0.1), also restore:
- Two `photoFrom`/`photoTo` date inputs (`t('pm:photoFrom')`, `t('pm:photoTo')`) that filter the
  list of existing photos by upload date.
- An empty-state message `t('pm:noPhotos')` when the filtered list is empty.
- Render existing photos (from the activity being edited) alongside newly uploaded ones, sorted
  newest first, each with its upload-date stamp overlay (see OLD JSX for exact markup).

---

## 3. Units tab — restore Floor Plan / 3D Model / Brochure inputs
**File:** `pm_new/pm/ProjectUnitsTab.tsx` (`UnitForm`, ~line 150-200)
**Problem:** The unit-model data (`floorPlan`, `model3d`, `brochure`) is still part of the saved
object, but the NEW `UnitForm` has **no input fields** for them — it hardcodes empty strings when
saving (see the `onSave({ ..., floorPlan: '', model3d: '', brochure: '', ... })` call). This means
the "View Floor Plan" / "Download Brochure" buttons elsewhere in the same file will always point at
nothing.
**Fix:** Port the three inputs from OLD `pm/ProjectDetail.tsx` lines ~1876-1887:
- `t('pm:floorPlan')` text input, placeholder `t('pm:assetPlaceholder')`.
- `t('pm:model3d')` text input, placeholder `t('pm:assetPlaceholder')`.
- `t('pm:brochure')` text input, placeholder `t('pm:assetPlaceholder')`.
Wire their local `useState` values into the real `onSave(...)` call (replace the hardcoded
empty strings).

---

## 4. Risk attachments — file-type-aware rendering + empty state
**File:** `pm_new/pm/ProjectRisksTab.tsx` (`RiskForm`, ~line 195-210)
**Problem:** every uploaded attachment is rendered as `<img src={url} />` regardless of type,
which will break for PDFs/videos. The OLD file (lines ~2108-2114) rendered a file-type icon
(`FileTextIcon` for PDFs/other, `Video` icon for videos) for non-image attachments, plus a
`t('pm:noAttachments')` empty state and a filename caption.
**Fix:** Bring back the type-aware rendering and the empty state, adapted to the new
`dataSource.storage.upload` result (if the upload result doesn't include a MIME/file-type,
derive it from the file extension or from `file.type` at upload time and store it alongside the
URL — check what shape `useCreateRisk`/`useUpdateRisk` (or equivalent) already expects for
attachments in this codebase).

---

## 5. PM Dashboard — restore "Progress by Project" bar chart
**File:** `pm_new/pm/PmDashboard.tsx`
**Problem:** `BarChart`/`Bar`/`Cell` are still imported from `recharts` but the chart itself was
deleted — only the "Portfolio Timeline" section remains. This is dead-import + a missing chart.
**Reference in OLD file:** `pm/PmDashboard.tsx` lines ~159-178.
**Fix:** Re-add the card titled `t('pm:progressByProject')`: a horizontal `BarChart`
(`layout="vertical"`) with one bar per project, `dataKey="progress"`, colored per-project by
`statusColors[project.status]`, tooltip formatter showing `t('pm:percentComplete')`. Build the
`barData` array from whatever the NEW dashboard's already-fetched project list/query returns
(don't reintroduce `useStore` — use the existing React Query data + `calcProjectProgress`, both
already imported in this file). Place the card where it was in the OLD layout: directly above
"Portfolio Timeline".

---

## Translation keys to double-check
Neither zip contains the i18n JSON files, so this can't be verified directly — but confirm these
keys still exist in the project's translation files (they were used by the OLD file and referenced
above; if any are missing, add them with the OLD file's Arabic/English copy as the source):

```
pm:actualDates, pm:actualEndMarker, pm:actualStartMarker, pm:assetPlaceholder,
pm:autoCalculated, pm:behindSchedule, pm:brochure, pm:changeOrderBudget,
pm:completedOnTime, pm:costCurve, pm:customEnd, pm:customStart, pm:floorPlan,
pm:futureActivity, pm:jumpToToday, pm:model3d, pm:noAttachments, pm:noPhotos,
pm:notYetCompleted, pm:notYetStarted, pm:pastActivity, pm:percentComplete,
pm:photoFrom, pm:photoTo, pm:plannedDates, pm:progressByProject, pm:rangeCustom,
pm:rangeFull, pm:scrollLeft, pm:scrollRight, pm:startedOnTime, pm:todayMarker,
pm:totalBudgetWithChanges, pm:variancePercent
```

---

## Explicitly NOT in scope (already fine in the NEW version — do not touch)
- `AddProject.tsx`, `DocumentsContent.tsx`, `ExecutivePage.tsx`, `IpcContent.tsx`,
  `FinanceComingSoon.tsx` — verified feature-equivalent to OLD, just refactored.
- `ProjectQuantityTab.tsx`'s variance column — intentionally redesigned from a `%` variance
  column to an absolute SAR `+/-` variance column. This is a legitimate design change, not a
  regression — leave it as is.
- The React Query data layer, `ProjectEditModal.tsx`, `useBilingualField`, and the
  `dataSource.storage.upload` upload pattern — these are the "optimizations"; keep them exactly
  as they are and build everything above on top of them.

## Verification checklist (run after all tasks)
- [ ] Upload a photo on an activity, save, reopen the edit form — photo is still there.
- [ ] Upload an attachment on a risk, save, reopen — attachment is still there.
- [ ] Overview tab shows both Progress Curve and Cost Curve charts, plus Change Order Budget /
      Total Budget rows in Key Facts.
- [ ] Schedule tab (desktop) shows the draggable Gantt chart with view-range selector and today
      marker; activity rows (mobile + list) show variance/status badges.
- [ ] Unit model form has Floor Plan / 3D Model / Brochure fields and they persist.
- [ ] PM Dashboard shows the "Progress by Project" bar chart above the Portfolio Timeline.
- [ ] `tsc`/lint passes with no unused-import warnings (e.g. the previously-dead `BarChart`
      import in `PmDashboard.tsx` is now used again).
