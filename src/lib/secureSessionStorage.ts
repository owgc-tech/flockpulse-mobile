// FP-255: Supabase auth storage backed by SecureStore (iOS Keychain / Android
// Keystore) instead of plain AsyncStorage, with a one-way move of any existing
// AsyncStorage session so nobody is logged out by the update.
//
// Design notes
// - Chunking: SecureStore has no enforced limit in SDK 57, but "some iOS
//   releases refused values above roughly 2048 bytes" and a Supabase session
//   JSON is usually larger. Values are split into pieces of at most
//   CHUNK_BYTES UTF-8 bytes (never splitting a code point) and stored as
//   `<key>.0 … <key>.(n-1)` plus the count `<key>.n`, written last.
// - Keys: SecureStore keys may only contain letters, digits, ".", "-" and "_".
//   The default Supabase key (`sb-<ref>-auth-token`) already qualifies; any
//   other character is mapped to "_" for the SecureStore copy only. The
//   AsyncStorage copy always uses the original key.
// - keychainAccessible: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY. The default
//   (WHEN_UNLOCKED) would make a token refresh fail while the phone is locked
//   (backgrounded app); AFTER_FIRST_UNLOCK lets it read after the first unlock
//   since boot. THIS_DEVICE_ONLY additionally keeps the tokens out of backups
//   restored onto another device (that device simply asks for a login). iOS
//   only; Android ignores the option.
// - Failure policy: this must never throw out of getItem at startup and must
//   never silently drop a session. If SecureStore is unavailable or throws, the
//   call falls back to AsyncStorage. Nothing here logs or prints values.
//
// The logic is dependency-injected (no React Native imports at module load) so
// scripts/test-fp255-secure-session.ts can run it under tsx with in-memory
// mocks; the real native modules are required lazily on first use.

export const CHUNK_BYTES = 1800;

export interface SecureLike {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface LegacyLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// --- pure helpers (exported for tests) -------------------------------------

export function mapSecureKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, "_");
}

function utf8Length(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

// Splits on code-point boundaries so every chunk is at most maxBytes of UTF-8
// and joining the chunks gives back the exact original string. "" -> [].
export function splitChunks(value: string, maxBytes: number = CHUNK_BYTES): string[] {
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const ch of value) {
    const bytes = utf8Length(ch.codePointAt(0) as number);
    if (currentBytes + bytes > maxBytes && current !== "") {
      chunks.push(current);
      current = "";
      currentBytes = 0;
    }
    current += ch;
    currentBytes += bytes;
  }
  if (current !== "") chunks.push(current);
  return chunks;
}

export function joinChunks(chunks: string[]): string {
  return chunks.join("");
}

// The three keys supabase-js uses for one storage key: the session, the user
// (only when userStorage is set; harmless otherwise) and the PKCE verifier.
export function sessionKeyFamily(baseKey: string): string[] {
  return [baseKey, `${baseKey}-user`, `${baseKey}-code-verifier`];
}

