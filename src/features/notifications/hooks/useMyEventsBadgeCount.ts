import { useEffect, useState } from "react";
import { reportMyEventsBadgeCount } from "@/src/features/notifications/services/appIconBadge.service";

// DIP-FP-165: mirrors the other three badge hooks' module-level pub-sub
// store shape exactly (see useMyTasksBadgeCount.ts) — but unlike those
// three, there's no myEventsBadge.service.ts fetch-and-sync function
// alongside it. My Events already holds the full event list in local
// state; the badge count is derived from it (see (tabs)/index.tsx's
// pendingRsvpCount useMemo), not independently fetched. syncMyEventsBadge
// below is this screen's equivalent of the other three's syncXBadge()
// functions — same store-write + OS-combining-layer report — just taking
// an already-computed count instead of doing its own fetch, so it lives
// here rather than in a separate service file with nothing left to fetch.
let currentCount = 0;
const listeners = new Set<(count: number) => void>();

export function setMyEventsBadgeCount(count: number): void {
  currentCount = count;
  listeners.forEach((listener) => listener(count));
}

export function useMyEventsBadgeCount(): number {
  const [count, setCount] = useState(currentCount);

  useEffect(() => {
    listeners.add(setCount);
    return () => {
      listeners.delete(setCount);
    };
  }, []);

  return count;
}

export async function syncMyEventsBadge(count: number): Promise<void> {
  setMyEventsBadgeCount(count);
  await reportMyEventsBadgeCount(count);
}
