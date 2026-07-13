import { apiFetch } from "@/src/lib/api";
import type {
  CreatedEvent,
  CreateEventInput,
  EventDetail,
  MyEvent,
  PublishedEvent,
  RosterEntry,
  RsvpResponse,
  RsvpStatus,
  UpdatedEvent,
  UpdateEventInput,
} from "@/src/features/events/types";

export async function listMyEvents(): Promise<MyEvent[]> {
  return apiFetch<MyEvent[]>("/api/events/mine");
}

// Fresh-fetch for the event detail / self-report screens: the event object
// they initially render came baked into a notification's data payload at
// scheduling time, which can go stale (edited/cancelled) by the time the
// reminder actually fires. No role restriction server-side.
export async function getEventById(eventId: string): Promise<EventDetail> {
  return apiFetch<EventDetail>(`/api/events/${eventId}`);
}

// Callers can branch on err.code (RSVP_CLOSED / RSVP_REASON_REQUIRED /
// NOT_AN_ATTENDEE / INVALID_STATE / ...) via ApiError rather than getting a
// single generic failure — see src/lib/api.ts.
export async function submitRsvp(
  eventId: string,
  rsvpStatus: RsvpStatus,
  rsvpReason?: string
): Promise<RsvpResponse> {
  return apiFetch<RsvpResponse>("/api/rsvps", {
    method: "POST",
    body: JSON.stringify({
      event_id: eventId,
      rsvp_status: rsvpStatus,
      // Server nulls rsvp_reason regardless for YES — only send it for NO.
      ...(rsvpStatus === "NO" ? { rsvp_reason: rsvpReason } : {}),
    }),
  });
}

export async function getEventRoster(eventId: string): Promise<RosterEntry[]> {
  return apiFetch<RosterEntry[]>(`/api/events/${eventId}/roster`);
}

// Callers can branch on err.code (MISSING_FIELD / INVALID_DATETIME /
// INVALID_TARGET / INVALID_FORMATION_LINK / ...) via ApiError. Role-gated
// requireRole('LEADER') server-side — Leader-tier and Admin-tier both.
export async function createEvent(input: CreateEventInput): Promise<CreatedEvent> {
  return apiFetch<CreatedEvent>("/api/events", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Role-gated requireRole('ADMIN') server-side today — a Leader-tier caller
// creating an event will get this call to 403 until FP-114 widens it (see
// DIP-FP-115-mobile Grounding Check and this PR's description).
export async function publishEvent(eventId: string): Promise<PublishedEvent> {
  return apiFetch<PublishedEvent>(`/api/events/${eventId}/publish`, {
    method: "POST",
  });
}

// Callers can branch on err.code (NOT_FOUND / FORBIDDEN_SCOPE / INVALID_STATE
// / IMMUTABLE_FIELD / INVALID_DATETIME / INVALID_FORMATION_LINK) via
// ApiError. Role-gated requireRole('LEADER') server-side, with an additional
// ownership scope enforced server-side for exactly-Leader-tier callers
// (Admin-tier can edit any event) — see DIP-FP-115-mobile-nav-calendar-edit
// Grounding Check. Client-side canEdit gating is a UI convenience only; this
// is the real enforcement.
export async function updateEvent(eventId: string, input: UpdateEventInput): Promise<UpdatedEvent> {
  return apiFetch<UpdatedEvent>(`/api/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
