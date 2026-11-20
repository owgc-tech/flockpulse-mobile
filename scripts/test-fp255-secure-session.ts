/**
 * FP-255 (mobile) — secure session storage: standalone checks
 *
 * No test runner exists in this repo, so this is a plain script (run with
 * `npx tsx scripts/test-fp255-secure-session.ts`). It runs the real adapter
 * logic from src/lib/secureSessionStorage.ts against in-memory mocks of
 * SecureStore and AsyncStorage (the native modules cannot load under tsx).
 */
declare const require: (id: string) => any;
declare const process: { exit(code: number): never };
const fs = require("fs");
const {
  CHUNK_BYTES,
  mapSecureKey,
  splitChunks,
  joinChunks,
  sessionKeyFamily,
  defaultSessionKey,
  createSessionStorage,
} = require("../src/lib/secureSessionStorage");

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

// --- mocks -------------------------------------------------------------------
function makeEnv() {
  const secureMap = new Map<string, string>();
  const asyncMap = new Map<string, string>();
  const flags = { secureReadThrows: false, secureWriteThrows: false, secureDeleteThrows: false };
  const secure = {
    async getItemAsync(k: string) {
      if (flags.secureReadThrows) throw new Error("secure read failed");
      return secureMap.has(k) ? (secureMap.get(k) as string) : null;
    },
    async setItemAsync(k: string, v: string) {
      if (flags.secureWriteThrows) throw new Error("secure write failed");
      if (!/^[A-Za-z0-9._-]+$/.test(k)) throw new Error(`invalid SecureStore key: ${k}`);
      secureMap.set(k, v);
    },
    async deleteItemAsync(k: string) {
      if (flags.secureDeleteThrows) throw new Error("secure delete failed");
      secureMap.delete(k);
    },
  };
  const legacy = {
    async getItem(k: string) {
      return asyncMap.has(k) ? (asyncMap.get(k) as string) : null;
    },
    async setItem(k: string, v: string) {
      asyncMap.set(k, v);
    },
    async removeItem(k: string) {
      asyncMap.delete(k);
    },
  };
  return { secureMap, asyncMap, flags, store: createSessionStorage(secure, legacy) };
}

const KEY = "sb-abcdefgh-auth-token";
const make = (n: number) => Array.from({ length: n }, (_, i) => String.fromCharCode(97 + (i % 26))).join("");

