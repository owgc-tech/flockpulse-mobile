import { useEffect, useState } from "react";

// DIP-FP-119-mobile: mirrors useConfirmationBadgeCount.ts's module-level
// pub-sub store exactly, for the Self-Report tab's own in-app badge — kept
// as a separate store (not merged with Confirmations') so the two
// tabBarBadge values stay independent, each showing only its own count.
// selfReportBadge.service.ts's syncSelfReportBadgeCount() is the sole
// writer (via setSelfReportBadgeCount).
let currentCount = 0;
const listeners = new Set<(count: number) => void>();

export function setSelfReportBadgeCount(count: number): void {
  currentCount = count;
  listeners.forEach((listener) => listener(count));
}

export function useSelfReportBadgeCount(): number {
  const [count, setCount] = useState(currentCount);

  useEffect(() => {
    listeners.add(setCount);
    return () => {
      listeners.delete(setCount);
    };
  }, []);

  return count;
}
