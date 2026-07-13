import { apiFetch } from "@/src/lib/api";

// Matches flockpulse-web's getTenantSettings() response (GET /api/tenant/settings)
// — confirmed live against the route handler/service function, built for
// FP-104's web-only Admin Nav Shell. The endpoint also returns
// id/attendance_window_hours/description/created_at, but only the three
// fields CommunityBanner needs are typed here — same "type only what this
// consumer uses" convention as MemberGroupPicker's GroupOption/MemberOption.
export interface TenantSettings {
  name: string;
  logo_url: string | null;
  tagline: string | null;
}

export async function fetchTenantSettings(): Promise<TenantSettings> {
  return apiFetch<TenantSettings>("/api/tenant/settings");
}
