import { apiFetch } from "@/src/lib/api";

// Matches flockpulse-web's MemberUnavailabilityRangeRow (GET/POST/DELETE
// /api/members/me/unavailability[/:id]) exactly — confirmed live against
// member_unavailability.repository.ts's COLS select list.
export interface UnavailabilityRange {
  id: string;
  member_id: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

// FP-190-mobile: no target-id parameter on any of these three — memberId is
// derived entirely from the caller's own JWT server-side, matching FP-187's
// self-service pattern (structurally incapable of acting on anyone but the
// caller).
export async function listMyUnavailability(): Promise<UnavailabilityRange[]> {
  return apiFetch<UnavailabilityRange[]>("/api/members/me/unavailability");
}

// startDate/endDate are "YYYY-MM-DD" strings (camelCase on the wire,
// confirmed live against the route handler's body.startDate/body.endDate
// destructure). Server validates end >= start and rejects malformed dates
// with a 422 VALIDATION_ERROR — surfaced via ApiError.message as-is,
// no separate client-side validation duplicated here.
export async function addUnavailabilityRange(startDate: string, endDate: string): Promise<UnavailabilityRange> {
  return apiFetch<UnavailabilityRange>("/api/members/me/unavailability", {
    method: "POST",
    body: JSON.stringify({ startDate, endDate }),
  });
}

// FP-190-mobile-adj-1: real atomic update (PATCH), not delete-then-recreate
// — confirmed live against the route handler, same self-only scoping and
// body/error shape as POST above.
export async function updateUnavailabilityRange(
  id: string,
  startDate: string,
  endDate: string
): Promise<UnavailabilityRange> {
  return apiFetch<UnavailabilityRange>(`/api/members/me/unavailability/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ startDate, endDate }),
  });
}

export async function deleteUnavailabilityRange(id: string): Promise<void> {
  await apiFetch<{ id: string }>(`/api/members/me/unavailability/${id}`, { method: "DELETE" });
}
