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

// FP-187-mobile: DELETE /api/members/me's INVALID_STATE_TRANSITION carries
// exactly one of these three (confirmed live against the route handler) —
// mirrors the `conflict` field's own precedent for a different endpoint's
// structured 409 payload, rather than making callers regex-parse `message`.
export class ApiError extends Error {
  code: string;
  status: number;
  conflict: MeetingResourceConflict | null;
  assignedMemberCount: number | null;
  ownedGroupCount: number | null;
  ownedEventCount: number | null;

  constructor(
    code: string,
    message: string,
    status: number,
    conflict: MeetingResourceConflict | null = null,
    assignedMemberCount: number | null = null,
    ownedGroupCount: number | null = null,
    ownedEventCount: number | null = null
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.conflict = conflict;
    this.assignedMemberCount = assignedMemberCount;
    this.ownedGroupCount = ownedGroupCount;
    this.ownedEventCount = ownedEventCount;
  }
}

interface ApiEnvelope<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    conflict?: MeetingResourceConflict | null;
    assignedMemberCount?: number | null;
    ownedGroupCount?: number | null;
    ownedEventCount?: number | null;
  };
}

// FP-206: prevents a hung request (dead/degraded connection) from leaving a
// screen in an infinite loading state with no recourse.
const REQUEST_TIMEOUT_MS = 15000;

function timeoutError(): ApiError {
  return new ApiError(
    "TIMEOUT",
    "This is taking longer than expected. Check your connection and try again.",
    0
  );
}

// FP-206: getSession() takes no arguments — confirmed live against
// @supabase/auth-js's GoTrueClient (no AbortSignal param exists) — so unlike
// the fetch() call below, it can't be bounded via AbortController. It also
// isn't reliably bounded internally: when the stored session has expired,
// __loadSession triggers a token-refresh network call with no timeout of its
// own (confirmed: no AbortController/timeout logic anywhere in auth-js's
// GoTrueClient network path). Promise.race against a rejecting timer is the
// only way to bound it from the outside.
function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(timeoutError()), REQUEST_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

// Mirrors flockpulse-web's own API shape exactly: Authorization: Bearer
// <access_token> (no cookies anywhere in this API surface), and every
// response is either { data } or { error: { code, message } }.
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await withTimeout(supabase.auth.getSession());

  if (!session) {
    throw new ApiError("AUTH_REQUIRED", "No active session.", 401);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        ...init?.headers,
      },
      signal: controller.signal,
    });
  } catch (err) {
    // FP-206-adj-1: Expo's real fetch implementation throws a FetchError
    // (node_modules/expo/src/winter/fetch/FetchErrors.ts) that never sets
    // .name — confirmed by reading its source — so it inherits the generic
    // "Error" rather than "AbortError" and the previous err.name check never
    // matched. Checking controller.signal.aborted directly asks "did my own
    // timeout fire" instead of relying on a platform's fetch error shape.
    if (controller.signal.aborted) {
      throw timeoutError();
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const body = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || body.error) {
    const {
      code = "UNKNOWN_ERROR",
      message = "Something went wrong.",
      conflict = null,
      assignedMemberCount = null,
      ownedGroupCount = null,
      ownedEventCount = null,
    } = body.error ?? {};
    throw new ApiError(code, message, response.status, conflict, assignedMemberCount, ownedGroupCount, ownedEventCount);
  }

  return body.data as T;
}
