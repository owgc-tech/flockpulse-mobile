import { apiFetch } from "@/src/lib/api";
import type { MyEvent, RosterEntry, RsvpResponse, RsvpStatus } from "@/src/features/events/types";

export async function listMyEvents(): Promise<MyEvent[]> {
  return apiFetch<MyEvent[]>("/api/events/mine");
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
