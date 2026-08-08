// FP-195-mobile-adj-2: deliberately not a full pub-sub store like
// visibleTabRouteNamesStore.ts — this value is read imperatively once,
// inside a useEffect at the moment a screen becomes focused, never
// subscribed to for re-renders. A plain module-level get/set pair is
// sufficient; replicating the listener-subscription machinery here would
// be unused complexity.
export type SwipeDirection = "left" | "right";

let lastDirection: SwipeDirection | null = null;

export function setLastSwipeDirection(direction: SwipeDirection | null): void {
  lastDirection = direction;
}

export function getLastSwipeDirection(): SwipeDirection | null {
  return lastDirection;
}
