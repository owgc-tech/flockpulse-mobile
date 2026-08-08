// DIP-FP-179-mobile: @react-navigation/native is no longer a standalone
// installable package as of expo-router 57 — same finding as
// AnimatedTabBar.tsx's own import (see its comment for the full grounding).
import { useNavigation, useNavigationState } from "expo-router/build/react-navigation/native";
import { useVisibleTabRouteNames } from "@/src/features/navigation/visibleTabRouteNamesStore";

interface SwipeTabNavigation {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  // FP-195-mobile-adj-2: exposes the same boundary check navigateByOffset()
  // already used internally to decide whether to no-op, so
  // SwipeableTabScreen.tsx can skip the off-screen slide animation entirely
  // when there's no adjacent tab to land on — see its own comment for why
  // that matters (a stuck-blank-screen bug otherwise).
  canSwipeLeft: boolean;
  canSwipeRight: boolean;
}

// DIP-FP-194-mobile: called from within a tab screen — useNavigation()/
// useNavigationState() resolve to the parent Tabs navigator directly,
// since tab screens are its direct children (confirmed against
// AnimatedTabBar.tsx's own navigation prop, same navigator). The visible
// route list comes from visibleTabRouteNamesStore.ts (published by
// AnimatedTabBar, the one place descriptors/options are actually
// available) rather than being recomputed here — see that store's own doc
// comment for why isRouteHidden can't be called directly from a screen.
export function useSwipeTabNavigation(): SwipeTabNavigation {
  const navigation = useNavigation();
  const currentRouteName = useNavigationState((state) => state.routes[state.index]?.name);
  const visibleRouteNames = useVisibleTabRouteNames();

  const currentIndex = currentRouteName ? visibleRouteNames.indexOf(currentRouteName) : -1;

  // Swipe left (finger moves right-to-left) advances forward, same
  // direction convention as iOS home-screen paging/Stories — swipe right
  // goes back. No wraparound at either end, per acceptance criteria: a
  // swipe past the first/last visible tab is simply a no-op.
  const navigateByOffset = (offset: number) => {
    if (currentIndex === -1) return;

    const targetIndex = currentIndex + offset;
    if (targetIndex < 0 || targetIndex >= visibleRouteNames.length) return;

    // Dynamic route name, not a literal from this navigator's own param
    // list — same pattern AnimatedTabBar.tsx already uses for its onPress
    // handler (navigation.navigate(route.name, route.params)).
    navigation.navigate(visibleRouteNames[targetIndex] as never);
  };

  return {
    onSwipeLeft: () => navigateByOffset(1),
    onSwipeRight: () => navigateByOffset(-1),
    canSwipeLeft: currentIndex !== -1 && currentIndex + 1 < visibleRouteNames.length,
    canSwipeRight: currentIndex !== -1 && currentIndex - 1 >= 0,
  };
}
