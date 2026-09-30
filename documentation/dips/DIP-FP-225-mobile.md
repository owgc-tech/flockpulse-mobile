### DIP — FP-225 (Mobile) — Show Event Type on cards and detail; fix multi-day date range display

### Story Summary
Two additions to the mobile Events UI. (1) Display the event's type (e.g., "Formation," "Prayer Meeting") directly under the event name, above the date/time — on both the Events tab card and the event detail screen — using the same font size already used for the other attributes (date/time, location). (2) Fix the detail screen's date range display: it currently always shows the end as time-only, even when the event spans into a different calendar day, which is misleading — it should only show time-only for the end when start and end genuinely share the same date, and show the full date and time for the end otherwise, matching the start's format.

### Repo Target
Mobile (Expo) — two screens. No API/backend change — `event_type` is already present and non-optional on both `MyEvent` and `EventDetail`.

### Grounding Check
Confirmed live against `owgc-tech/flockpulse-mobile` `dev`:
- The Events tab card (`EventListItem.tsx`) only displays `start_datetime` via `formatDateTime()` — no end-time/range logic exists here at all, so this fix is detail-screen-only.
- The detail screen's `formatDateTimeRange()` (`app/(app)/events/[id].tsx`) always formats as `[start's date] · [start time] – [end time]`, unconditionally — confirmed it never checks whether `start_datetime` and `end_datetime` actually fall on the same calendar day, which is the real bug Joseph is describing.
- `styles.meta`/`themed.meta` is the confirmed, exact shared style token already used consistently for date/time and `location_name` on *both* screens — the correct token to reuse for the new Event Type line, not a new style.
- `event.event_type` can be briefly `undefined` on the detail screen specifically, per an existing code comment, during the short window before a fresh-fetch resolves — the new Event Type line needs to handle this gracefully (render nothing, not a blank/broken line) rather than assume it's always present.

### Implementation Plan
1. **`EventListItem.tsx`** (card): add a new `<Text style={[styles.meta, themed.meta]}>{event.event_type?.name}</Text>` line immediately after the event name and before the existing date/time line — rendering nothing if `event_type` is briefly unavailable.
2. **`[id].tsx`** (detail): add the same Event Type line in the same position (under name, above date/time), same style token.
3. **`[id].tsx`**: fix `formatDateTimeRange()` — compare `start`'s and `end`'s calendar date (year/month/day, not just the raw ISO timestamp, to correctly handle timezone-local "same day" comparison). If they match: keep the current, existing format (`[date] · [start time] – [end time]`). If they differ: format the end using the *same* full weekday/month/day/time format as the start (not just its time), clearly showing both complete dates.

### Files to Create/Modify
- `src/features/events/components/EventListItem.tsx` (modify)
- `app/(app)/events/[id].tsx` (modify)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-225-mobile-event-type-and-date-range

### Commit Message
FP-225-mobile: show Event Type on cards/detail, fix multi-day date range display

### Pull Request Description
Maps to FP-225's acceptance criteria: Event Type now shows under the event name on both the Events tab card and detail screen, matching the existing attribute font size. The detail screen's date range now correctly shows the full end date when an event spans multiple days, while keeping the existing simpler same-day format unchanged. Confirm in the PR this was tested with both a same-day event and a genuinely multi-day event (e.g., an overnight event), on a real device.

### Jira Linkage
- PDEEpicID: FP-8
- PDEStoryID: FP-225

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-225-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it on a real native build, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
