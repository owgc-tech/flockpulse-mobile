import { useEffect, useState } from "react";

// FP-99: small module-level pub-sub store — no state library exists in this
// codebase, and the alternative (prop-drilling the count from
// (tabs)/_layout.tsx down through the tab navigator into
// confirmations/index.tsx, then back up again after a confirm/reject) is
// worse than a few lines of manual subscribe/notify.
// confirmationBadge.service.ts's syncConfirmationBadge() is the sole writer
// (via setConfirmationBadgeCount, called every time it resyncs); this hook
// is how the tab layout's in-app badge picks up the latest value without
// fetching anything itself.
let currentCount = 0;
const listeners = new Set<(count: number) => void>();

export function setConfirmationBadgeCount(count: number): void {
  currentCount = count;
  listeners.forEach((listener) => listener(count));
}

export function useConfirmationBadgeCount(): number {
  const [count, setCount] = useState(currentCount);

  useEffect(() => {
    listeners.add(setCount);
    return () => {
      listeners.delete(setCount);
    };
  }, []);

  return count;
}
