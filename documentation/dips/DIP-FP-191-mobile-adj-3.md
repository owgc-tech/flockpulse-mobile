# DIP-FP-191-mobile-adj-3

## Story Summary

Four real-device-testing fixes for Announcements. First: mobile's event creation screen currently shows every field regardless of event type — for Announcement type, it should mirror web's own simplified form exactly (Name and Start Date only, End Date computed, a new Announcement Body field, target fixed to Everyone). Second: replaces the amber "Unacknowledged" pill with "Please Acknowledge now." text, matching exactly how a not-yet-RSVP'd regular event already shows "Please RSVP now." text rather than a pill — the green "Acknowledged" pill stays as-is once acknowledged, matching how a responded regular event keeps its colored status pill. Third: the megaphone marker grows 3x and becomes a genuine two-tone custom icon (red handle/butt, white horn) rather than lucide's single-color stock icon. Fourth: fixes a real regression against an already-agreed requirement — Announcements are currently being incorrectly counted into the My Events tab's "pending RSVP" badge, when the original FP-191 story explicitly said they never should be.

## Repo Target

Mobile (Expo/React Native), owgc-tech/flockpulse-mobile. Fresh branch off current dev — PR #78 is already merged, this is not a continuation of that branch.

## Grounding Check

- Confirmed by direct read: create.tsx has zero event-type-conditional logic anywhere — every field (location, online meeting, target, talk, tasks) is unconditionally shown and, per the current handleSubmit validation, required — exactly matching what was reported.
- Important, precise finding: web's own POST /api/events route has a pre-RPC MISSING_FIELD check requiring endDatetime/locationName/locationAddress/target to all be present in the request body, even though insert_event_with_audit already force-overrides all of them for Announcement-type events server-side. This means mobile cannot simply omit these fields for Announcements — it must still send placeholder values (mirroring whatever web's own EventForm.tsx must already send to pass this same check), purely to satisfy the route's pre-RPC validation. Noting this as a minor architectural wart worth a future cleanup (relaxing the route's own validation for this type) but explicitly not fixing it in this DIP — matching web's existing convention is the right scope here, not re-opening the route.
- The badge bug's root cause confirmed precisely: isRsvpWindowOpen() checks only effective_status and rsvp_closure_at, with zero awareness of event_type — so any Announcement currently in SCHEDULED status with an unexpired rsvp_closure_at incorrectly satisfies pendingMyEventsCount's filter, since Announcements always have rsvp_status: null (they never get RSVP'd to at all). This is confirmed as a regression against an already-agreed acceptance criterion from the original FP-191 story ("does NOT count toward that tab's badge number"), not a new design question — the fix restores already-agreed behavior, nothing to ask Joseph about.
- The "Please Acknowledge now." text placement is confirmed to exactly mirror the existing ternary structure in EventListItem.tsx: isAnnouncement's branch changes from "always show a pill" to "acknowledged → keep the pill; not acknowledged → text," matching the exact shape of the non-Announcement branch (rsvp_status set → pill; rsvp_status unset but window open → text).
- The two-tone icon requires a genuinely custom SVG — lucide-react-native's icons are single-color paths via one color prop, with no built-in multi-part coloring. Built with react-native-svg (already a dependency). Flagging honestly that fine visual tuning may take a follow-up round once actually seen on a device, since this can't be visually previewed before implementation.

## Implementation Plan

1. create.tsx: derive isAnnouncement from the selected eventTypeId matching the fetched event type's system_key === 'ANNOUNCEMENT' (same check already used in EventListItem.tsx). When true:
   - Hide: location fields, online meeting fields, target/audience picker, talk picker, task assignment section, the End Date picker.
   - Show: Name, Start Date/Time picker, a new required Announcement Body multi-line text input, and a fixed, non-interactive "Everyone" label in place of the target picker (purely informational — the real audience is always server-forced regardless of what's shown).
   - handleSubmit's validation becomes conditional: for Announcement type, only require name.trim() and startDatetime — skip the location/target requiredness checks entirely.
   - Submission payload for Announcement type: endDatetime computed as start + 1 day (matching the server's own forced value, sent only to satisfy the route's pre-RPC check), locationName: 'Announcement', locationAddress: 'N/A' (matching web's own established placeholder strings for consistency/predictability), target: { group_ids: [], member_ids: [] } (empty but truthy, passes the route's shallow presence check, gets fully overridden by the RPC regardless), and the new announcementBody field.
2. CreateEventInput (types.ts): endDatetime, locationName, locationAddress, target become optional (still sent for Announcements per the above, but the type reflects that Announcement submissions are structurally different); new announcementBody?: string field.
3. EventListItem.tsx: isAnnouncement's rendering branch changes from unconditionally showing the Acknowledged/Unacknowledged pill to: event.acknowledged_at ? (existing green pill, unchanged) : <Text style={[styles.rsvpText, themed.rsvpPromptText]}>Please Acknowledge now.</Text> — reusing the exact same text style already used for "Please RSVP now." Also replace the Megaphone marker with a new custom two-tone SVG component (see below), 3x the current size (48 instead of 16).
4. New src/features/events/components/AnnouncementMarkerIcon.tsx: a small custom react-native-svg component rendering a stylized bullhorn shape — the horn/cone portion filled white with a thin outline, the handle/rear portion filled red. Exported with a size prop defaulting to 48.
5. app/(app)/(tabs)/index.tsx: pendingMyEventsCount's filter gains && e.event_type?.system_key !== 'ANNOUNCEMENT', restoring the original FP-191 story's explicit requirement.

## Files to Create/Modify

- app/(app)/events/create.tsx (modify — Announcement-conditional fields, validation, submission payload)
- src/features/events/types.ts (modify — CreateEventInput's optional fields, announcementBody)
- src/features/events/components/EventListItem.tsx (modify — pill/text branch, new icon component usage)
- src/features/events/components/AnnouncementMarkerIcon.tsx (new)
- app/(app)/(tabs)/index.tsx (modify — badge count filter)

## Migration Files

None — mobile repo has no migrations, and no web changes are needed for any of these four items.

## Branch Name

feature/FP-191-mobile-adj-3-announcement-fixes

## Commit Message

FP-191-mobile-adj-3: Announcement-aware create form, Please Acknowledge now text, larger two-tone icon, fix badge over-count

## Pull Request Description

- Screenshot: create-event form with Announcement selected, showing only Name/Start Date/Announcement Body/fixed "Everyone" label.
- Screenshot: My Events card for a not-yet-acknowledged Announcement showing "Please Acknowledge now." text, and a separate one showing the unchanged green "Acknowledged" pill.
- Screenshot: the new 3x two-tone icon — flag clearly that this may need a follow-up visual adjustment once actually seen, since it couldn't be previewed during implementation.
- Confirm the Events tab badge now correctly excludes both Announcements regardless of acknowledged state, showing only the count of regular events genuinely awaiting RSVP.

## Jira Linkage

- PDEEpicID: FP-188
- PDEStoryID: FP-191

## Stop Point

Save this DIP verbatim to documentation/dips/DIP-FP-191-mobile-adj-3.md. Branch off current dev (PR #78 already merged — this is a fresh branch, not additional commits on that old branch). Open a new PR against dev and stop. Do not merge.

Include full diffs for every file in the completion report, no elisions.
