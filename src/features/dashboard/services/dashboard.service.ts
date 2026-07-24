import { apiFetch } from "@/src/lib/api";
import type {
  DashboardEventOption,
  DashboardEventType,
  DashboardStats,
  DefaultDashboardEvent,
} from "@/src/features/dashboard/types";

// DIP-FP-182-mobile-adj-1: real paths confirmed live against
// flockpulse-web's app/api/reports/dashboard/*/route.ts files — the first
// draft guessed at /api/dashboard/* and, for event-types/events, silently
// reused the unrelated general /api/event-types endpoints instead (no
// visibility/year/already-held filtering, never the intended source).

// GET /api/reports/dashboard/default — the latest already-held event
// (across all event types) this caller can see, or null if they have no
// visible events at all yet. No stats bundled in — see
// DefaultDashboardEvent's doc comment in types.ts.
export async function getDefaultDashboard(): Promise<DefaultDashboardEvent | null> {
  return apiFetch<DefaultDashboardEvent | null>("/api/reports/dashboard/default");
}

// Admin-tier: every active event type tenant-wide. Everyone else: only
// types with at least one event they're invited to. No conditional logic
// here — the response itself differs by caller.
export async function listEventTypes(): Promise<DashboardEventType[]> {
  return apiFetch<DashboardEventType[]>("/api/reports/dashboard/event-types");
}

// Current calendar year, already-started events only, most-recent-first —
// intersected with visibility server-side.
export async function listEventsForType(eventTypeId: string): Promise<DashboardEventOption[]> {
  return apiFetch<DashboardEventOption[]>(
    `/api/reports/dashboard/events?event_type_id=${eventTypeId}`
  );
}

export async function getDashboardStats(eventId: string): Promise<DashboardStats> {
  return apiFetch<DashboardStats>(`/api/reports/dashboard/stats?event_id=${eventId}`);
}
