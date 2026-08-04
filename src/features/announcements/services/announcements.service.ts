import { apiFetch } from "@/src/lib/api";

// Matches flockpulse-web's AnnouncementAcknowledgementRow (POST success body)
// exactly — confirmed live against announcement.repository.ts, web's merged
// PR #151.
export interface AnnouncementAcknowledgement {
  id: string;
  event_id: string;
  member_id: string;
  acknowledged_at: string;
}

// DIP-FP-191-mobile: POST /api/announcements/:eventId/acknowledge — confirmed
// live against the merged route handler. Idempotent server-side (repeated
// taps return the same row rather than erroring), so callers don't need to
// track acknowledged state themselves before calling this.
export async function acknowledgeAnnouncement(eventId: string): Promise<AnnouncementAcknowledgement> {
  return apiFetch<AnnouncementAcknowledgement>(`/api/announcements/${eventId}/acknowledge`, {
    method: "POST",
  });
}
