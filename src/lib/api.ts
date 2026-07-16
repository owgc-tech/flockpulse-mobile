import { supabase } from "@/src/lib/supabase";

// The /api/... routes this hits live in the flockpulse-web Next.js app, a
// separate deployment from this mobile app — unlike EXPO_PUBLIC_SUPABASE_URL,
// there's no existing convention for this in the mobile repo yet (the auth
// DIP only ever talked to Supabase Auth directly). Added here since it's
// required for every call this DIP makes; not present in the DIP itself.
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error(
    "Missing EXPO_PUBLIC_API_BASE_URL. Copy .env.example to .env and fill in values."
  );
}

// MEETING_RESOURCE_CONFLICT's structured conflict payload (DIP-FP-120-mobile)
// — null only for the rare race-condition fallback path, where the server's
// own `message` is displayed as-is instead.
export interface MeetingResourceConflict {
  eventId: string;
  eventName: string;
  startDatetime: string;
  endDatetime: string;
  bookedByName: string;
}

export class ApiError extends Error {
  code: string;
  status: number;
  conflict: MeetingResourceConflict | null;

  constructor(code: string, message: string, status: number, conflict: MeetingResourceConflict | null = null) {
    super(message);
    this.code = code;
    this.status = status;
    this.conflict = conflict;
  }
}

interface ApiEnvelope<T> {
  data?: T;
  error?: { code: string; message: string; conflict?: MeetingResourceConflict | null };
}

// Mirrors flockpulse-web's own API shape exactly: Authorization: Bearer
// <access_token> (no cookies anywhere in this API surface), and every
// response is either { data } or { error: { code, message } }.
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new ApiError("AUTH_REQUIRED", "No active session.", 401);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...init?.headers,
    },
  });

  const body = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || body.error) {
    const { code = "UNKNOWN_ERROR", message = "Something went wrong.", conflict = null } = body.error ?? {};
    throw new ApiError(code, message, response.status, conflict);
  }

  return body.data as T;
}
