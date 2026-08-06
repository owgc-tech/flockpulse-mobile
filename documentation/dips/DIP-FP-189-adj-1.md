Story Summary

FP-189 (RSVP guest count) shipped without a way to set an event's guests_allowed flag from mobile. Web's EventForm.tsx (shared by web create and edit) has the "Guests Allowed" checkbox; mobile's create and edit screens — separate components, not shared — never got it. This ADJ DIP adds the toggle to both mobile screens, mirroring web's placement, copy, and non-Announcement-only visibility.

Repo Target

Mobile (flockpulse-mobile) — UI-only gap. The backend (/api/events POST/PATCH accepting guestsAllowed in the JSON body, insert_event_with_audit/update_event_with_audit handling p_guests_allowed) already exists from FP-189's original web-side implementation and needs no changes.

Grounding Check

Confirmed live against owgc-tech/flockpulse-mobile and owgc-tech/flockpulse-web dev branches, current session:

Web's EventForm.tsx (line ~696): a plain checkbox bound to guestsAllowed state, rendered only when !isAnnouncement, with caption "(members can RSVP with a guest headcount)".
Web API routes app/api/events/route.ts and app/api/events/[id]/route.ts both destructure and forward guestsAllowed (camelCase) from the request body — mobile's apiFetch already serializes its input object directly as JSON, so no wire-format translation is needed.
Mobile's EventDetail/MyEvent type already has guests_allowed: boolean (read side, added under DIP-FP-189-mobile for RSVP gating) — but CreateEventInput and UpdateEventInput in src/features/events/types.ts have no guestsAllowed field at all. This is a write-side gap, not a naming mismatch.
UpdateEventInput's established convention (per its own doc comment and every existing field) is "always sent, never omitted" — a PATCH omission means "no change" via JSONB key-presence, not truthiness. guestsAllowed must follow this, sent as a plain boolean, not conditionally spread.
CreateEventInput fields are mixed optional/required; guestsAllowed should be optional (?: boolean), mirroring rsvpClosureDays?: number, and only included in the createEvent() call for the non-Announcement branch — Announcements structurally cannot take RSVPs at all, so the field is meaningless there (web force-overrides it server-side for Announcement-type events regardless).
No RSVP/attendance invariants (Section 4) are touched — this only affects who can set the flag, not the flag's downstream meaning, which was already validated under FP-189.
No migration required — guests_allowed and its constraints already exist in the database from FP-189's original migration.
No Switch component precedent exists elsewhere in the mobile codebase; this DIP introduces one plain Switch import from react-native, styled inline consistent with the screen's existing themed.label/styles.label pattern — not a new design system component.
Implementation Plan
src/features/events/types.ts
Add guestsAllowed?: boolean; to CreateEventInput, placed near rsvpClosureDays, with a comment noting it mirrors web's EventForm.tsx checkbox and is omitted (not sent) for Announcement-type events.
Add guestsAllowed: boolean; (non-optional) to UpdateEventInput, placed near rsvpClosureDays, with a comment noting it follows the "always sent, never omitted" convention documented on that interface.
app/(app)/events/create.tsx
Add const [guestsAllowed, setGuestsAllowed] = useState(false); alongside the other form-field state (near rsvpClosureDays).
Add a labeled Switch control, visible only when !isAnnouncement (same guard as the RSVP Closure Override field it sits next to), with caption text matching web: "Guests Allowed — members can RSVP with a guest headcount." Give it testID="create-event-guests-allowed" to match the existing testID convention on sibling fields.
In the non-Announcement branch of the createEvent() call, add guestsAllowed, to the input object (always included for non-Announcement events, since the field defaults sensibly to false). Do not add it to the Announcement branch's createEvent() call.
app/(app)/events/[id]/edit.tsx
Add const [guestsAllowed, setGuestsAllowed] = useState(initialEvent.guests_allowed ?? false); alongside the other prefilled state (near rsvpClosureDays).
Add the same Switch control as create.tsx, same guard, same copy, testID="edit-event-guests-allowed".
In the updateEvent() call, add guestsAllowed, to the input object — always sent, per UpdateEventInput's established convention (no conditional spread, unlike locationUrl/onlineMeetingUrl).
Run npx tsc --noEmit (this repo's tsconfig is strict: true; there is no npm run build script, so this is the equivalent gate per the standing DIP requirement) and confirm it passes cleanly before proceeding.
Files to Create/Modify
src/features/events/types.ts (modify — CreateEventInput, UpdateEventInput)
app/(app)/events/create.tsx (modify)
app/(app)/events/[id]/edit.tsx (modify)
Migration Files (if applicable)

None. guests_allowed and its constraints already exist from FP-189's original migration; this DIP is UI/type-layer only.

Branch Name

feature/FP-189-adj-1-mobile-guests-allowed-toggle

(FP-189's original PR is already merged, so this is a fresh branch off dev, not additional commits on the old branch — per the standing adjustment-branch rule.)

Commit Message

FP-189-adj-1: add Guests Allowed toggle to mobile create/edit event screens

Pull Request Description

Maps to FP-189's original acceptance criterion: "New 'Guests Allowed' toggle at event creation/edit time — event-level, not event-type-level... Defaults off." This was fully implemented on web but missing on mobile. This PR closes that gap by adding the same toggle, with the same default-off/non-Announcement-only behavior, to both mobile create and edit screens, with no backend or migration changes required.

Jira Linkage
PDEEpicID: FP-15
PDEStoryID: FP-189
Stop Point

Save this DIP verbatim to documentation/dips/DIP-FP-189-adj-1.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
