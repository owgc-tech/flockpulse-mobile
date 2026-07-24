Mobile (Expo/React Native), owgc-tech/flockpulse-mobile.

Grounding Check

	•	Same tab-bar, icon, and landing-route grounding as the original draft (AnimatedTabBar.tsx's ROUTE_ICONS/isRouteHidden mechanics, ChartColumn verified as the real installed export name, initialRouteName decoupled from visual tab order) — unchanged by this revision.
	•	No role/visibility logic lives on the mobile side at all — the screen calls default, event-types, events, and stats and trusts whatever they return; a Member account and an Admin account naturally see different dropdown contents and different defaults purely because the API responses differ, with zero conditional logic in this repo.
	•	Date-prefix format, pale-color banding via the existing danger/warning/success + alpha-suffix trick, and the raw-average-vs-rounded-band distinction are all unchanged from the original draft.

Implementation Plan

	1.	src/features/dashboard/services/dashboard.service.ts: thin apiFetch wrappers — getDefaultDashboard(), listEventTypes(), listEventsForType(eventTypeId), getDashboardStats(eventId).
	2.	app/(app)/(tabs)/dashboard/index.tsx:
	•	On mount: fetch getDefaultDashboard() and listEventTypes() in parallel. If getDefaultDashboard() returns non-null, pre-select the Event Type dropdown to its event_type, fetch listEventsForType() for that type (to populate the Event dropdown), pre-select the Event dropdown to its event, and render the cards from the stats it already returned (no extra stats round-trip needed for the initial paint). If it returns null (viewer has no visible events at all yet), show an empty state: "No events to show yet."
	•	Changing the Event Type dropdown: fetch listEventsForType() for the new type, auto-select the first (most recent) entry, fetch getDashboardStats() for it, update all three cards.
	•	Changing the Event dropdown (same type): fetch getDashboardStats() for the newly picked event, update all three cards.
	•	Three cards: same Attendance / RSVP / Rating & Feedback layout, color-banding rules, and feedback-list rendering as the original draft — entirely unchanged, since the stats payload shape is the same regardless of event type.
	3.	_layout.tsx / AnimatedTabBar.tsx: unchanged from the original draft — new tab, no label, always-accent icon, initialRouteName.

Files to Create/Modify

	•	src/features/dashboard/services/dashboard.service.ts (new)
	•	src/features/dashboard/types.ts (new)
	•	app/(app)/(tabs)/dashboard/index.tsx (new)
	•	app/(app)/(tabs)/_layout.tsx (modify)
	•	src/features/navigation/AnimatedTabBar.tsx (modify)

Migration Files

None.

Branch Name

feature/FP-182-mobile-dashboard-tab

Commit Message

FP-182-mobile: add Dashboard tab — event-type/event dropdowns, role-scoped visibility via API, colored icon, landing route

Pull Request Description

	•	"Two dropdowns, event type then event" → confirm both render and cascade correctly.
	•	"Default = latest visible event, both dropdowns pre-populated to match" → confirm no mismatch between what's shown in the dropdowns and what the cards display on first load.
	•	Confirm no role-conditional code exists anywhere in this screen — visibility is entirely a function of what the API returns.
	•	Same icon/label/landing-route confirmations as the original draft.
	•	Depends on DIP-FP-182-web being merged and deployed first.

Jira Linkage

	•	PDEEpicID: FP-36
	•	PDEStoryID: FP-182

Stop Point

Save this DIP verbatim to documentation/dips/DIP-FP-182-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it, and merge manually.

Include full diffs for every file in the completion report, no elisions.
