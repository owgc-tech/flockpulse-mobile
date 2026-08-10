### DIP 2 of 2 — Mobile

### Story Summary
For Announcement-type events, the Board tab shows a single Acknowledgement card instead of the existing Attendance/RSVP/Rating & Feedback set — headline is the acknowledged percentage, colored with the exact same green/yellow/red banding the Attendance and RSVP cards already use, with Acknowledged/Not Acknowledged counts underneath. Consumes the new `announcement` field from FP-197-web. **Depends on FP-197-web being merged and live — do not start until confirmed.**

### Repo Target
Mobile (Expo) — UI only; the data this consumes is already computed server-side by FP-197-web.

### Grounding Check
Confirmed live against `owgc-tech/flockpulse-mobile` `dev`:
- **The color convention to reuse, confirmed precisely**: `rateBandColor(colors, ratio)` (`dashboard/index.tsx:31`) — `ratio >= 0.75` → `colors.success`, `>= 0.5` → `colors.warning`, else `colors.danger`. This is exactly what `attendanceColor` and `rsvpColor` already use, and it takes the same 0-1 ratio shape the new `announcement.percent / 100` naturally produces — reused directly, not reinvented, satisfying "same color scheme" precisely rather than approximately.
- `DashboardStats` (`types.ts:77`) currently requires `attendance`/`rsvp`/`rating` — becomes optional on this type to match FP-197-web's response shape, with a new optional `announcement` field added.
- `StatsCards` (`dashboard/index.tsx:216`) currently renders all three existing cards unconditionally — becomes a branch: if `stats.announcement` is present, render exactly one new `AnnouncementCard`-shaped block instead of the existing three; otherwise, current behavior completely unchanged.
- Existing card visual structure (`styles.card`, `cardHeaderBar`, `cardBody`, `cardStat`, `cardMeta`) is reused as-is for the new card — same border/header-bar/body-tint pattern (`color + "44"` border, `color + "1a"` body tint) already established by the other three cards, not a new visual language.

### Implementation Plan
1. **`src/features/dashboard/types.ts`**: `DashboardAttendanceStats`/`DashboardRsvpStats`/`DashboardRatingStats` fields on `DashboardStats` become optional; add `DashboardAnnouncementStats { acknowledged_count: number; not_acknowledged_count: number; total_count: number; percent: number | null }` and an optional `announcement?: DashboardAnnouncementStats` field.
2. **`dashboard/index.tsx`**: in `StatsCards`, branch at the top: if `stats.announcement` is present, compute `announcementColor` via `rateBandColor(colors, (stats.announcement.percent ?? 0) / 100)` (falling back to `colors.textMuted` when `percent` is `null`, matching `attendanceColor`'s existing null-handling convention) and render a single card — header "Acknowledgement", headline stat `${stats.announcement.percent}%` (or `"—"` when `null`), with "Acknowledged" and "Not Acknowledged" counts underneath using the same `BarRow`-style presentation the existing cards use for their sub-counts. Otherwise, render the existing three cards, completely unchanged.

### Files to Create/Modify
- `src/features/dashboard/types.ts` (modify)
- `app/(app)/(tabs)/dashboard/index.tsx` (modify)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-197-mobile-announcement-board-card

### Commit Message
FP-197-mobile: single acknowledgement card for Announcement events on Board tab

### Pull Request Description
Maps to FP-197's mobile acceptance criteria: Announcement-type events now show one Acknowledgement card (percentage headline + Acknowledged/Not Acknowledged counts) instead of the existing three meaningless cards, colored via the same `rateBandColor` function the Attendance/RSVP cards already use — confirm in the PR that this was visually verified against a real Announcement event, not just typechecked. Non-Announcement events confirmed unaffected.

### Jira Linkage
- PDEEpicID: FP-31
- PDEStoryID: FP-197

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-197-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it against the deployed dev environment, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
