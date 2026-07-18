DIP-FP-144.md
Story Summary
FP-144 originally assumed online/Zoom meeting info needed to be added to mobile's My Events. Grounding found the actual remaining gap is much smaller than the ticket anticipated: the Event Detail screen already fully implements this (tappable meeting link, resource-name resolution, platform-label fallback — confirmed working, matches what Joseph's own FP-143 test screenshot showed: "Zoom: 9120082012" already rendering as a link). The backend list query (listEventsForMember) already selects all three online-meeting columns, and MyEvent's type already declares them — so there's no data-plumbing gap either, unlike the historical FP-127 rsvp_status case this ticket was worried about repeating. The only genuine remaining gap is a compact indicator on the My Events list itself (EventListItem.tsx) — nothing currently signals "this event has an online option" before tapping in.
Repo Target
Mobile (Expo/React Native) — owgc-tech/flockpulse-mobile. No web or backend changes — confirmed the data's already fully there.
Grounding Check
Confirmed live against dev:

Event Detail ([id].tsx) already works: onlineMeetingLink/onlineMeetingLabel are already computed (resource lookup → Zoom: <resource name>, or location-style fallback to online_meeting_platform_label or generic "Join Meeting"), already rendered as a tappable Linking.openURL() link alongside the address. No changes needed here.
MyEvent (the list type) already declares online_meeting_resource_id/online_meeting_url/online_meeting_platform_label, and — critically, checked directly rather than assumed — the web-side listEventsForMember() query already selects all three columns in its events select clause. The data genuinely reaches the mobile list today; it's just never displayed there.
EventListItem.tsx has zero mention of online-meeting fields anywhere — confirmed via grep. This is the sole real gap.
Existing visual pattern to reuse: this component already has an established "pill" badge (styles.pill/themed.pill, currently used for the effective-status label like "Upcoming") in a footer row. A new "Online" pill follows this exact same established pattern rather than introducing a new visual style.
Scope decision: the list-level indicator is informational only, not itself tappable — tapping the card still opens Event Detail as today, where the full tap-to-join link already exists and works. Making the list badge independently tappable would need a nested-Pressable (same pattern already used for the location link) for something that's one tap away regardless — not worth the added complexity for this story.
Domain rules: no conflict — display-only addition, no new data flow, no write path touched.

Implementation Plan

EventListItem.tsx: compute const isOnline = Boolean(event.online_meeting_resource_id || event.online_meeting_url); Add a second pill (reusing styles.pill/themed.pill) in the existing footer row, alongside the status pill, showing "Online" when isOnline is true. Not rendered at all when false — no empty/placeholder badge.

Files to Create/Modify

src/features/events/components/EventListItem.tsx

Migration Files
Not applicable.
Branch Name
feature/FP-144-online-meeting-list-indicator
Commit Message
FP-144: show Online indicator on My Events list (Event Detail already supported this)
Pull Request Description
Maps to acceptance criteria:

"Show online/Zoom meeting info in My Events (list and/or detail)" → Detail already worked (confirmed, unchanged); this PR adds the list-level compact indicator, the one genuine gap.
"No empty/placeholder UI when no meeting configured" → pill only renders when isOnline is true.
"Verify listEventsForMember/MyEvent already returns these fields" → confirmed yes, both at the type and the actual SQL select level — no widening needed, unlike the FP-127 precedent this ticket was cautious about.
"Tap behavior for the meeting link" → not applicable to this PR's scope; the list badge is informational only, the actual tappable link is Event Detail's existing, unchanged implementation.

Jira Linkage

PDEEpicID: FP-11 (EPIC-3 — Event Lifecycle Management)
PDEStoryID: FP-144

Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-144.md, frozen after save. Open PR against dev, do not merge. No migration, no remote step.
Include full diffs in the completion report — this should be a very small one.
