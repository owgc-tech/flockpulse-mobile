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
  // FP-218: absent when the setup was restored after a reload (the QR image
  // is not stored; the manual key is).
  qrCode?: string;
  secret: string;
  uri: string;
  restored?: boolean;
}
