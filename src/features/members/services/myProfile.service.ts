import { apiFetch } from "@/src/lib/api";
import type { MyProfile, UpdatedProfile, UpdateMyProfileInput } from "@/src/features/members/types";

// No caching — a prior version cached this in a module-level variable that
// was never invalidated (not on refresh, not on sign-out), so a group
// rename made via web Admin never showed up on mobile even after a full
// sign-out/sign-in within the same JS runtime session. Profile is only
// fetched when someone opens the overlay, so always hitting the network is
// cheap; correctness here matters more than saving one infrequent call.
export async function fetchMyProfile(): Promise<MyProfile> {
  return apiFetch<MyProfile>("/api/members/me");
}

// Callers can branch on err.code (NOT_FOUND_IN_TENANT / INVALID_VALUE /
// INVALID_BODY) via ApiError — see src/lib/api.ts.
export async function updateMyProfile(patch: UpdateMyProfileInput): Promise<UpdatedProfile> {
  return apiFetch<UpdatedProfile>("/api/members/me", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

// FP-187-mobile: no target-id parameter — the endpoint derives userId/
// tenantId/memberId entirely from the caller's own JWT, so this is
// structurally incapable of deleting anyone but the signed-in caller.
// Callers can branch on err.code (INVALID_STATE_TRANSITION /
// AUTH_DELETE_FAILED) and err.assignedMemberCount/ownedGroupCount/
// ownedEventCount via ApiError — see src/lib/api.ts.
export async function deleteOwnAccount(): Promise<void> {
  await apiFetch<{ deleted: true }>("/api/members/me", { method: "DELETE" });
}
