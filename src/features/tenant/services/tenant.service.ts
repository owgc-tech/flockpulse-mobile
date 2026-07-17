import { apiFetch } from "@/src/lib/api";

// Matches flockpulse-web's getTenantSettings() response (GET /api/tenant/settings)
// — confirmed live against the route handler/service function, built for
// FP-104's web-only Admin Nav Shell. The endpoint also returns
// id/attendance_window_hours/description/created_at, but only the fields
// CommunityBanner/rsvpNudgeReminders need are typed here — same "type only
// what this consumer uses" convention as MemberGroupPicker's
// GroupOption/MemberOption.
//
// DIP-FP-132-FP-133-FP-134: rsvp_closure_days_default/rsvp_nudge_days_1/2/3
// added — confirmed live against the route handler's select list (PR #77).
export interface TenantSettings {
  name: string;
  logo_url: string | null;
  tagline: string | null;
  rsvp_closure_days_default: number;
  rsvp_nudge_days_1: number;
  rsvp_nudge_days_2: number;
  rsvp_nudge_days_3: number;
}

export async function fetchTenantSettings(): Promise<TenantSettings> {
  return apiFetch<TenantSettings>("/api/tenant/settings");
}
