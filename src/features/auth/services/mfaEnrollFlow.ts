// FP-218: the two-step setup start-up logic, kept free of React and Supabase
// imports (everything is injected) so scripts/test-fp218-mfa-enroll.ts can run
// it with mocks. The screen only wires real dependencies into it.
//
// What it guarantees:
// - leftover UNVERIFIED factors are really removed (listAllTotp must return
//   every status; see auth.service.listAllTotpFactors),
// - a reload / return from the authenticator app shows the SAME key (the
//   pending setup is remembered in SecureStore),
// - two copies of the screen starting at once share ONE run (single flight),
// - the in-flight reference is cleared when a run settles, so a retry works.

import { decidePending, type PendingEnrollment, type PendingStore } from "./pendingEnrollment";

export interface FactorLike {
  id: string;
  factor_type: string;
  status: string;
}

// Only unfinished authenticator-app (TOTP) factors are ever cleaned up.
export function selectUnverifiedTotp<T extends FactorLike>(all: T[]): T[] {
  return all.filter((factor) => factor.factor_type === "totp" && factor.status === "unverified");
}

export interface EnrollmentResult {
  factorId: string;
  // Absent when the setup was restored after a reload (the QR is not stored).
  qrCode?: string;
  secret: string;
  uri: string;
  restored?: boolean;
}

export interface EnrollFlowDeps {
  getUserId: () => Promise<string | null>;
  // Every TOTP factor of any status (auth.service.listAllTotpFactors).
  listAllTotp: () => Promise<FactorLike[]>;
  unenroll: (factorId: string) => Promise<void>;
  enroll: () => Promise<{ factorId: string; qrCode?: string; secret: string; uri: string }>;
  pending: PendingStore;
}

// Removing a stale factor is best effort: every attempt now has a unique
// friendly name, so a factor that could not be removed cannot block the next
// enroll(), and one failed delete must not stop the member from setting up.
async function removeFactors(deps: EnrollFlowDeps, factors: FactorLike[]): Promise<void> {
  for (const factor of factors) {
    try {
      await deps.unenroll(factor.id);
    } catch {
      // continue with the rest
    }
  }
}

async function enrollFresh(deps: EnrollFlowDeps, userId: string): Promise<EnrollmentResult> {
  const created = await deps.enroll();
  const pending: PendingEnrollment = {
    userId,
    factorId: created.factorId,
    secret: created.secret,
    uri: created.uri,
  };
  await deps.pending.save(pending);
  return {
    factorId: created.factorId,
    qrCode: created.qrCode,
    secret: created.secret,
    uri: created.uri,
  };
}

async function run(deps: EnrollFlowDeps, fresh: boolean): Promise<EnrollmentResult> {
  const userId = await deps.getUserId();
  if (!userId) throw new Error("No signed-in user.");

  const unverified = selectUnverifiedTotp(await deps.listAllTotp());

  if (!fresh) {
    const stored = await deps.pending.read();
    const decision = decidePending({ stored, userId, factors: unverified });
    if (decision.action === "reuse") {
      await removeFactors(
        deps,
        unverified.filter((factor) => factor.id !== decision.pending.factorId),
      );
      return {
        factorId: decision.pending.factorId,
        secret: decision.pending.secret,
        uri: decision.pending.uri,
        restored: true,
      };
    }
  }

  await removeFactors(deps, unverified);
  await deps.pending.clear();
  return enrollFresh(deps, userId);
}

// Module-level single flight: concurrent callers share one run.
let inFlight: Promise<EnrollmentResult> | null = null;

function track(promise: Promise<EnrollmentResult>): Promise<EnrollmentResult> {
  const tracked = promise.finally(() => {
    if (inFlight === tracked) inFlight = null;
  });
  inFlight = tracked;
  return tracked;
}

export function startEnrollment(deps: EnrollFlowDeps): Promise<EnrollmentResult> {
  if (inFlight) return inFlight;
  return track(run(deps, false));
}

// "Start over with a new key": drops the pending setup and its unverified
// factor(s), then runs a fresh enrolment (new key and QR).
export async function startOverEnrollment(deps: EnrollFlowDeps): Promise<EnrollmentResult> {
  if (inFlight) {
    try {
      await inFlight;
    } catch {
      // the earlier run's failure is not this call's problem
    }
  }
  return track(run(deps, true));
}
