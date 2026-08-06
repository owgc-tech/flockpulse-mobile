export type Gender = "MALE" | "FEMALE";

// Full FP-105-widened set, confirmed against the actual DB constraint in
// updateMyProfile()'s validation — not the stale web form's smaller list.
export type MaritalStatus = "SINGLE" | "MARRIED" | "WIDOWED" | "DIVORCED" | "SEPARATED";

export interface MemberGroup {
  id: string;
  name: string;
}

// Matches flockpulse-web's getMyProfile() response (GET /api/members/me)
// exactly — confirmed live against the service function.
export interface MyProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  gender: Gender | null;
  marital_status: MaritalStatus | null;
  birthdate: string | null;
  // DIP-FP-192-mobile: confirmed live against getMyProfile() — role and
  // role_catalog_entry_id are the raw selected columns, role_display_name
  // is resolved server-side from them (FP-192-web's role catalog). None of
  // the three are returned by updateMyProfile()'s PATCH response — see
  // UpdatedProfile below.
  role: string;
  role_catalog_entry_id: string | null;
  role_display_name: string;
  groups: MemberGroup[];
}

// PATCH /api/members/me's success response — same base fields as MyProfile
// but does NOT include `groups` (not selected server-side on the update
// query) or role/role_catalog_entry_id/role_display_name (confirmed live —
// updateMyProfile()'s .select() only has the five profile-edit fields).
// Kept as its own type so callers can't assume group or role data survives
// an update response.
export type UpdatedProfile = Omit<MyProfile, "groups" | "role" | "role_catalog_entry_id" | "role_display_name">;

// Confirmed live: this request body is camelCase (firstName/lastName/
// maritalStatus), unlike every other endpoint in this app which uses
// snake_case on the wire — not a typo on this side, matched exactly as
// updateMyProfile()'s route handler destructures it.
export interface UpdateMyProfileInput {
  firstName?: string;
  lastName?: string;
  gender?: Gender;
  maritalStatus?: MaritalStatus;
  birthdate?: string;
}
