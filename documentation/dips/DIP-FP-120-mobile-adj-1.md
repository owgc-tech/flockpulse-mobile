# DIP-FP-120-mobile-adj-1

## Story Summary
Three fixes to the not-yet-merged FP-120-mobile work: resolve the real Zoom account name (instead of leaving the generic placeholder) and highlight the currently-selected account on edit; refetch Event Detail on focus instead of only on mount, so returning to the screen after editing elsewhere picks up the change; prefix the online-meeting label with "Zoom:" for tracked accounts so it reads distinctly from a freeform "Other platform" link.

## Repo Target
Mobile (Expo) — `owgc-tech/flockpulse-mobile`.

## Grounding Check

* `useFocusEffect` import path verified live: `node_modules/expo-router/build/exports.js` re-exports it directly from `expo-router` (`export { useFocusEffect, EffectCallback } from './useFocusEffect'`), and its own doc comment confirms the intended usage is `import { useFocusEffect } from 'expo-router'` paired with `useCallback` wrapping the effect body — matching the snippet below. No `@react-navigation/native` import needed.
* Checked for existing `useFocusEffect` usage elsewhere in this codebase as a live precedent: the only hits are in `documentation/dips/DIP-FP-66-FP-94-FP-95-mobile-adj-1.md`, which document that a prior `useFocusEffect` refetch-on-focus (on the events list screen) was deliberately *removed* in favor of pull-to-refresh, to fix a loading-state blink — not a precedent against using it here, since Event Detail's fresh-fetch-and-merge (not a full-screen loading state) doesn't have that blink problem.

## Implementation Plan

1. `edit.tsx` — resolve the real account name and highlight the current selection:

```ts
useEffect(() => {
  if (!initialEvent.online_meeting_resource_id) return;
  listMeetingResources()
    .then((resources) => {
      const match = resources.find((r) => r.id === initialEvent.online_meeting_resource_id);
      if (match) setOnlineMeetingResourceLabel(match.name);
    })
    .catch(() => {
      // Leave the existing placeholder if this fails — non-fatal.
    });
}, []);
```

In `MeetingResourcePicker`, accept the currently-selected id as a prop and highlight that row:

```tsx
function MeetingResourcePicker({
  resourceLabel,
  selectedResourceId,
  onChange,
}: {
  resourceLabel: string | undefined;
  selectedResourceId: string | undefined;
  onChange: (resourceId: string | undefined, label: string | undefined) => void;
}) {
  // ...
  renderItem={({ item }) => (
    <Pressable
      style={[styles.optionRow, item.id === selectedResourceId && styles.optionRowSelected]}
      onPress={() => handleSelect(item)}
      testID={`meeting-resource-${item.id}`}
    >
      <Text style={[styles.optionLabel, item.id === selectedResourceId && styles.optionLabelSelected]}>
        {item.name}
      </Text>
    </Pressable>
  )}
```

Pass `selectedResourceId={onlineMeetingResourceId}` at both call sites (`create.tsx` and `edit.tsx`). Add `optionRowSelected`/`optionLabelSelected` styles (light background + bold/blue text, consistent with the app's existing "selected" visual language elsewhere).

2. `events/[id].tsx` — refetch on focus, not just on mount. Replace the existing mount-only fresh-fetch effect with a focus-triggered one:

```ts
useFocusEffect(
  useCallback(() => {
    if (!params.id) return;
    getEventById(params.id)
      .then((fresh) => {
        setEvent((prev) => (prev ? { ...prev, ...fresh } : prev));
      })
      .catch((err) => {
        console.warn("Failed to fresh-fetch event:", err);
      });
  }, [params.id])
);
```

3. `events/[id].tsx` — prefix the Zoom label:

```ts
const onlineMeetingLabel = event.online_meeting_resource_id
  ? `Zoom: ${meetingResource?.name ?? "Join Meeting"}`
  : event.online_meeting_platform_label || "Join Meeting";
```

## Files to Create/Modify

```
app/(app)/events/create.tsx        (modified)
app/(app)/events/[id]/edit.tsx     (modified)
app/(app)/events/[id].tsx          (modified)
```

## Migration Files
None.

## Branch Name
`feature/FP-120-mobile-online-meeting-support` (same branch, no new branch — pushed as additional commits onto the existing not-yet-merged PR).

## Commit Message
`FP-120-mobile-adj-1: resolve Zoom account name/selection, refetch event detail on focus, prefix Zoom label`

## Pull Request Description
Adjustment round on PR #14 (not yet merged): edit.tsx now resolves and displays the real tracked Zoom account name instead of a generic placeholder, and highlights the currently-selected account in the picker; Event Detail now refetches on focus (not just mount) so edits made elsewhere are reflected on return; the online-meeting link label is now prefixed "Zoom:" for tracked-account meetings to distinguish it from freeform "Other platform" links.

## Jira Linkage

* PDEEpicID: FP-11
* PDEStoryID: FP-120

## Stop Point
Push these commits onto the existing branch, update PR #14's description to describe this round, do not merge — same reviewer/merge process as everything else today.
