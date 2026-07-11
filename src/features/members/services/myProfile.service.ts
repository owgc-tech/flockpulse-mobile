import { apiFetch } from "@/src/lib/api";
import type { MyProfile, UpdatedProfile, UpdateMyProfileInput } from "@/src/features/members/types";

// Cached per session, same pattern as the old fetchAttendanceWindowHours()
// — profile data doesn't change from outside this app's own edit flow.
let cachedProfile: MyProfile | null = null;

export async function fetchMyProfile(): Promise<MyProfile> {
  if (cachedProfile) {
    return cachedProfile;
  }
  cachedProfile = await apiFetch<MyProfile>("/api/members/me");
  return cachedProfile;
}

// Callers can branch on err.code (NOT_FOUND_IN_TENANT / INVALID_VALUE /
// INVALID_BODY) via ApiError — see src/lib/api.ts.
export async function updateMyProfile(patch: UpdateMyProfileInput): Promise<UpdatedProfile> {
  const updated = await apiFetch<UpdatedProfile>("/api/members/me", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  // PATCH's response doesn't include `groups` — merge over the existing
  // cache rather than replacing it outright, so a subsequent read still has
  // group data without needing a fresh GET.
  if (cachedProfile) {
    cachedProfile = { ...cachedProfile, ...updated };
  }
  return updated;
}
