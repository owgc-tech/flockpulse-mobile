import { apiFetch } from "@/src/lib/api";

interface TenantSettings {
  id: string;
  name: string;
  attendance_window_hours: number;
  logo_url: string | null;
  tagline: string | null;
  description: string | null;
  created_at: string;
}

// Doesn't change often — cached in-memory per app session rather than
// re-fetched on every reconciliation pass.
let cachedAttendanceWindowHours: number | null = null;

export async function fetchAttendanceWindowHours(): Promise<number> {
  if (cachedAttendanceWindowHours !== null) {
    return cachedAttendanceWindowHours;
  }
  const settings = await apiFetch<TenantSettings>("/api/tenant/settings");
  cachedAttendanceWindowHours = settings.attendance_window_hours;
  return cachedAttendanceWindowHours;
}
