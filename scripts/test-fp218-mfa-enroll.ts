/**
 * FP-218 (mobile) — two-step setup survives leaving the app: standalone checks
 *
 * No test runner exists in this repo, so this is a plain script (run with
 * `npx tsx scripts/test-fp218-mfa-enroll.ts`). It runs the real pure helpers
 * and the real start-up flow with mocked dependencies (an in-memory SecureLike
 * and a fake "server"), and greps the screen, form and service for the wiring.
 * All secrets here are obviously fake.
 *
 * NOT covered here: no device, no Android process death, no real authenticator
 * app, no iOS, no real Supabase server (see the PR for the separate local
 * server experiment).
 */
declare const require: (id: string) => any;
declare const process: { cwd(): string; exit(code: number): never };
const fs = require("fs");
const path = require("path");
const {
  createPendingStore,
  decidePending,
  PENDING_KEY,
} = require("../src/features/auth/services/pendingEnrollment");
const {
  selectUnverifiedTotp,
  startEnrollment,
  startOverEnrollment,
} = require("../src/features/auth/services/mfaEnrollFlow");

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean) {
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}`);
  }
}
const read = (p: string): string => fs.readFileSync(path.join(process.cwd(), p), "utf8");

// --- fakes -------------------------------------------------------------------

function memorySecure() {
  const data = new Map<string, string>();
  return {
    data,
    async getItemAsync(key: string) {
      return data.has(key) ? (data.get(key) as string) : null;
    },
    async setItemAsync(key: string, value: string) {
      data.set(key, value);
    },
    async deleteItemAsync(key: string) {
      data.delete(key);
    },
  };
}

interface FakeFactor {
  id: string;
  factor_type: string;
  status: string;
  friendly_name?: string;
}

// A fake server that behaves like Supabase for what matters here: enrol makes
// an UNVERIFIED factor, a same-name enrol is refused, unenrol removes it.
function fakeServer(initial: FakeFactor[] = [], userId: string | null = "user-1") {
  const factors: FakeFactor[] = [...initial];
  const stats = { enroll: 0, unenroll: 0, unenrolled: [] as string[], names: [] as string[] };
  let counter = 0;
  let enrollGate: Promise<void> | null = null;
  let failNextEnroll = false;
  const deps = {
    getUserId: async () => userId,
    listAllTotp: async () => factors.filter((f) => f.factor_type === "totp").map((f) => ({ ...f })),
    unenroll: async (id: string) => {
      stats.unenroll++;
      stats.unenrolled.push(id);
      const i = factors.findIndex((f) => f.id === id);
      if (i >= 0) factors.splice(i, 1);
    },
    enroll: async () => {
      stats.enroll++;
      if (enrollGate) await enrollGate;
      if (failNextEnroll) {
        failNextEnroll = false;
        throw new Error("network down");
      }
      counter++;
      const name = `FlockPulse attempt-${counter}-${stats.enroll}`;
      stats.names.push(name);
      if (factors.some((f) => f.friendly_name === name)) throw new Error("name exists");
      const id = `factor-${counter}`;
      factors.push({ id, factor_type: "totp", status: "unverified", friendly_name: name });
      return { factorId: id, qrCode: `data:image/svg+xml;utf-8,<svg>fake-${counter}</svg>`, secret: `FAKESECRET${counter}`, uri: `otpauth://totp/fake?secret=FAKESECRET${counter}` };
    },
    pending: createPendingStore(memorySecure()),
  };
  return {
    factors,
    stats,
    deps,
    hold() {
      let release!: () => void;
      enrollGate = new Promise<void>((r) => (release = r));
      return () => {
        enrollGate = null;
        release();
      };
    },
    failNext() {
      failNextEnroll = true;
    },
  };
}

