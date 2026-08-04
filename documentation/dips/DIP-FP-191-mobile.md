# DIP-FP-191-mobile

## Story Summary

Displays Announcement-type events distinctly in My Events (visual marker, no RSVP prompt), surfaces acknowledgement in the Check-In tab combined with the existing self-report badge, and schedules two user-overridable local reminders per Announcement that deep-link into the full write-up.

## Repo Target

Mobile (Expo/React Native), owgc-tech/flockpulse-mobile.

## Grounding Check

This DIP is written against DIP-FP-191-web's documented contract, not a separate guess — same endpoints, same field names, cross-checked line by line against that document rather than independently inferred. This is a deliberate process fix after FP-182's adj-1 round, where the two DIPs disagreed with each other about what /default returned.

PendingSelfReportRow (backing the Check-In tab, confirmed live) is the type being extended with a kind discriminator — not replaced, not a new parallel type.

MyEvent (confirmed live, backing /api/events/mine) currently has only event_type_id — this DIP depends on DIP-FP-191-web's addition of a nested event_type: {id, name, system_key} object to detect an Announcement without a second network call.

Existing local-notification scheduling infrastructure (selfReportReminders.service.ts, reminderSettings.service.ts) is reused directly for the two Announcement reminders — no new push/remote infrastructure, consistent with FP-31's epic-level design commitment to local-only scheduling.

Even though CC may build this in parallel with the web DIP, per Joseph and Atlas's discussion: this mobile work should be considered code-complete but not "done" until DIP-FP-191-web's actual PR is open and confirmed to match this document — if web's real implementation drifts from what's written here (the way /default did last time), this DIP needs a same-day correction before merge, not a silent mismatch discovered later.

## Implementation Plan

- Types: extend PendingSelfReportRow (or a renamed union type, PendingCheckInRow) with kind: 'self_report' | 'announcement', plus announcement_body: string | null for announcement-kind rows. Extend MyEvent with the new nested event_type: { id: string; name: string; system_key: string | null }.
- Service: acknowledgeAnnouncement(eventId) — thin wrapper around POST /api/announcements/:eventId/acknowledge.
- Check-In (Self-Report) tab: the existing pending-list fetch already returns both kinds in one array per the extended web endpoint — badge count is simply that array's length, no separate counting logic needed. List rendering branches on kind: self_report items render the existing Yes/No flow unchanged; announcement items render the full announcement_body text and a single "Acknowledged" button — no Yes/No choice, no reason field.
- My Events tab: event cards check event.event_type.system_key === 'ANNOUNCEMENT'. When true: render a distinct visual marker (icon/graphic, top-right corner of the card) and suppress the RSVP prompt/controls entirely for that card. Tapping the card opens the event detail screen showing the full announcement body; if not yet acknowledged, an "Acknowledged" button is available there too (same acknowledgeAnnouncement action as the Check-In tab) — this is the path for someone who missed both reminders and finds it by browsing their events instead.
- Acknowledging is never gated by time — the button is available the moment the announcement exists, not only after the 24-hour mark. The 24hr/1hr timers (below) control only when reminders fire, not when the action itself becomes available.
- Reminders: two new local notifications per Announcement, scheduled at 24 hours and 1 hour before end_datetime (i.e., before the acknowledgement deadline), reusing the existing scheduling pattern from selfReportReminders.service.ts. New reminder-timing preference in the existing Profile/Settings reminder-preferences area, following the same pattern as other user-overridable reminder settings already there. Notification banners show only the announcement's title (a real OS-level limit, not a product choice) — tapping deep-links into the event detail screen with the full write-up open, reusing existing event-detail deep-link navigation.

## Files to Create/Modify

- src/features/self-reports/types.ts (modify — kind discriminator, announcement_body)
- src/features/events/types.ts (modify — nested event_type object)
- src/features/announcements/services/announcements.service.ts (new — acknowledgeAnnouncement)
- app/(app)/(tabs)/self-report/index.tsx (modify — branch rendering per kind)
- src/features/events/components/EventListItem.tsx (modify — Announcement visual marker, RSVP suppression)
- src/features/notifications/services/announcementReminders.service.ts (new)
- src/features/notifications/services/reminderSettings.service.ts (modify — new preference)

## Migration Files

None — mobile repo has no migrations.

## Branch Name

feature/FP-191-mobile-announcements

## Commit Message

FP-191-mobile: display Announcements distinctly in My Events, combined acknowledgement in Check-In, 24hr/1hr reminders

## Pull Request Description

- Confirm every field/endpoint referenced here was checked against DIP-FP-191-web's actual merged PR, not just this document, before considering the work final — list any drift found and how it was resolved.
- Confirm the Check-In badge count genuinely combines both kinds into one number, not two badges.
- Confirm acknowledging works identically whether reached via a reminder tap, the Check-In list, or browsing to the event directly in My Events — same action, three entry points.
- Screenshot the My Events card's visual marker and confirm no RSVP controls appear on an Announcement card.

## Jira Linkage

- PDEEpicID: FP-188
- PDEStoryID: FP-191

## Stop Point

Save this DIP verbatim to documentation/dips/DIP-FP-191-mobile.md. Branch off current dev. Open a PR against dev and stop. Do not merge.

Include full diffs for every file in the completion report, no elisions — and explicitly confirm in the completion report that the actual implementation was checked against web's real (not just documented) API responses before considering it done.
