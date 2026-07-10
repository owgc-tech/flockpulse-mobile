import { supabase } from "@/src/lib/supabase";
import type { Factor } from "@supabase/supabase-js";
import type { AuthenticatorAssuranceStatus, TotpEnrollment } from "@/src/features/auth/types";

// Supabase's signInWithPassword error does not distinguish between "no such
// email" and "wrong password" — surface its message as-is rather than
// re-mapping it, so we don't accidentally introduce a distinction Supabase
// deliberately avoids (FP-89 AC: don't reveal which field was wrong).
const GENERIC_LOGIN_ERROR = "Incorrect email or password.";

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(GENERIC_LOGIN_ERROR);
  }
  return data;
}

export async function getAssuranceLevel(): Promise<AuthenticatorAssuranceStatus> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return { currentLevel: data.currentLevel, nextLevel: data.nextLevel };
}

export async function hasEnrolledTotpFactor(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data.totp.some((factor) => factor.status === "verified");
}

// Unlike hasEnrolledTotpFactor()/getTotpFactorId() (verified-only), this
// returns every TOTP factor regardless of status — needed to find and clean
// up unverified leftovers from an abandoned enrollment attempt before
// enrolling fresh (see mfa-enroll.tsx).
export async function listAllTotpFactors(): Promise<Factor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data.totp;
}

export async function unenrollFactor(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

export async function enrollTotpFactor(): Promise<TotpEnrollment> {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error) throw error;
  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

export async function verifyTotpEnrollment(factorId: string, code: string) {
  const { data, error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw error;
  return data;
}

export async function verifyTotpChallenge(factorId: string, code: string) {
  const { data, error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw error;
  return data;
}

export async function getTotpFactorId(): Promise<string | null> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  const verified = data.totp.find((factor) => factor.status === "verified");
  return verified?.id ?? null;
}

// FP-93: no mobile-specific reset UI is in scope for this DIP — this wraps
// the same resetPasswordForEmail() flow the web repo already triggers, kept
// here for whichever screen ends up calling it. UNCONFIRMED: the reset
// email's link currently points at a web redirect target; whether it should
// carry a mobile deep link (via the `flockpulse://` scheme configured in
// app.json) instead/also is a product decision outside this DIP's scope,
// flagged rather than assumed.
export async function requestPasswordReset(email: string, redirectTo?: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
