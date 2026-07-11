# DIP-FP-96-mobile

### Story Summary

Builds the actual local pre-event reminder notifications: two per event (24 hours and 1 hour before start), scheduled entirely on-device, using the `reminder-context` endpoint merged in the companion web DIP for Formation content. Declined RSVPs are excluded from reminders; not-responded and accepted members both still get reminded, per direct clarification.

### Repo Target

Mobile (Expo + React Native + TypeScript) — `owgc-tech/flockpulse-mobile`.

### Grounding Check

* Confirmed live, current, and important: local (non-push) notifications remain fully available in Expo Go on SDK 54 — only remote/push notifications have been progressively restricted (Android since SDK 52/53). This DIP is local-only by design, so it needs no development-build migration; Expo Go continues to work for testing, same as everything else built this project.
* Real platform requirement, not optional: Android 8+ silently drops any notification scheduled without an explicit notification channel — no error, no log. `Notifications.setNotificationChannelAsync()` must run before any scheduling call. Android 12+ additionally requires the `SCHEDULE_EXACT_ALARM` permission for exact-datetime scheduling (not the default interval-based triggers) — added to `app.json`.
* Real platform limitation, confirmed and designed around, not ignored: on iOS, a live JS notification-tap listener does not run if the app was fully terminated (not just backgrounded) when the notification fires and is tapped — the app cold-launches instead. This requires checking `Notifications.getLastNotificationResponseAsync()` once on startup, in addition to the live `addNotificationResponseReceivedListener`, to catch both cases. Missing this would mean tapping a reminder from a killed app silently does nothing.
* A real, deliberate correction to EPIC-8's stated design promise, not a silent reinterpretation: the epic description says each notification does "a fresh-content-fetch performed at the moment each notification fires." That's not achievable for a purely local, non-push notification — there's no OS mechanism to run JS and rewrite already-scheduled content at the literal instant of delivery without either a server-triggered push (which the local-only design deliberately avoids) or a background-task architecture well beyond this story's scope. What this DIP actually implements: content is fetched fresh and notifications are (re)scheduled every time the app is opened or the events list refreshes (initial mount + pull-to-refresh) — "fresh as of the last time the user opened the app," not literally fresh at the OS-delivery instant. Flagging this explicitly rather than letting the epic's wording imply a capability that isn't real.
* Re-scheduling with the same identifier replaces, not duplicates — confirmed standard `expo-notifications` behavior, and the mechanism this DIP's reconciliation logic depends on for idempotency across repeated app opens.
* "One-tap navigation," per direct interpretation, flagged rather than assumed: tapping the notification itself opens the event detail screen (already built, already correctly receives a serialized event object via route params from the list screen — this DIP reuses that exact same pattern, no changes needed to the detail screen). The already-shipped tappable location link on that screen provides the actual map-opening tap. This is not a native notification action button bypassing the app entirely — that would be a meaningfully bigger addition (notification categories/actions) for arguable benefit at this stage. Flagging for pushback if a stricter reading was intended.
* No new backend work beyond what's already merged: `/api/events/mine` (already used for the base list) and `/api/events/:id/reminder-context` (from the companion web DIP, called once per qualifying event during reconciliation).
* Scale assumption, stated rather than silently applied: reconciliation calls `reminder-context` once per qualifying event on every app open/refresh. Fine at this app's realistic scale (a single community's event calendar); would need batching if that ever changed materially.

### Implementation Plan

1. Dependency: `npx expo install expo-notifications`.
2. `app.json`: add the `expo-notifications` config plugin; add `android.permissions: ["SCHEDULE_EXACT_ALARM"]`.
3. New `src/features/notifications/types.ts`: `ReminderOffset = '24h' | '1h'`; `NotificationDataPayload { eventId: string; event: string }` (the serialized `MyEvent`, same shape the list screen already passes to the detail screen).
4. New `src/features/notifications/services/notifications.service.ts`:
   * `ensureNotificationSetup()`: requests permissions (`getPermissionsAsync` → `requestPermissionsAsync` if not already granted/denied), creates the Android channel, sets `Notifications.setNotificationHandler()` for foreground display. Called once, on mount of the events list screen.
   * `scheduleReminder(event: MyEvent, offset: ReminderOffset, fireDate: Date, title: string, body: string)`: calls `scheduleNotificationAsync` with a deterministic `identifier: \`reminder-${event.id}-${offset}\`` and a `date`-type trigger at `fireDate`, `data: { eventId: event.id, event: JSON.stringify(event) }`.
   * `cancelReminder(eventId: string, offset: ReminderOffset)`: `cancelScheduledNotificationAsync` with the matching identifier.
   * `getAllScheduledReminderIdentifiers()`: wraps `getAllScheduledNotificationsAsync()`, filters to this app's `reminder-` prefix.
