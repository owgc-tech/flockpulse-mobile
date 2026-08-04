import { apiFetch } from "@/src/lib/api";
import type {
  CreatedEvent,
  CreateEventInput,
  EventDetail,
  MeetingResource,
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

// GET /api/meeting-resources — the tracked Zoom accounts a Leader/Admin can
// book an event against, for the Online Meeting picker on create/edit.
export async function listMeetingResources(): Promise<MeetingResource[]> {
  return apiFetch<MeetingResource[]>("/api/meeting-resources");
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
// DIP-FP-189-mobile: guestCount mirrors rsvpReason's conditional-inclusion
// pattern above — only sent when the caller actually provides it (RsvpControls
// only ever does so for Yes/Tentative on a guests-allowed event), confirmed
// against web's merged PR #158's guest_count field name and its own
// NO-rejects-guest_count / guests-not-allowed-rejects-guest_count validation.
export async function submitRsvp(
  eventId: string,
  rsvpStatus: RsvpStatus,
  rsvpReason?: string,
  guestCount?: number
): Promise<RsvpResponse> {
  return apiFetch<RsvpResponse>("/api/rsvps", {
    method: "POST",
    body: JSON.stringify({
      event_id: eventId,
      rsvp_status: rsvpStatus,
      // Server nulls rsvp_reason regardless for YES — only send it for NO.
      ...(rsvpStatus === "NO" ? { rsvp_reason: rsvpReason } : {}),
      ...(guestCount !== undefined ? { guest_count: guestCount } : {}),
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
