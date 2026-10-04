import { isAuthApiError, isAuthSessionMissingError } from "@supabase/supabase-js";
import { supabase } from "@/src/lib/supabase";
import { forceLocalSignOut } from "@/src/features/auth/services/auth.service";
import { setSessionExpiredNotice } from "@/src/features/auth/sessionExpiredNotice";

// FP-230. Same bound as api.ts's REQUEST_TIMEOUT_MS / withTimeout (not
// imported: api.ts imports this file, and a require cycle is not worth it for
// one constant). refreshSession() takes no AbortSignal, so Promise.race
// against a timer is the only way to bound it.
const REFRESH_TIMEOUT_MS = 15000;

export type RecoveryOutcome = "refreshed" | "dead" | "unknown";

// Definitive auth rejections (refresh_token_not_found, refresh_token_already_used,
// session_not_found, user_not_found, ...). 5xx and AuthRetryableFetchError
// (network failure, which auth-js reports with status 0 or 5xx) are NOT here
// and fall through to "unknown", which never signs anyone out.
const DEAD_STATUSES = new Set([400, 401, 403, 404, 422]);

let recovering: Promise<RecoveryOutcome> | null = null;
let expiring: Promise<void> | null = null;

// Cleared on the next sign-in so a fresh session isn't treated as already
// expired. onAuthStateChange here (rather than in useSession) keeps this module
// self-contained; the subscription lives for the app's lifetime.
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_IN") {
    expiring = null;
  }
});

async function runRefresh(): Promise<RecoveryOutcome> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timeoutId = setTimeout(() => resolve("timeout"), REFRESH_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([supabase.auth.refreshSession(), timeout]);
    if (result === "timeout") return "unknown";

    const { data, error } = result;
    if (error) {
      if (isAuthSessionMissingError(error)) return "dead";
      if (isAuthApiError(error) && DEAD_STATUSES.has(error.status)) return "dead";
      return "unknown";
    }
    return data.session ? "refreshed" : "unknown";
  } catch {
    return "unknown";
  } finally {
    clearTimeout(timeoutId);
  }
}

// Single-flight: every tab's apiFetch can 401 at once, and refresh tokens
// rotate, so parallel refreshes could invalidate each other. All concurrent
// callers share one refresh.
export function recoverSession(): Promise<RecoveryOutcome> {
  if (!recovering) {
    recovering = runRefresh().finally(() => {
      recovering = null;
    });
  }
  return recovering;
}

export function isSessionExpiring(): boolean {
  return expiring !== null;
}

// Single-flight and idempotent: the notice is set once and the sign-out runs
// once no matter how many requests give up at the same time. Stays "expiring"
// after it settles (until the next SIGNED_IN) so late in-flight 401s don't
// start another refresh or sign-out.
export function expireSession(): Promise<void> {
  if (!expiring) {
    setSessionExpiredNotice();
    expiring = forceLocalSignOut();
  }
  return expiring;
}
