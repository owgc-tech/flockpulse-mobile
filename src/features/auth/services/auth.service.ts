import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/src/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { defaultSessionKey, secureSessionStorage, sessionKeyFamily } from "@/src/lib/secureSessionStorage";
import type { Factor } from "@supabase/supabase-js";
import type { AuthenticatorAssuranceStatus, TotpEnrollment } from "@/src/features/auth/types";
import { clearPendingEnrollment } from "@/src/features/auth/services/pendingEnrollment";

// FP-218: pure helper, defined next to the enrolment flow so scripts can test
// it without loading the Supabase client.
export { selectUnverifiedTotp } from "@/src/features/auth/services/mfaEnrollFlow";

// FP-218: dropping the pending two-step setup on sign-out must never throw or
// block signing out.
async function clearPendingSafely(): Promise<void> {
  try {
    await clearPendingEnrollment();
  } catch {
    // never block sign-out
  }
}

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

// FP-258-adj-1: re-checks a password WITHOUT touching the signed-in session.
// signInWithPassword() above runs on the shared client, so calling it while
// already signed in replaces the current aal2 session with a brand-new aal1
// one — the (app) gate then sees aal1 with nextLevel aal2 and redirects to
// the two-step screen, unmounting whatever screen asked for the re-check
// (Delete My Account lost its 409 reasons that way). This uses a throwaway
// client instead: nothing persisted, no auto-refresh, its own storage key and
// no AsyncStorage, so the shared client and its stored session are never read
// or written. The throwaway session is ended with scope "local" on THAT
// client only — the default scope is "global", which would revoke the
// person's sessions on every device. Same error as login on any failure.
export async function verifyPassword(email: string, password: string): Promise<void> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(GENERIC_LOGIN_ERROR);
  }

  const checker = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "fp-password-check",
    },
  });

  const { error } = await checker.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(GENERIC_LOGIN_ERROR);
  }

  try {
    await checker.auth.signOut({ scope: "local" });
  } catch {
    // best effort: the throwaway session lives only in this client's memory
    // and the client is discarded either way
  }
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
// enrolling fresh (see mfaEnrollFlow.ts).
//
// FP-218: this used to return `data.totp`, and the old comment claimed that
// was "every status". It is not: the installed @supabase/auth-js (2.119.0,
// GoTrueClient._listFactors) puts every factor in `data.all` but only pushes
// a factor into `data.totp` when its status is "verified". So the cleanup
// never found (or removed) an unverified leftover. `data.all` is the complete
// list.
export async function listAllTotpFactors(): Promise<Factor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data.all.filter((factor) => factor.factor_type === "totp");
}

export async function unenrollFactor(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

export async function enrollTotpFactor(): Promise<TotpEnrollment> {
  // FP-218: a unique friendly name per attempt. Without one every attempt had
  // the same empty name, so a leftover factor made the next enroll() fail with
  // `A factor with the friendly name "" for this user already exists`.
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `FlockPulse ${new Date().toISOString()}`,
  });
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
  await clearPendingSafely();
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
  await clearPendingSafely();
  try {
    const { error } = await supabase.auth.signOut();
    if (!error) return;
  } catch {
    // fall through to the forced wipe
  }

  // FP-255: the session now lives in SecureStore (chunked), with AsyncStorage
  // only as a legacy/fallback copy, so the forced wipe has to reach both.
  // SecureStore can't be enumerated, so its keys come from the AsyncStorage
  // matches plus the client's default key for this project's URL.
  let sessionKeys: string[] = [];
  try {
    const keys = await AsyncStorage.getAllKeys();
    sessionKeys = keys.filter((key) => /^sb-.+-auth-token(-user|-code-verifier)?$/.test(key));
    await AsyncStorage.multiRemove(sessionKeys);
  } catch {
    // nothing more can be done locally; the second signOut below still tries
  }

  try {
    const base = defaultSessionKey(process.env.EXPO_PUBLIC_SUPABASE_URL ?? "");
    const all = new Set([...sessionKeys, ...(base ? sessionKeyFamily(base) : [])]);
    for (const key of all) {
      await secureSessionStorage.removeItem(key);
    }
  } catch {
    // removeItem never throws on its own; this only guards the wiring
  }

  try {
    await supabase.auth.signOut();
  } catch {
    // swallowed on purpose — callers must never be blocked by sign-out failure
  }
}
