import AsyncStorage from "@react-native-async-storage/async-storage";
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

// FP-230: unlike signOut() above this never throws and guarantees the local
// session is gone. Confirmed in the installed @supabase/auth-js (2.110.8,
// GoTrueClient._signOut): when the server-side logout call fails for any
// reason other than 401/403/404, it removes the local session and *then*
// returns the error — but when its up-front session read fails (e.g. the
// stored access token is expired and the refresh it triggers hits a network
// error) it returns the error WITHOUT removing anything. That second case is
// exactly the dead-session-plus-flaky-network one, so on any error or throw
// the persisted session is wiped directly and signOut() is called again:
// with nothing stored it makes no server call and just removes the (empty)
// session and emits SIGNED_OUT, which is what sends the gate to login and
// lets useSession clear the trusted-device flag.
export async function forceLocalSignOut(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut();
    if (!error) return;
  } catch {
    // fall through to the forced wipe
  }

  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(
      keys.filter((key) => /^sb-.+-auth-token(-user|-code-verifier)?$/.test(key))
    );
  } catch {
    // nothing more can be done locally; the second signOut below still tries
  }

  try {
    await supabase.auth.signOut();
  } catch {
    // swallowed on purpose — callers must never be blocked by sign-out failure
  }
}
