// Matches supabase-js's AuthenticatorAssuranceLevels, which is intentionally
// widened to (string & {}) to stay forward-compatible with future levels.
export type AssuranceLevel = "aal1" | "aal2" | (string & {}) | null;

export interface AuthenticatorAssuranceStatus {
  currentLevel: AssuranceLevel;
  nextLevel: AssuranceLevel;
}

export interface EnrolledTotpFactor {
  id: string;
  friendlyName?: string | null;
}

export interface TotpEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
}
