DIP-FP-168.md
Story Summary
Reorders the mobile tab bar from My Events, Confirmations, Self-Report, My Tasks to My Events, My Tasks, Self-Report, Confirmations.
Repo Target
Mobile only.
Grounding Check

Confirmed live: AnimatedTabBar derives tab order from state.routes, itself driven by <Tabs.Screen> declaration order in _layout.tsx — already verified against expo-router's internals per an existing comment in that file. Pure reorder, no rendering-logic change needed.
Each <Tabs.Screen> block carries its own badge/href logic (tabBarBadge, showConfirmations gating) inline — these must move as complete blocks, not be reconstructed, to avoid accidentally dropping any of that logic.

Implementation Plan

Reorder the four <Tabs.Screen> blocks in app/(app)/(tabs)/_layout.tsx to: index (My Events), my-tasks/index, self-report/index, confirmations/index — moving each block wholesale (props, comments, badge logic intact), not rewriting them.

Files to Create/Modify

app/(app)/(tabs)/_layout.tsx

Branch Name
feature/FP-168-reorder-tabs
Jira Linkage

PDEEpicID: FP-31
PDEStoryID: FP-168

Stop Point
Save verbatim to documentation/dips/DIP-FP-168.md, frozen after save. Open PR against dev, do not merge.
Include full diff in the completion report.
