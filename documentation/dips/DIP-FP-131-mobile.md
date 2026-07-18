DIP-FP-131-mobile.md
Story Summary
Mobile companion to DIP-FP-131-web.md. A prior session already found that event_type_id couldn't be changed on edit and left a comment in edit.tsx calling it "immutable" — that conclusion was based on an incomplete backend, now fixed by the web DIP. This DIP removes that stale comment and adds an Event Type picker to the mobile Edit screen, mirroring the picker that already exists (and works correctly) on the Create screen.
Repo Target
Mobile (Expo/React Native) — owgc-tech/flockpulse-mobile. Depends on DIP-FP-131-web.md being merged and its migration applied remotely first — submitting a changed eventTypeId against the old RPC would silently no-op exactly as it does today.
Grounding Check
Confirmed live against dev:

create.tsx already has a complete, working Event Type picker: fetches via listEventTypes() (from src/features/event-types/services/eventTypes.service.ts), renders a button-grid (optionsRow/optionButton/optionButtonSelected styles), state via eventTypeId.
edit.tsx has an explicit comment (lines ~539-541) stating no Event Type field exists because the field was "confirmed... immutable once the event is created" — this was accurate as observed at the time, but the underlying cause (an incomplete RPC, not a real business rule) is fixed by the companion web DIP.
edit.tsx's handleSubmit already follows a "send every field explicitly, never omit" convention (its own comment: PATCH treats an omitted key as "no change" via JSONB key-presence, not truthiness) — eventTypeId must be added to UpdateEventInput (mobile types.ts) as a required (always-sent) field, matching every other field on that interface, not an optional one.
No other mobile file references event_type_id for the edit path.

Implementation Plan

types.ts: add eventTypeId: string to UpdateEventInput (required, matching the interface's existing always-sent convention).
edit.tsx:

Add eventTypes state, fetched via the same listEventTypes() service create.tsx already uses.
Add eventTypeId state, initialized from the fetched event's current event_type_id (the event detail fetch this screen already does).
Remove the stale "immutable" comment block.
Render the same Event Type picker UI as create.tsx (identical optionsRow/optionButton pattern — copy, don't reinvent), placed in the same position (after Name, before Start) for consistency between the two screens.
Add eventTypeId to the updateEvent() payload in handleSubmit.



Files to Create/Modify

src/features/events/types.ts
app/(app)/events/[id]/edit.tsx

Migration Files
Not applicable — mobile-only.
Branch Name
feature/FP-131-mobile-event-type-edit
Commit Message
FP-131: allow changing an event's type from the mobile Edit screen
Pull Request Description
Maps to acceptance criteria:

"Edit Event flow allows changing an event's type" (mobile half) → new picker mirroring Create's, now actually persists since the backend fix landed first.

Jira Linkage

PDEEpicID: FP-11 (EPIC-3 — Event Lifecycle Management)
PDEStoryID: FP-131

Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-131-mobile.md, frozen after save. Open PR against dev, do not merge. Do not implement this until DIP-FP-131-web.md is merged and its migration confirmed applied remotely — flag this dependency prominently if picked up out of order.
Include full diffs for every file in the completion report.
