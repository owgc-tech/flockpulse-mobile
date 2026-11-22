/**
 * FP-254 (mobile) — one-time acceptance screen + birthdate removal: standalone checks
 *
 * No test runner exists in this repo, so this is a plain script (run with
 * `npx tsx scripts/test-fp254-acceptance.ts`). It exercises the real pure
 * helpers and the real load/save logic with a mocked fetcher (apiFetch itself
 * pulls in the Supabase client, so the service file is only bound to it), and
 * greps the screen, layout, profile edit screen and types.
 *
 * NOT covered here: no device run, no real browser hand-off, no hosted server,
 * so the real web route (not merged when this was written) is untested.
 */
declare const require: (id: string) => any;
declare const process: { cwd(): string; exit(code: number): never };
const fs = require("fs");
const path = require("path");
const {
  getLegalPageUrl,
  canSubmitAcceptance,
  parseAcceptanceStatus,
  loadAcceptanceRequired,
  saveAcceptance,
  ACCEPTANCE_PATH,
} = require("../src/features/legal/acceptance");

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

async function main() {
  console.log("getLegalPageUrl");
  check("https terms", getLegalPageUrl("https://app.flockpulse.ca", "terms") === "https://app.flockpulse.ca/terms");
  check("https privacy", getLegalPageUrl("https://app.flockpulse.ca", "privacy") === "https://app.flockpulse.ca/privacy");
  check("trailing slash", getLegalPageUrl("https://app.flockpulse.ca/", "terms") === "https://app.flockpulse.ca/terms");
  check("path in base", getLegalPageUrl("https://x.test/api", "privacy") === "https://x.test/privacy");
  check("http localhost", getLegalPageUrl("http://localhost:3000", "terms") === "http://localhost:3000/terms");
  check("undefined -> null", getLegalPageUrl(undefined, "terms") === null);
  check("empty -> null", getLegalPageUrl("", "terms") === null);
  check("not a url -> null", getLegalPageUrl("not a url", "terms") === null);
  check("ftp -> null", getLegalPageUrl("ftp://x.test", "terms") === null);

  console.log("canSubmitAcceptance");
  check("both ticked", canSubmitAcceptance(true, true) === true);
  check("only adult", canSubmitAcceptance(true, false) === false);
  check("only terms", canSubmitAcceptance(false, true) === false);
  check("neither", canSubmitAcceptance(false, false) === false);

  console.log("parseAcceptanceStatus");
  check("required true (unwrapped)", parseAcceptanceStatus({ required: true }).required === true);
  check("required true (envelope)", parseAcceptanceStatus({ data: { required: true } }).required === true);
  check("required false", parseAcceptanceStatus({ required: false }).required === false);
  check("missing data", parseAcceptanceStatus({}).required === false);
  check("garbage string", parseAcceptanceStatus("yes").required === false);
  check("null", parseAcceptanceStatus(null).required === false);
  check('required "true" string is not true', parseAcceptanceStatus({ required: "true" }).required === false);

  console.log("loadAcceptanceRequired / saveAcceptance (mocked fetcher)");
  const err404 = Object.assign(new Error("Not found"), { status: 404, code: "NOT_FOUND" });
  check("404 -> false", (await loadAcceptanceRequired(async () => { throw err404; })) === false);
  let threw = false;
  let netResult: boolean | null = null;
  try {
    netResult = await loadAcceptanceRequired(async () => { throw new TypeError("Network request failed"); });
  } catch {
    threw = true;
  }
  check("network error -> false, no throw", netResult === false && !threw);
  check("non-JSON not-found page (SyntaxError) -> false", (await loadAcceptanceRequired(async () => { throw new SyntaxError("JSON Parse error"); })) === false);
  let calledPath = "";
  check("{required:true} -> true", (await loadAcceptanceRequired(async (p: string) => { calledPath = p; return { required: true }; })) === true);
  check("GET goes to the acceptance path", calledPath === "/api/members/me/acceptance" && ACCEPTANCE_PATH === calledPath);
  check("{required:false} -> false", (await loadAcceptanceRequired(async () => ({ required: false }))) === false);

  let postInit: any = null;
  check("save success", (await saveAcceptance(async (_p: string, init: any) => { postInit = init; return { accepted: true }; })) === true);
  check("save posts both flags as POST", postInit?.method === "POST" && postInit?.body === JSON.stringify({ confirmAdult: true, acceptTerms: true }));
  check("save failure (422) -> false, no throw", (await saveAcceptance(async () => { throw Object.assign(new Error("bad"), { status: 422 }); })) === false);
  check("save unexpected response -> false", (await saveAcceptance(async () => ({}))) === false);

  console.log("AcceptanceScreen.tsx");
  const screen = read("src/features/legal/components/AcceptanceScreen.tsx");
  for (const text of [
    "Please confirm to continue",
    "Terms of Service",
    "Privacy Policy",
    ". Please read them, then confirm below. FlockPulse does not ask for your birthdate.",
    "I accept the Terms of Service and the Privacy Policy.",
    "I confirm I am 18 or older.",
    "Continue",
    "If you do not agree, you can delete your account.",
    "Sign out",
    "We couldn't save that. Please try again.",
  ]) {
    check(`text: ${text}`, screen.includes(text));
  }
  check("body starts 'We updated our'", screen.includes("We updated our{\" \"}"));
  check('two accessibilityRole="checkbox"', (screen.match(/accessibilityRole="checkbox"/g) ?? []).length === 2);
  check("min touch height 44", (screen.match(/minHeight:\s*44/g) ?? []).length >= 3);
  check("uses useThemeColors", screen.includes("useThemeColors()"));
  check("is scrollable", screen.includes("<ScrollView"));
  check("uses existing signOut import", /import \{ signOut \} from "@\/src\/features\/auth\/services\/auth\.service"/.test(screen));

  console.log("_layout.tsx gate");
  const layout = read("app/(app)/_layout.tsx");
  check("imports AcceptanceScreen", layout.includes("AcceptanceScreen"));
  check("calls fetchAcceptanceRequired", layout.includes("fetchAcceptanceRequired()"));
  check("check keyed on user id only (no access_token)", /\}, \[readyUserId\]\);/.test(layout));
  check("existing gate/biometric code still present", layout.includes("readyUserIdRef") && layout.includes("biometric-lock") && layout.includes("consumeJustAuthenticated"));

  console.log("birthdate removed");
  const edit = read("app/(app)/profile/edit.tsx");
  const types = read("src/features/members/types.ts");
  check("edit.tsx has no birthdate", !/birthdate/i.test(edit));
  check("types.ts has no birthdate", !/birthdate/i.test(types));
  check("edit.tsx has no date picker import", !edit.includes("datetimepicker"));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
