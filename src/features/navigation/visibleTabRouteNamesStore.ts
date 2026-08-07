import { useEffect, useState } from "react";

// DIP-FP-194-mobile addition, not in the DIP's original file list:
// useNavigation()/useNavigationState() (called from within a tab screen)
// only expose the raw navigation state (routes/index) — per-route options
// (what isRouteHidden actually reads, tabBarItemStyle) only ever reach the
// tabBar render prop (AnimatedTabBar's own {state, descriptors, ...}
// props). There is no public react-navigation hook a descendant screen can
// call to read a sibling route's descriptor/options — useDescriptors is
// framework-internal, not exported from @react-navigation/core's public
// API. AnimatedTabBar is the one place that legitimately has descriptors,
// so it publishes its already-computed visible-route-name list here;
// useSwipeTabNavigation.ts reads it instead of a second, unreachable
// computation. Mirrors this app's existing pub-sub precedent
// (useSelfReportBadgeCount.ts) rather than introducing a new pattern.
let currentRouteNames: string[] = [];
const listeners = new Set<(routeNames: string[]) => void>();

export function setVisibleTabRouteNames(routeNames: string[]): void {
  currentRouteNames = routeNames;
  listeners.forEach((listener) => listener(routeNames));
}

export function useVisibleTabRouteNames(): string[] {
  const [routeNames, setRouteNames] = useState(currentRouteNames);

  useEffect(() => {
    listeners.add(setRouteNames);
    return () => {
      listeners.delete(setRouteNames);
    };
  }, []);

  return routeNames;
}
