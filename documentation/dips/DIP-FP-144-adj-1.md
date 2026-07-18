DIP-FP-144-adj-1.md
Story Summary
Revision to the not-yet-merged PR #26 (feature/FP-144-online-meeting-list-indicator). Joseph tested that branch directly and found the "Online" pill gives the wrong impression — it doesn't say how to join, just that the event is online. This DIP removes the pill and replaces it with a real, tappable link showing the actual meeting account/platform name, mirroring exactly how Event Detail already resolves and displays this (Zoom resource name, or the free-text platform label for other platforms) — so list and detail show consistent information.
Repo Target
Mobile (Expo/React Native) — owgc-tech/flockpulse-mobile.
Grounding Check

PR #26 is unmerged. dev does not yet contain the "Online" pill code at all — it only exists on feature/FP-144-online-meeting-list-indicator. This work must happen on that existing branch, adding commits to the same PR, not a new branch off dev — a fresh branch off dev would be missing the very pill code this DIP needs to remove.
Event Detail's exact resolution logic ([id].tsx): if online_meeting_resource_id is set, it's a tracked Zoom resource — fetched via listMeetingResources(), matched by id, label is `Zoom: ${resource?.name ?? "Join Meeting"}`, link is resource?.join_url. If not set but online_meeting_url is present, it's a free-text "other platform" entry — label is event.online_meeting_platform_label || "Join Meeting", link is event.online_meeting_url directly. This DIP reuses this exact logic.
(tabs)/index.tsx (the list screen) does not currently fetch listMeetingResources() — only PR #26's branch has the events fetch plus the pill. This DIP adds the resources fetch once at the list-screen level, passed down to each EventListItem.
EventListItem.tsx already has an established nested-Pressable pattern for the tappable address link — the new link reuses this exact pattern, placed directly below the address line and above the existing status-pill footer block, per Joseph's explicit placement request.
PR #26's pill code (isOnline boolean and the pill block) is fully removed, not layered alongside the new link.

Implementation Plan

Check out the existing feature/FP-144-online-meeting-list-indicator branch (do not create a new branch off dev).
(tabs)/index.tsx: fetch listMeetingResources() alongside the existing events fetch, store in state, pass down as a new meetingResources prop to each EventListItem.
EventListItem.tsx:

Remove the isOnline boolean and the "Online" pill block from PR #26 entirely.
Accept a new meetingResources: MeetingResource[] prop.
Compute onlineMeetingLink/onlineMeetingLabel using the identical logic from [id].tsx.
Render as a second nested Pressable directly below the address-link Pressable, above the footer block — same touch-target pattern as the address link, opening via Linking.openURL(onlineMeetingLink). Only rendered when onlineMeetingLink is truthy.



Files to Create/Modify

app/(app)/(tabs)/index.tsx
src/features/events/components/EventListItem.tsx

Migration Files
Not applicable.
Branch Name
Continue on the existing feature/FP-144-online-meeting-list-indicator branch — do not create a new one.
Commit Message
FP-144: replace Online pill with resolved, tappable meeting link (pre-merge revision)
Pull Request Description
Amend PR #26's existing description (or add a comment) noting: the "Online" pill was replaced before merge, based on live testing feedback, with a tappable link showing the actual account/platform name — reusing Event Detail's exact resolution logic. No separate PR needed; this is additional commits on the same open PR.
Jira Linkage

PDEEpicID: FP-11 (EPIC-3 — Event Lifecycle Management)
PDEStoryID: FP-144

Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-144-adj-1.md on the same feature/FP-144-online-meeting-list-indicator branch, frozen after save. Push the additional commits to the same PR #26 — do not open a new PR. Do not merge — Joseph will re-test the updated branch and merge when ready. No migration, no remote step.
Include full diffs for every file in the completion report.
