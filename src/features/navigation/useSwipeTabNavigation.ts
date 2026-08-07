import { useNavigation, useNavigationState } from "@react-navigation/native";
import { useVisibleTabRouteNames } from "@/src/features/navigation/visibleTabRouteNamesStore";

interface SwipeTabNavigation {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
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

  // Swipe left (finger moves right-to-left) advances forward, same
  // direction convention as iOS home-screen paging/Stories — swipe right
  // goes back. No wraparound at either end, per acceptance criteria: a
  // swipe past the first/last visible tab is simply a no-op.
  const navigateByOffset = (offset: number) => {
    if (!currentRouteName || visibleRouteNames.length === 0) return;
    const currentIndex = visibleRouteNames.indexOf(currentRouteName);
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
  };
}
