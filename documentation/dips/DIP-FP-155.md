DIP-FP-155.md
Story Summary
Replaces the current plain-text tab bar ((tabs)/_layout.tsx, using Expo Router's default rendering) with a fully custom pill-based tab bar: an oval outer container, a translucent highlight pill that animates behind the active tab, and SVG icons above each label. This is a JS-based approximation of Apple's Liquid Glass effect, not the true native version — chosen because it ships through the existing Expo Go / OTA workflow with no native rebuild required, unlike expo-router/unstable-native-tabs.
Repo Target
Mobile (Expo/React Native) — owgc-tech/flockpulse-mobile.
Grounding Check
Confirmed live against dev:

Current tab bar has zero icons — plain tabBarLabel text only, relying on Expo Router's default <Tabs> rendering with basic color/style overrides. Three tabs today: index (My Events), confirmations/index (Confirmations — conditionally hidden via href: showConfirmations ? undefined : null for Member-tier accounts), self-report/index (Self-Report). Both Confirmations and Self-Report use tabBarBadge driven by live pending-count hooks (useConfirmationBadgeCount/useSelfReportBadgeCount).
expo-router's <Tabs> accepts a tabBar prop, confirmed via Expo's own documentation and multiple independent implementation guides — it extends React Navigation's Bottom Tabs Navigator v7 directly, and tabBar={(props: BottomTabBarProps) => <CustomTabBar {...props} />} is a standard, fully supported pattern. No API uncertainty here — this DIP replaces the entire tab bar rendering via this prop, not a partial customization.
Everything the default renderer currently handles must be manually reimplemented once a fully custom tabBar takes over: reading descriptors[route.key].options for tabBarLabel/tabBarBadge, respecting state.routes filtering for hidden (href: null) routes, theme-aware colors, and the safe-area bottom inset (BottomTabBarProps provides insets directly — use it, don't hardcode padding).
Dependencies: react-native-svg (15.12.1) is already installed. lucide-react-native (new — pairs with the already-installed react-native-svg as its peer dependency, standard/well-supported icon library) and expo-blur (new — for the pill's translucent/frosted tint) both need adding. Both are standard first-party-adjacent Expo ecosystem packages, expected to work via Expo Go without a native rebuild — verify this live at DIP time rather than assuming, since an incorrect assumption here would silently reintroduce the exact "needs an EAS Build" blocker this story was chosen specifically to avoid.
Animation: React Native's built-in Animated API (Animated.spring) is sufficient for a "slide highlight pill to new tab position" transition — no need for react-native-reanimated (not currently installed, and adding it would be an unnecessary new dependency for this scope). Tab positions/widths must be measured via onLayout on each tab button (labels vary in length — "My Events" vs. "Self-Report" — so tabs aren't equal-width; don't assume equal division).
Domain rules: no conflict — pure navigation-chrome UI, no data or business logic touched.

Implementation Plan

Add dependencies: lucide-react-native, expo-blur. Verify both work via the current Expo Go workflow before proceeding — if either genuinely requires a native rebuild, stop and flag back rather than silently reintroducing the EAS Build blocker.
New component src/features/navigation/AnimatedTabBar.tsx, typed against BottomTabBarProps:

Outer oval container (rounded pill shape, matching the reference screenshot), positioned as the tab bar.
Renders one pressable per visible route (state.routes, filtered for any href: null-hidden routes — Confirmations must still disappear entirely for Member-tier, not just visually deprioritized).
Each tab: a lucide-react-native icon above the label (My Events → Calendar, Confirmations → CheckCircle, Self-Report → ClipboardCheck — reasonable defaults, not rigidly mandated), plus the existing tabBarBadge value read from descriptors[route.key].options.tabBarBadge, rendered the same way the default tab bar already shows it (small dot/count).
A separate, absolutely-positioned highlight View behind the active tab, using BlurView (from expo-blur) for the translucent tint, layered with a subtle theme-aware background color for legibility in both light and dark mode.
On mount and on every tab-index change, measure the active tab's onLayout position/width and animate the highlight's translateX/width to match via Animated.spring() — not an instant jump.
Respect insets (from BottomTabBarProps) for safe-area bottom padding.


(tabs)/_layout.tsx: pass tabBar={(props) => <AnimatedTabBar {...props} />} to <Tabs>. Remove the now-redundant tabBarStyle/tabBarActiveTintColor/tabBarInactiveTintColor from screenOptions (the custom tab bar owns all of this now) — but leave tabBarLabel/tabBarBadge/href on each Tabs.Screen exactly as they are today, since the custom tab bar reads those via descriptors, not by redefining them.

Files to Create/Modify

package.json (new dependencies: lucide-react-native, expo-blur)
src/features/navigation/AnimatedTabBar.tsx (new)
app/(app)/(tabs)/_layout.tsx

Migration Files
Not applicable.
Branch Name
feature/FP-155-animated-pill-tab-bar
Commit Message
FP-155: animated pill-highlight tab bar with icons (JS-based Liquid Glass approximation)
Pull Request Description
Maps to acceptance criteria:

"Oval container, sliding highlight pill" → AnimatedTabBar.tsx's measured-position Animated.spring() transition.
"Translucent tint, not flat fill" → BlurView from expo-blur.
"SVG icon per tab" → lucide-react-native icons, new addition (none existed before).
"All existing behavior preserved" → badges, Member-tier Confirmations hiding, theme, safe-area insets all explicitly re-verified against the default renderer's prior behavior, not just visually similar.
"No EAS Build required" → both new dependencies verified Expo-Go-compatible before use, flagged explicitly if that assumption doesn't hold.

Jira Linkage

PDEEpicID: FP-31 (EPIC-8 — placement only, general mobile UX, not thematically notifications-related, same caveat as FP-145)
PDEStoryID: FP-155

Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-155.md, frozen after save. Open PR against dev, do not merge. No migration, no remote step.
Include full diffs for every file in the completion report.
