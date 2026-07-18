DIP-FP-110.md
Story Summary
FP-110 lets a member customize the timing of their two pre-event reminders (currently fixed at 24h and 1h before an event) from a new mobile Preferences screen. The count stays fixed at exactly two reminders — only each slot's hours-before value becomes adjustable. Per the resolved open question (recorded on FP-110 directly before this DIP was drafted), storage is local-only via AsyncStorage — no server sync, resets on reinstall, consistent with EPIC-8's existing local-first notification design. No screen currently exists for this; it's reached from the existing avatar popover (the same entry point FP-118 already built for Edit Profile / Sign Out), positioned opposite Sign Out in a single row, since that's the natural symmetric placement for the popover's two secondary actions.
Repo Target
Mobile (Expo/React Native) — owgc-tech/flockpulse-mobile. No backend involvement — entirely local device state.
Grounding Check
Confirmed live against dev:

No Settings/Preferences screen exists anywhere in the app — confirmed via full directory scan. app/(app)/profile/edit.tsx exists but is scoped to identity fields (name/avatar), not preferences.
AsyncStorage is an established, already-used pattern in this codebase (confirmationReminders.service.ts uses it for a throttle timestamp; src/lib/supabase.ts for session storage) — followed here rather than expo-secure-store, which this codebase reserves for genuinely sensitive values (biometric trust flags).
Current fixed-offset architecture: ReminderOffset = "24h" | "1h" is a literal-string union used both as an OFFSET_MS lookup key and baked directly into the scheduled notification's deterministic identifier (reminder-{eventId}-{offset}). This DIP replaces the offset label with the actual numeric hours value in the identifier (reminder-{eventId}-{hours}h) — for unmodified defaults (24, 1) this produces byte-identical identifiers to today's, so no cleanup of already-scheduled notifications is needed. When a member changes a slot's hours, the identifier changes too, which the existing reconciliation loop's set-difference logic already handles correctly with zero changes to that algorithm.
ReminderOffset type usage contained to exactly 3 files (types.ts, notifications.service.ts, reminders.service.ts) — confirmed via repo-wide grep.
cancelReminder(eventId, offset) (distinct from cancelReminderByIdentifier) is dead code — defined, never called. Updated for consistency while touching this file's neighborhood, not left orphaned.
Reconciliation does not run on focus, only on initial mount ((tabs)/index.tsx's own comment: "Fetches once on mount only — no refetch-on-focus... Pull-to-refresh is the only other way to refresh"). Simply navigating back from Preferences will not apply a changed offset until the member manually pulls to refresh or reopens the app. To avoid a silent-until-refresh gap, the Preferences screen's save handler explicitly re-fetches events (listMyEvents()) and calls reconcileEventReminders() itself, mirroring the exact call already made in (tabs)/index.tsx's loadEvents.
Notification body/title has no hardcoded offset language (reminderContent.service.ts builds purely from event date/location/formation data) — no content-string changes needed regardless of chosen hours.
Domain rules: no conflict — notification-preference only, doesn't touch RSVP, self-report, attendance, or formation.

Implementation Plan

New storage service (src/features/notifications/services/reminderSettings.service.ts): getReminderOffsetHours() reads two AsyncStorage keys, falling back to { slot1Hours: 24, slot2Hours: 1 } if unset/unparseable; setReminderOffsetHours(slot1Hours, slot2Hours) writes both.
Types (types.ts): remove ReminderOffset literal-union type.
notifications.service.ts: reminderIdentifier(eventId, offset: ReminderOffset) → reminderIdentifier(eventId, hours: number), format unchanged. scheduleReminder/cancelReminder signatures updated the same way.
reminders.service.ts: reconcileEventReminders calls getReminderOffsetHours() at the top instead of using the fixed OFFSET_MS map. computePendingReminders takes the resolved {slot1Hours, slot2Hours} and computes both fire times per event the same way as today, with dynamic values instead of fixed 24/1.
New screen (app/(app)/preferences.tsx): titled "Preferences." Two numeric inputs ("Reminder 1" / "Reminder 2", hours before event), prefilled via getReminderOffsetHours(). Basic validation: positive integers, capped at 336 hours (2 weeks) — soft validation, not a hard business rule. Save handler: setReminderOffsetHours(), then listMyEvents() + reconcileEventReminders() to apply immediately. If both slots are set to the same value, only one notification fires (identifiers collide) — accepted, documented edge case, not additionally validated against in this DIP.
Avatar.tsx: replace the current single centered signOutLink with a two-item row below the Edit Profile button — Preferences (left, router.push("/(app)/preferences")) and Sign Out (right, existing handleSignOut), same setIsOpen(false)-then-navigate pattern as handleEditProfile. Reuse signOutLink's existing text styling for both, just laid out side by side instead of stacked.

Files to Create/Modify

src/features/notifications/services/reminderSettings.service.ts (new)
src/features/notifications/types.ts
src/features/notifications/services/notifications.service.ts
src/features/notifications/services/reminders.service.ts
app/(app)/preferences.tsx (new)
src/features/profile/components/Avatar.tsx

Migration Files
Not applicable.
Branch Name
feature/FP-110-reminder-preferences
Commit Message
FP-110: allow members to configure pre-event reminder timing via Preferences
Pull Request Description
Maps to acceptance criteria:

"Member can adjust each of two reminder offsets independently, count fixed at two" → Preferences screen with exactly two numeric inputs; reconciliation architecture unchanged, still always schedules exactly two per event.
"Local-only storage" → AsyncStorage, per the resolved open question recorded on FP-110.
"Default remains 24h/1h for any member who hasn't customized" → getReminderOffsetHours()'s fallback defaults, and identical resulting identifiers to pre-DIP behavior for unmodified defaults.

Jira Linkage

PDEEpicID: FP-31 (EPIC-8 — Notification System)
PDEStoryID: FP-110

Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-110.md, frozen after save. Open PR against dev and stop. Do not merge. No remote/manual migration step applies here.
Include full diffs for every file in the completion report — not a summary.