async function main() {
  console.log("selectUnverifiedTotp");
  const mixed = [
    { id: "a", factor_type: "totp", status: "verified" },
    { id: "b", factor_type: "totp", status: "unverified" },
    { id: "c", factor_type: "phone", status: "unverified" },
    { id: "d", factor_type: "phone", status: "verified" },
  ];
  const picked = selectUnverifiedTotp(mixed);
  check("returns only the unverified totp", picked.length === 1 && picked[0].id === "b");
  check("empty list -> empty", selectUnverifiedTotp([]).length === 0);

  console.log("decidePending");
  const stored = { userId: "user-1", factorId: "f1", secret: "FAKESECRET", uri: "otpauth://fake" };
  check("reuse when user and unverified factor match", decidePending({ stored, userId: "user-1", factors: [{ id: "f1", status: "unverified" }] }).action === "reuse");
  check("reuse returns the stored setup", (decidePending({ stored, userId: "user-1", factors: [{ id: "f1", status: "unverified" }] }) as any).pending.secret === "FAKESECRET");
  check("discard when the user differs", decidePending({ stored, userId: "user-2", factors: [{ id: "f1", status: "unverified" }] }).action === "discard");
  check("discard when the factor is gone", decidePending({ stored, userId: "user-1", factors: [{ id: "other", status: "unverified" }] }).action === "discard");
  check("discard when the factor is verified", decidePending({ stored, userId: "user-1", factors: [{ id: "f1", status: "verified" }] }).action === "discard");
  check("discard when nothing is stored", decidePending({ stored: null, userId: "user-1", factors: [{ id: "f1", status: "unverified" }] }).action === "discard");

  console.log("pending store (in-memory SecureLike)");
  const mem = memorySecure();
  const store = createPendingStore(mem);
  check("read before save -> null", (await store.read()) === null);
  await store.save(stored);
  const back = await store.read();
  check("save then read round-trips", back !== null && back.factorId === "f1" && back.secret === "FAKESECRET" && back.userId === "user-1" && back.uri === "otpauth://fake");
  check("stored under the fixed key", mem.data.has(PENDING_KEY) && PENDING_KEY === "flockpulse.mfa.pending");
  check("key only uses allowed characters", /^[A-Za-z0-9._-]+$/.test(PENDING_KEY));
  check("QR image is not stored", !(mem.data.get(PENDING_KEY) as string).includes("svg") && !(mem.data.get(PENDING_KEY) as string).includes("qr"));
  await store.clear();
  check("clear removes it", (await store.read()) === null);
  mem.data.set(PENDING_KEY, "{not json");
  check("malformed JSON -> null", (await store.read()) === null);
  mem.data.set(PENDING_KEY, JSON.stringify({ userId: "u", factorId: "f" }));
  check("missing fields -> null", (await store.read()) === null);
  const boom = createPendingStore({
    getItemAsync: async () => { throw new Error("keystore locked"); },
    setItemAsync: async () => { throw new Error("keystore locked"); },
    deleteItemAsync: async () => { throw new Error("keystore locked"); },
  });
  let threw = false;
  let readResult: unknown = "unset";
  try {
    await boom.save(stored);
    readResult = await boom.read();
    await boom.clear();
  } catch {
    threw = true;
  }
  check("a throwing store never throws out", !threw && readResult === null);

  console.log("startEnrollment");
  {
    const s = fakeServer();
    const first = await startEnrollment(s.deps);
    check("first open calls enroll once", s.stats.enroll === 1);
    check("first open returns the QR and is not 'restored'", !!first.qrCode && !first.restored);
    check("first open saves the pending setup", (await s.deps.pending.read())?.factorId === first.factorId);
  }
  {
    const s = fakeServer();
    const first = await startEnrollment(s.deps);
    const again = await startEnrollment(s.deps); // the "reload"
    check("reload does NOT call enroll again", s.stats.enroll === 1);
    check("reload shows the SAME key", again.secret === first.secret && again.factorId === first.factorId);
    check("reload is flagged restored and has no QR", again.restored === true && again.qrCode === undefined);
    check("reload removes nothing", s.stats.unenroll === 0);
    check("exactly one factor on the server", s.factors.length === 1);
  }
  {
    const s = fakeServer([
      { id: "old-1", factor_type: "totp", status: "unverified" },
      { id: "old-2", factor_type: "totp", status: "unverified" },
      { id: "keep", factor_type: "totp", status: "verified" },
      { id: "phone-1", factor_type: "phone", status: "unverified" },
    ]);
    const r = await startEnrollment(s.deps);
    check("leftovers with nothing stored: both unverified totp removed", s.stats.unenrolled.includes("old-1") && s.stats.unenrolled.includes("old-2"));
    check("verified totp and phone factors are left alone", !s.stats.unenrolled.includes("keep") && !s.stats.unenrolled.includes("phone-1"));
    check("then exactly one enroll", s.stats.enroll === 1 && !!r.qrCode);
  }
  {
    const s = fakeServer();
    const first = await startEnrollment(s.deps);
    // the factor disappears on the server (for example it expired)
    s.factors.splice(0, s.factors.length);
    const next = await startEnrollment(s.deps);
    check("stored pending whose factor is gone -> fresh enroll", s.stats.enroll === 2 && next.factorId !== first.factorId && !!next.qrCode && !next.restored);
  }
  {
    const s = fakeServer([{ id: "other-1", factor_type: "totp", status: "unverified" }]);
    await startEnrollment(s.deps);
    // a second unverified factor appears next to the pending one
    s.factors.push({ id: "extra", factor_type: "totp", status: "unverified" });
    const again = await startEnrollment(s.deps);
    check("reuse also removes OTHER unverified factors", again.restored === true && s.stats.unenrolled.includes("extra") && !s.stats.unenrolled.includes(again.factorId));
  }
  {
    const s = fakeServer();
    const release = s.hold();
    const p1 = startEnrollment(s.deps);
    const p2 = startEnrollment(s.deps);
    release();
    const [r1, r2] = await Promise.all([p1, p2]);
    check("two concurrent calls share one run (enroll once)", s.stats.enroll === 1);
    check("both callers get the same key", r1.secret === r2.secret);
  }
  {
    const s = fakeServer();
    s.failNext();
    let failedOnce = false;
    try {
      await startEnrollment(s.deps);
    } catch {
      failedOnce = true;
    }
    check("a failing run rejects", failedOnce);
    const retry = await startEnrollment(s.deps);
    check("after a failed run a retry runs again and works", !!retry.secret && s.stats.enroll === 2);
  }
  {
    const s = fakeServer([], null);
    let failedNoUser = false;
    try {
      await startEnrollment(s.deps);
    } catch {
      failedNoUser = true;
    }
    check("no signed-in user -> rejects, nothing enrolled", failedNoUser && s.stats.enroll === 0);
  }
  {
    const other = fakeServer();
    await startEnrollment(other.deps);
    // same server state and store, but a different user signs in
    const s2deps = { ...other.deps, getUserId: async () => "user-2" };
    const next = await startEnrollment(s2deps);
    check("a stored setup from another user is discarded", other.stats.enroll === 2 && !next.restored);
  }

  console.log("startOverEnrollment");
  {
    const s = fakeServer();
    const first = await startEnrollment(s.deps);
    const restored = await startEnrollment(s.deps);
    const fresh = await startOverEnrollment(s.deps);
    check("start over gives a new key and QR", !!fresh.qrCode && fresh.secret !== first.secret && !fresh.restored && restored.restored === true);
    check("start over removed the old pending factor", s.stats.unenrolled.includes(first.factorId));
    check("start over leaves one unverified factor", s.factors.filter((f) => f.status === "unverified").length === 1);
    check("start over saves the new pending setup", (await s.deps.pending.read())?.factorId === fresh.factorId);
  }

  console.log("friendly names are unique per attempt");
  {
    const s = fakeServer();
    await startEnrollment(s.deps);
    await startOverEnrollment(s.deps);
    check("two attempts, two different names", s.stats.names.length === 2 && s.stats.names[0] !== s.stats.names[1]);
  }
  const svc = read("src/features/auth/services/auth.service.ts");
  check("enrollTotpFactor passes a friendlyName", /friendlyName:\s*`FlockPulse \$\{new Date\(\)\.toISOString\(\)\}`/.test(svc));
  check("listAllTotpFactors reads data.all", /return data\.all\.filter\(\(factor\) => factor\.factor_type === "totp"\)/.test(svc));
  check("listAllTotpFactors no longer returns data.totp", !/listAllTotpFactors[\s\S]{0,250}return data\.totp/.test(svc));
  check("hasEnrolledTotpFactor / getTotpFactorId still verified-only", /data\.totp\.some\(\(factor\) => factor\.status === "verified"\)/.test(svc) && /data\.totp\.find\(\(factor\) => factor\.status === "verified"\)/.test(svc));
  check("signOut clears the pending setup", /export async function signOut\(\) \{\s*await clearPendingSafely\(\);/.test(svc));
  check("forceLocalSignOut clears the pending setup", /export async function forceLocalSignOut\(\): Promise<void> \{\s*await clearPendingSafely\(\);/.test(svc));
  check("clearPendingSafely cannot throw", /async function clearPendingSafely[\s\S]{0,200}try \{[\s\S]{0,120}\} catch/.test(svc));

  console.log("screen and form wiring");
  const screen = read("app/(auth)/mfa-enroll.tsx");
  const form = read("src/features/auth/components/MfaEnrollForm.tsx");
  check("screen uses startEnrollment", screen.includes("startEnrollment(enrollDeps)"));
  check("screen shows the friendly message", screen.includes("We could not start two-step setup. Please try again."));
  check("screen has a Try again button", screen.includes('testID="mfa-enroll-retry"') && screen.includes("Try again"));
  check("screen never renders a raw error", !/err\.message|error\.message/.test(screen) && !screen.includes("setError("));
  check("screen clears the pending setup after verify", /verifyTotpEnrollment\(enrollment\.factorId, code\);\s*[^\n]*\s*await clearPendingEnrollment\(\);/.test(screen));
  check("form renders the QR only when present", form.includes("svgMarkup ? ("));
  check("form has the restored line", form.includes("Your setup key from before is shown below. If your authenticator app already has it, just enter the code."));
  check("form has Start over with a new key", form.includes("Start over with a new key") && form.includes('testID="mfa-enroll-start-over"'));
  check("start over button has an accessibility label", form.includes('accessibilityLabel="Start over with a new setup key"'));
  check("manual key stays selectable", /<Text selectable[\s\S]{0,120}testID="mfa-enroll-secret"/.test(form));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