async function main() {
  // --- pure helpers ----------------------------------------------------------
  check("chunk size is 1800", CHUNK_BYTES === 1800);
  for (const n of [0, 1, 1800, 1801, 10000]) {
    const v = make(n);
    const parts = splitChunks(v);
    const expectedParts = n === 0 ? 0 : Math.ceil(n / 1800);
    check(
      `split/join round-trip, ${n} chars (${parts.length} chunks)`,
      joinChunks(parts) === v && parts.length === expectedParts && parts.every((p: string) => p.length <= 1800)
    );
  }
  const unicode = "é€😀".repeat(900); // multi-byte: 2 + 3 + 4 bytes per repeat
  const uParts = splitChunks(unicode);
  const byteLen = (s: string) => new TextEncoder().encode(s).length;
  check(
    "multi-byte value: round-trips and no chunk exceeds 1800 UTF-8 bytes",
    joinChunks(uParts) === unicode && uParts.every((p: string) => byteLen(p) <= 1800)
  );
  check("key mapping keeps valid keys and maps invalid characters", mapSecureKey(KEY) === KEY && mapSecureKey("a:b/c d") === "a_b_c_d");
  check("session key family", JSON.stringify(sessionKeyFamily(KEY)) === JSON.stringify([KEY, `${KEY}-user`, `${KEY}-code-verifier`]));
  check("default key from URL", defaultSessionKey("https://abcdefgh.supabase.co") === KEY && defaultSessionKey("not a url") === null);

  // --- set/get round-trip ----------------------------------------------------
  {
    const e = makeEnv();
    const value = make(5000);
    await e.store.setItem(KEY, value);
    check("setItem/getItem round-trip across chunks", (await e.store.getItem(KEY)) === value);
    check("stored as 3 chunks + count", e.secureMap.get(`${KEY}.n`) === "3" && e.secureMap.has(`${KEY}.0`) && e.secureMap.has(`${KEY}.2`));
    check("every stored SecureStore key is valid", [...e.secureMap.keys()].every((k) => /^[A-Za-z0-9._-]+$/.test(k)));
  }

  // --- migration -------------------------------------------------------------
  {
    const e = makeEnv();
    const session = make(4200);
    e.asyncMap.set(KEY, session);
    const first = await e.store.getItem(KEY);
    check("migration: value only in AsyncStorage is returned", first === session);
    check("migration: copied to SecureStore", (await e.store.getItem(KEY)) === session && e.secureMap.get(`${KEY}.n`) === "3");
    check("migration: removed from AsyncStorage", !e.asyncMap.has(KEY));
    // second read must come from SecureStore only
    e.asyncMap.set(KEY, "SHOULD-NOT-BE-READ");
    check("migration: second getItem reads SecureStore only", (await e.store.getItem(KEY)) === session);
  }
  {
    const e = makeEnv();
    const session = make(3000);
    e.asyncMap.set(KEY, session);
    e.flags.secureWriteThrows = true;
    const got = await e.store.getItem(KEY);
    check("migration with failing SecureStore write: value still returned", got === session);
    check("migration with failing SecureStore write: AsyncStorage copy is KEPT", e.asyncMap.get(KEY) === session);
  }
  check("nothing anywhere -> null", (await makeEnv().store.getItem(KEY)) === null);

  // --- setItem shorter value deletes leftovers ---------------------------------
  {
    const e = makeEnv();
    await e.store.setItem(KEY, make(6000)); // 4 chunks
    await e.store.setItem(KEY, make(100)); // 1 chunk
    const keys = [...e.secureMap.keys()].sort();
    check("shorter setItem deletes leftover chunks", JSON.stringify(keys) === JSON.stringify([`${KEY}.0`, `${KEY}.n`].sort()), `keys: ${JSON.stringify(keys)}`);
    check("shorter value reads back", (await e.store.getItem(KEY)) === make(100));
  }
  {
    const e = makeEnv();
    e.asyncMap.set(KEY, "old-legacy");
    await e.store.setItem(KEY, "new-value");
    check("setItem removes the AsyncStorage copy", !e.asyncMap.has(KEY) && (await e.store.getItem(KEY)) === "new-value");
  }

  // --- removeItem --------------------------------------------------------------
  {
    const e = makeEnv();
    await e.store.setItem(KEY, make(5000));
    e.asyncMap.set(KEY, "legacy-copy");
    await e.store.removeItem(KEY);
    check("removeItem deletes every chunk and the count", e.secureMap.size === 0);
    check("removeItem deletes the AsyncStorage copy", !e.asyncMap.has(KEY));
    check("after removeItem getItem is null", (await e.store.getItem(KEY)) === null);
  }

  // --- missing middle chunk ------------------------------------------------------
  {
    const e = makeEnv();
    await e.store.setItem(KEY, make(5000)); // 3 chunks
    e.secureMap.delete(`${KEY}.1`);
    check("missing middle chunk -> null", (await e.store.getItem(KEY)) === null);
    check("missing middle chunk -> partial chunks cleaned up", e.secureMap.size === 0, `left: ${JSON.stringify([...e.secureMap.keys()])}`);
  }
  {
    const e = makeEnv();
    e.secureMap.set(`${KEY}.n`, "garbage");
    check("corrupt count -> null and cleaned up", (await e.store.getItem(KEY)) === null && e.secureMap.size === 0);
  }

  // --- SecureStore throws ------------------------------------------------------------
  {
    const e = makeEnv();
    e.asyncMap.set(KEY, "fallback-session");
    e.flags.secureReadThrows = true;
    let threw = false;
    let got: string | null = null;
    try {
      got = await e.store.getItem(KEY);
    } catch {
      threw = true;
    }
    check("SecureStore read throws: getItem does not throw", !threw);
    check("SecureStore read throws: falls back to AsyncStorage (not migrated, not removed)", got === "fallback-session" && e.asyncMap.get(KEY) === "fallback-session");
  }
  {
    const e = makeEnv();
    await e.store.setItem(KEY, make(100));
    e.flags.secureWriteThrows = true;
    await e.store.setItem(KEY, "newer-session");
    check("SecureStore write throws: setItem falls back to AsyncStorage", e.asyncMap.get(KEY) === "newer-session");
    e.flags.secureWriteThrows = false;
    check("stale secure copy is dropped so the newer session is served", (await e.store.getItem(KEY)) === "newer-session");
  }

  // --- forceLocalSignOut wipe reaches SecureStore --------------------------------------
  {
    const e = makeEnv();
    for (const k of sessionKeyFamily(KEY)) await e.store.setItem(k, make(4000));
    for (const k of sessionKeyFamily(KEY)) await e.store.removeItem(k); // what the wipe does per key
    check("wipe via removeItem over the key family empties SecureStore (incl. chunks)", e.secureMap.size === 0);
  }
  const svc: string = fs.readFileSync("src/features/auth/services/auth.service.ts", "utf8").replace(/\r\n/g, "\n");
  const s = svc.indexOf("export async function forceLocalSignOut");
  const body = s >= 0 ? svc.slice(s) : "";
  check("forceLocalSignOut still wipes AsyncStorage (getAllKeys + multiRemove)", /AsyncStorage\.getAllKeys\(\)/.test(body) && /AsyncStorage\.multiRemove\(/.test(body));
  check("forceLocalSignOut also wipes SecureStore via the adapter's removeItem", /secureSessionStorage\.removeItem\(/.test(body));
  check("forceLocalSignOut covers the default key family for the project URL", /defaultSessionKey\(/.test(body) && /sessionKeyFamily\(/.test(body));

  // --- wiring ---------------------------------------------------------------------------
  const sb: string = fs.readFileSync("src/lib/supabase.ts", "utf8");
  check("supabase.ts uses secureSessionStorage", /storage:\s*secureSessionStorage/.test(sb));
  check("supabase.ts no longer uses AsyncStorage", !/AsyncStorage/.test(sb));
  check("verifyPassword's throwaway client is unchanged (no storage option)", !/storage:/.test(svc.slice(svc.indexOf("export async function verifyPassword"), svc.indexOf("export async function getAssuranceLevel"))));

  console.log(`\n${passed}/${passed + failed} checks passed`);
  if (failed > 0) process.exit(1);
}

main();
