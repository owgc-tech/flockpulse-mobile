DIP-FP-165.md
Story Summary
Adds a badge to the My Events tab counting events with no RSVP response yet, where RSVP is still open — reusing isRsvpWindowOpen rather than reimplementing closure logic.
Repo Target
Mobile only.
Grounding Check

isRsvpWindowOpen(event: { effective_status, rsvp_closure_at }) already exists and does exactly the check needed.
Genuine architectural difference from Confirmations/Self-Report/My Tasks' badges: those three have no local list to derive from, so they each fetch their own pending-count independently. My Events already holds the full list in local state (events), with everything (rsvp_status, effective_status, rsvp_closure_at) needed to compute the count — a separate fetch would be redundant, and worse, could show a different number than what's actually visible if the two queries ever diverged even slightly. This DIP derives the badge count locally (useMemo over events) rather than mirroring the other three's separate-fetch pattern — same downstream plumbing (module-level store, OS icon badge), different source of truth.
My Events' useFocusEffect only fires on a pending signal (FP-151), not a general refetch — so badge sync should trigger off events state changing (covers initial load, pull-to-refresh, and FP-151's background updates alike), not off focus directly.

Implementation Plan

Compute pendingRsvpCount = useMemo(() => events.filter(e => !e.rsvp_status && isRsvpWindowOpen(e)).length, [events]) in the My Events screen.
useEffect on events (or on pendingRsvpCount itself) calling a new syncMyEventsBadge(count)-style setter — reuses the existing module-level store + appIconBadge.service.ts combining layer, same as the other three badges, just fed a locally-computed count instead of its own fetch.
Wire tabBarBadge for the My Events (index) tab in _layout.tsx/AnimatedTabBar.tsx, mirroring the existing three.

Files to Create/Modify

app/(app)/(tabs)/index.tsx
src/features/notifications/hooks/useMyEventsBadgeCount.ts (new, mirroring the existing hook shape)
app/(app)/(tabs)/_layout.tsx, src/features/navigation/AnimatedTabBar.tsx

Branch Name
feature/FP-165-my-events-badge
Jira Linkage

PDEEpicID: FP-15
PDEStoryID: FP-165

Stop Point
Save verbatim to documentation/dips/DIP-FP-165.md, frozen after save. Open PR against dev, do not merge.
Include full diffs in the completion report.