5. New `src/features/notifications/services/reminderContent.service.ts`:
   * `fetchReminderContext(eventId: string)`: calls `GET /api/events/:id/reminder-context` via the existing `apiFetch` helper.
   * `buildReminderContent(context)`: returns `{ title, body }` — title is the event name; body includes formatted date/time, `location_name`, and (if `formation` is present) `"{course_name} › {module_name} › {talk_name}"` plus `talk_description` (defensively truncated to a reasonable length for a notification body — flagged as a practical judgment call, not a spec'd limit).
6. New `src/features/notifications/services/reminders.service.ts` — `reconcileEventReminders(events: MyEvent[])`:
   * Compute the "should be scheduled" set: for each event where `effective_status === 'SCHEDULED'` and `rsvp_status !== 'NO'`, compute both offset fire times (`start_datetime - 24h`, `start_datetime - 1h`); keep only those still in the future.
   * Fetch currently-scheduled reminder identifiers; cancel any not in the "should be scheduled" set (covers declined, cancelled, completed/locked, or events that dropped off the list entirely).
   * For each "should be scheduled" reminder: fetch its `reminder-context`, build content, call `scheduleReminder` (identifier-based replace keeps this idempotent on repeated calls).
7. Wire into `app/(app)/index.tsx`: call `ensureNotificationSetup()` once on mount; call `reconcileEventReminders(data)` right after a successful `listMyEvents()` in `loadEvents()` (both the initial load and pull-to-refresh paths already funnel through this one function).
8. Wire tap handling into `app/_layout.tsx` (root layout, not `(app)`'s — so it's active regardless of auth state): on mount, check `getLastNotificationResponseAsync()` for the cold-launch-via-tap case, and register `addNotificationResponseReceivedListener` for the already-running case. Both extract `data.eventId`/`data.event` and `router.push` to `/(app)/events/[id]` with the same params shape the list screen already uses — the `(app)` layout's own auth/MFA/biometric gate still runs first if needed, exactly as it does for any other navigation into that group.

### Files to Create/Modify

```
app.json                                                        (modified)
app/_layout.tsx                                                 (modified)
app/(app)/index.tsx                                              (modified)
src/features/notifications/types.ts                              (new)
src/features/notifications/services/notifications.service.ts     (new)
src/features/notifications/services/reminderContent.service.ts   (new)
src/features/notifications/services/reminders.service.ts         (new)

```

### Migration Files (if applicable)

None.

### Branch Name

`feature/FP-96-mobile-pre-event-reminders`

### Commit Message

`FP-96-mobile: schedule local pre-event reminders (24h/1h), excluding declined RSVPs`

### Pull Request Description

* Two local notifications per qualifying event (24h and 1h before start), reconciled (scheduled/cancelled) every time the events list loads or refreshes.
* Declined events (`rsvp_status === 'NO'`) are excluded; not-responded and accepted are both reminded.
* Formation events include resolved Course/Module/Talk names and the Talk's description via the new `reminder-context` endpoint.
* Tapping a reminder opens the event detail screen, handling both the live-listener and killed-app-cold-launch cases.
* Content freshness is "as of last app open/refresh," not literally at OS-delivery instant — flagged in the Grounding Check as a real platform constraint, not an oversight.

### Jira Linkage

* PDEEpicID: FP-31 (EPIC-8 — Notification System)
* PDEStoryID: FP-96

### Stop Point

Save this DIP verbatim to `documentation/dips/DIP-FP-96-mobile.md` and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against `dev` and stop. Do not merge — test via `expo start` + Expo Go against the branch, then merge manually once confirmed.

Include full diffs for every file in the completion report per Section 5, rule 12 — not a summary.