// supabase-js's default storage key for a project URL.
export function defaultSessionKey(supabaseUrl: string): string | null {
  try {
    const host = new URL(supabaseUrl).hostname;
    return `sb-${host.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }
}

// --- adapter ----------------------------------------------------------------

export interface SecureSessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export function createSessionStorage(secure: SecureLike, legacy: LegacyLike): SecureSessionStorage {
  const countKey = (key: string) => `${mapSecureKey(key)}.n`;
  const chunkKey = (key: string, i: number) => `${mapSecureKey(key)}.${i}`;

  async function readCount(key: string): Promise<number | null> {
    const raw = await secure.getItemAsync(countKey(key));
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : -1; // -1 = corrupt count
  }

  // Deletes every chunk it can find plus the count. Each delete is
  // independent so one failure does not leave the rest behind.
  async function deleteSecure(key: string, knownCount?: number | null): Promise<void> {
    let count = knownCount;
    if (count === undefined) {
      try {
        count = await readCount(key);
      } catch {
        count = null;
      }
    }
    const upTo = count !== null && count !== undefined && count > 0 ? count : 0;
    for (let i = 0; i < upTo; i++) {
      try {
        await secure.deleteItemAsync(chunkKey(key, i));
      } catch {
        // continue
      }
    }
    try {
      await secure.deleteItemAsync(countKey(key));
    } catch {
      // continue
    }
  }

  // Writes the chunks first and the count last, then removes leftovers from a
  // longer previous value. Throws if SecureStore fails.
  async function writeSecure(key: string, value: string): Promise<void> {
    let previousCount: number | null = null;
    try {
      const c = await readCount(key);
      previousCount = c !== null && c > 0 ? c : null;
    } catch {
      previousCount = null;
    }

    const chunks = splitChunks(value);
    for (let i = 0; i < chunks.length; i++) {
      await secure.setItemAsync(chunkKey(key, i), chunks[i]);
    }
    await secure.setItemAsync(countKey(key), String(chunks.length));

    if (previousCount !== null) {
      for (let i = chunks.length; i < previousCount; i++) {
        try {
          await secure.deleteItemAsync(chunkKey(key, i));
        } catch {
          // a stray unused chunk is ignored by readers (they stop at the count)
        }
      }
    }
  }

  async function readLegacy(key: string): Promise<string | null> {
    try {
      return await legacy.getItem(key);
    } catch {
      return null;
    }
  }

  return {
    async getItem(key) {
      try {
        let count: number | null;
        try {
          count = await readCount(key);
        } catch {
          // SecureStore unavailable: serve whatever AsyncStorage has, no migration
          return await readLegacy(key);
        }

        if (count !== null) {
          if (count < 0) {
            await deleteSecure(key, null); // corrupt count: clean up, fall through
          } else {
            const parts: string[] = [];
            let complete = true;
            for (let i = 0; i < count; i++) {
              const part = await secure.getItemAsync(chunkKey(key, i));
              if (part === null) {
                complete = false;
                break;
              }
              parts.push(part);
            }
            if (complete && count > 0) return joinChunks(parts);
            // missing chunk (or a zero count): treat as no session, clean up
            await deleteSecure(key, count);
          }
        }

        // Nothing usable in SecureStore: one-time move from AsyncStorage.
        const old = await readLegacy(key);
        if (old === null) return null;
        try {
          await writeSecure(key, old);
        } catch {
          return old; // SecureStore write failed: keep the AsyncStorage copy
        }
        try {
          await legacy.removeItem(key); // only after the secure write succeeded
        } catch {
          // a leftover copy is removed on the next setItem/removeItem
        }
        return old;
      } catch {
        return null; // never throw out of getItem at startup
      }
    },

    async setItem(key, value) {
      try {
        await writeSecure(key, value);
      } catch {
        // SecureStore failed: keep the session in AsyncStorage rather than lose
        // it, and drop any older secure copy so getItem can't serve a stale one.
        await legacy.setItem(key, value);
        await deleteSecure(key);
        return;
      }
      try {
        await legacy.removeItem(key);
      } catch {
        // ignore: the secure copy is authoritative
      }
    },

    async removeItem(key) {
      await deleteSecure(key);
      try {
        await legacy.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}

// --- real wiring (native modules required lazily) ---------------------------

function realSecure(): SecureLike {
  const SecureStore = require("expo-secure-store") as typeof import("expo-secure-store");
  const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
  return {
    getItemAsync: (key) => SecureStore.getItemAsync(key, options),
    setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, options),
    deleteItemAsync: (key) => SecureStore.deleteItemAsync(key, options),
  };
}

function realLegacy(): LegacyLike {
  return require("@react-native-async-storage/async-storage").default as LegacyLike;
}

let instance: SecureSessionStorage | null = null;
function real(): SecureSessionStorage {
  if (!instance) {
    let secure: SecureLike;
    try {
      secure = realSecure();
    } catch {
      // SecureStore native module unavailable: every secure call throws, so
      // the adapter serves AsyncStorage instead of crashing the app at startup
      const unavailable = async (): Promise<never> => {
        throw new Error("SecureStore unavailable");
      };
      secure = { getItemAsync: unavailable, setItemAsync: unavailable, deleteItemAsync: unavailable };
    }
    instance = createSessionStorage(secure, realLegacy());
  }
  return instance;
}

export const secureSessionStorage: SecureSessionStorage = {
  getItem: async (key) => real().getItem(key),
  setItem: async (key, value) => real().setItem(key, value),
  removeItem: async (key) => real().removeItem(key),
};
