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

// Matches flockpulse-web's AnnouncementRosterEntry (GET .../roster success
// body) exactly — confirmed live against announcement.repository.ts, web's
// merged PR #161.
export interface AnnouncementRosterEntry {
  member_id: string;
  first_name: string;
  last_name: string;
  acknowledged_at: string | null;
}

// DIP-FP-191-mobile-adj-5: GET /api/announcements/:eventId/roster —
// confirmed live against the merged route handler. Admin/Leader only
// (requireRole('LEADER') server-side); a Leader-tier caller gets a roster
// scoped to their own assigned members, same convention as
// GET /api/events/:id/roster.
export async function getAnnouncementRoster(eventId: string): Promise<AnnouncementRosterEntry[]> {
  return apiFetch<AnnouncementRosterEntry[]>(`/api/announcements/${eventId}/roster`);
}
