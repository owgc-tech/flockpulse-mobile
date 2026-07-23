import { apiFetch } from "@/src/lib/api";
import type { EventType } from "@/src/features/event-types/types";
import type { DashboardEventOption, DashboardStats, DefaultDashboard } from "@/src/features/dashboard/types";

// GET /api/dashboard/default — the latest event (across all event types)
// this caller can see stats for, with that event's stats bundled in, or
// null if they have no visible events at all yet. No role/visibility
// branching here or in the screen that calls this — a Member and an Admin
// simply get different responses from the same endpoint.
export async function getDefaultDashboard(): Promise<DefaultDashboard | null> {
  return apiFetch<DefaultDashboard | null>("/api/dashboard/default");
}

// Thin wrapper per this feature's own Implementation Plan, even though
// src/features/event-types/services/eventTypes.service.ts already exposes
// the same GET /api/event-types call — kept local rather than a cross-
// feature import, matching this codebase's existing convention of each
// feature owning its own thin apiFetch wrappers (see self-reports/events).
export async function listEventTypes(): Promise<EventType[]> {
  return apiFetch<EventType[]>("/api/event-types");
}

// GET /api/event-types/:id/events — every event of this type visible to the
// caller, most-recent-first; the screen auto-selects the first entry
// whenever the Event Type dropdown changes.
export async function listEventsForType(eventTypeId: string): Promise<DashboardEventOption[]> {
  return apiFetch<DashboardEventOption[]>(`/api/event-types/${eventTypeId}/events`);
}

export async function getDashboardStats(eventId: string): Promise<DashboardStats> {
  return apiFetch<DashboardStats>(`/api/dashboard/stats?event_id=${eventId}`);
}
