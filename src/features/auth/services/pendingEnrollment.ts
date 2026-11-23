// FP-218: remembers an unfinished two-step (TOTP) setup so that leaving the
// app to copy the key into an authenticator, and coming back to a reloaded
// screen, shows the SAME key instead of creating a new one.
//
// Secrets: the pending TOTP secret lives only in SecureStore (iOS Keychain /
// Android Keystore). It is never logged, printed or put in an error message.
// The QR image is deliberately NOT stored (it is a ~3 KB SVG); the manual key
// and the otpauth uri are enough.
//
// Pattern follows src/lib/secureSessionStorage.ts: a dependency-injected
// SecureLike so a tsx script can run it with an in-memory mock, a lazy
// `require` of the native module, and nothing here throws.

import type { SecureLike } from "../../../lib/secureSessionStorage";

// SecureStore keys may only contain letters, digits, ".", "-" and "_".
export const PENDING_KEY = "flockpulse.mfa.pending";

export interface PendingEnrollment {
  userId: string;
  factorId: string;
  secret: string;
  uri: string;
}

export interface PendingStore {
  save(pending: PendingEnrollment): Promise<void>;
  read(): Promise<PendingEnrollment | null>;
  clear(): Promise<void>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

// Never throws: any missing, malformed or failed read is "nothing stored".
function parsePending(raw: string | null): PendingEnrollment | null {
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingEnrollment> | null;
    if (
      value &&
      isNonEmptyString(value.userId) &&
      isNonEmptyString(value.factorId) &&
      isNonEmptyString(value.secret) &&
      isNonEmptyString(value.uri)
    ) {
      return { userId: value.userId, factorId: value.factorId, secret: value.secret, uri: value.uri };
    }
    return null;
  } catch {
    return null;
  }
}

export function createPendingStore(secure: SecureLike): PendingStore {
  return {
    async save(pending) {
      try {
        await secure.setItemAsync(PENDING_KEY, JSON.stringify(pending));
      } catch {
        // Not saving only costs the "same key after a reload" convenience:
        // the next open just cleans up and starts a fresh setup.
      }
    },
    async read() {
      try {
        return parsePending(await secure.getItemAsync(PENDING_KEY));
      } catch {
        return null;
      }
    },
    async clear() {
      try {
        await secure.deleteItemAsync(PENDING_KEY);
      } catch {
        // nothing more can be done; sign-out and verify must never be blocked
      }
    },
  };
}

// What the app does with a stored pending setup after listing the server's
// factors: reuse it only for the same user and only while its factor still
// exists unverified on the server; otherwise throw it away.
export type PendingDecision = { action: "reuse"; pending: PendingEnrollment } | { action: "discard" };

export function decidePending(input: {
  stored: PendingEnrollment | null;
  userId: string;
  factors: { id: string; status: string }[];
}): PendingDecision {
  const { stored, userId, factors } = input;
  if (!stored || stored.userId !== userId) return { action: "discard" };
  const match = factors.find((factor) => factor.id === stored.factorId);
  if (!match || match.status !== "unverified") return { action: "discard" };
  return { action: "reuse", pending: stored };
}

// --- real wiring (native module required lazily) ----------------------------

function realSecure(): SecureLike {
  const SecureStore = require("expo-secure-store") as typeof import("expo-secure-store");
  const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
  return {
    getItemAsync: (key) => SecureStore.getItemAsync(key, options),
    setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, options),
    deleteItemAsync: (key) => SecureStore.deleteItemAsync(key, options),
  };
}

// Built per call so a missing native module is just "unavailable" (no-op /
// null), never a crash.
function realStore(): PendingStore | null {
  try {
    return createPendingStore(realSecure());
  } catch {
    return null;
  }
}

export async function savePendingEnrollment(pending: PendingEnrollment): Promise<void> {
  await realStore()?.save(pending);
}

export async function readPendingEnrollment(): Promise<PendingEnrollment | null> {
  return (await realStore()?.read()) ?? null;
}

export async function clearPendingEnrollment(): Promise<void> {
  await realStore()?.clear();
}

export const realPendingStore: PendingStore = {
  save: savePendingEnrollment,
  read: readPendingEnrollment,
  clear: clearPendingEnrollment,
};
