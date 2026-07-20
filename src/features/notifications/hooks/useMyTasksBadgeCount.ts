import { useEffect, useState } from "react";

// DIP-FP-164: mirrors useSelfReportBadgeCount.ts's module-level pub-sub
// store exactly, for the My Tasks tab's own in-app badge — kept as a
// separate store (not merged with Confirmations'/Self-Report's) so all
// three tabBarBadge values stay independent, each showing only its own
// count. myTasksBadge.service.ts's syncMyTasksBadge() is the sole writer
// (via setMyTasksBadgeCount).
let currentCount = 0;
const listeners = new Set<(count: number) => void>();

export function setMyTasksBadgeCount(count: number): void {
  currentCount = count;
  listeners.forEach((listener) => listener(count));
}

export function useMyTasksBadgeCount(): number {
  const [count, setCount] = useState(currentCount);

  useEffect(() => {
    listeners.add(setCount);
    return () => {
      listeners.delete(setCount);
    };
  }, []);

  return count;
}
