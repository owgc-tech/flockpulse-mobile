/**
 * FP-258 adj-1 (mobile) — password re-check must not replace the session:
 * standalone checks
 *
 * No test runner exists in this repo, so this is a plain script (run with
 * `npx tsx scripts/test-fp258-adj1.ts`). auth.service.ts imports React Native
 * storage and the shared Supabase client, so it cannot be loaded under tsx;
 * the checks on it and on the screen are source greps. The "not deleted" line
 * helper is pure and is exercised directly.
 */
declare const require: (id: string) => any;
declare const process: { exit(code: number): never };
const fs = require("fs");
const {
  ACCOUNT_NOT_DELETED_LINE,
  withNotDeletedLine,
  describeDeletionBlockers,
  DELETION_BLOCKED_FALLBACK,
} = require("../src/features/members/removalBlockers");

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

// --- "Your account was not deleted." helper ---------------------------------
check('line text is exactly "Your account was not deleted."', ACCOUNT_NOT_DELETED_LINE === "Your account was not deleted.");

const reasons = ["You lead 2 members. Ask your Administrator to assign them to another leader first."];
const once = withNotDeletedLine(reasons);
check("appended after the reasons", once.length === 2 && once[0] === reasons[0] && once[1] === ACCOUNT_NOT_DELETED_LINE);
check("appended exactly once (idempotent)", withNotDeletedLine(once).filter((l: string) => l === ACCOUNT_NOT_DELETED_LINE).length === 1);
check("not appended when there are no reasons", withNotDeletedLine([]).length === 0);
check("does not mutate its input", reasons.length === 1);

const full = withNotDeletedLine(
  describeDeletionBlockers({ assignedMemberCount: 1, ownedGroupCount: 1, ownedEventCount: 1, lastAdmin: true, message: "x" })
);
check("all four reasons + closing line = 5 lines, closing line last", full.length === 5 && full[4] === ACCOUNT_NOT_DELETED_LINE);
const fallback = withNotDeletedLine(
  describeDeletionBlockers({ assignedMemberCount: null, ownedGroupCount: null, ownedEventCount: null, lastAdmin: false, message: "" })
);
check("fallback sentence also gets the closing line", fallback[0] === DELETION_BLOCKED_FALLBACK && fallback[1] === ACCOUNT_NOT_DELETED_LINE);

// --- source greps -------------------------------------------------------------
const screen: string = fs.readFileSync("app/(app)/profile/delete-account.tsx", "utf8");
check("delete-account.tsx no longer references signInWithPassword", !/signInWithPassword/.test(screen));
check("delete-account.tsx imports and calls verifyPassword", /import \{[^}]*\bverifyPassword\b[^}]*\} from/.test(screen) && /await verifyPassword\(/.test(screen));
check("delete-account.tsx applies withNotDeletedLine to the blockers", /setBlockers\(withNotDeletedLine\(/.test(screen));
check("blockers accessibilityLabel joins the (now complete) list", /accessibilityLabel=\{blockers\.join\(/.test(screen));

const svc: string = fs.readFileSync("src/features/auth/services/auth.service.ts", "utf8").replace(/\r\n/g, "\n");
const start = svc.indexOf("export async function verifyPassword");
const end = svc.indexOf("\nexport ", start + 1);
const body = start >= 0 ? svc.slice(start, end > start ? end : undefined) : "";
check("verifyPassword exists in auth.service.ts", start >= 0);

const signOutCalls = body.match(/\.signOut\([^)]*\)/g) ?? [];
check("verifyPassword calls signOut at least once (ends the throwaway session)", signOutCalls.length >= 1);
check(
  "every signOut inside verifyPassword uses scope: 'local'",
  signOutCalls.length > 0 && signOutCalls.every((c: string) => /scope:\s*["']local["']/.test(c)),
  `found: ${JSON.stringify(signOutCalls)}`
);
check("verifyPassword never touches the shared client (no `supabase.auth`)", !/(^|[^\w.])supabase\.auth\b/.test(body));
check("throwaway client: persistSession false", /persistSession:\s*false/.test(body));
check("throwaway client: autoRefreshToken false", /autoRefreshToken:\s*false/.test(body));
check("throwaway client: detectSessionInUrl false", /detectSessionInUrl:\s*false/.test(body));
check("throwaway client: distinct storageKey", /storageKey:\s*["']fp-password-check["']/.test(body));
check("throwaway client: no AsyncStorage", !/AsyncStorage|storage:/.test(body));
check("login's signInWithPassword is unchanged (still on the shared client)", /export async function signInWithPassword[\s\S]*?supabase\.auth\.signInWithPassword/.test(svc));

console.log(`\n${passed}/${passed + failed} checks passed`);
if (failed > 0) process.exit(1);
