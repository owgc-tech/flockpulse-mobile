/**
 * FP-265 (mobile) — "Forgot password?" link: standalone checks
 *
 * No test runner exists in this repo, so this is a plain script (run with
 * `npx tsx scripts/test-fp265-forgot-password.ts`). It exercises the real
 * getResetPasswordUrl helper and greps LoginForm.tsx for the testID,
 * accessibilityRole and the wiring.
 *
 * NOT covered here: no device run, no real browser hand-off, no real email.
 */
declare const require: (id: string) => any;
declare const process: { cwd(): string; exit(code: number): never };
const fs = require("fs");
const path = require("path");
const {
  getResetPasswordUrl,
  FORGOT_PASSWORD_FALLBACK_MESSAGE,
} = require("../src/features/auth/forgotPassword");

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

console.log("getResetPasswordUrl");
check("https base", getResetPasswordUrl("https://app.flockpulse.ca") === "https://app.flockpulse.ca/reset-password?from=app");
check("trailing slash", getResetPasswordUrl("https://app.flockpulse.ca/") === "https://app.flockpulse.ca/reset-password?from=app");
check("base with a path", getResetPasswordUrl("https://x.test/api") === "https://x.test/reset-password?from=app");
check("surrounding whitespace", getResetPasswordUrl("  https://x.test  ") === "https://x.test/reset-password?from=app");
check("http localhost with port", getResetPasswordUrl("http://localhost:3000") === "http://localhost:3000/reset-password?from=app");
check("undefined -> null", getResetPasswordUrl(undefined) === null);
check("null -> null", getResetPasswordUrl(null) === null);
check("empty string -> null", getResetPasswordUrl("") === null);
check("whitespace -> null", getResetPasswordUrl("   ") === null);
check("not a url -> null", getResetPasswordUrl("not a url") === null);
check("ftp -> null", getResetPasswordUrl("ftp://x.test") === null);
check("fallback message is a plain sentence", typeof FORGOT_PASSWORD_FALLBACK_MESSAGE === "string" && FORGOT_PASSWORD_FALLBACK_MESSAGE.length > 10);

console.log("LoginForm.tsx wiring");
const src: string = fs.readFileSync(
  path.join(process.cwd(), "src/features/auth/components/LoginForm.tsx"),
  "utf8",
);
check('testID="login-forgot-password"', src.includes('testID="login-forgot-password"'));
check('accessibilityRole="link"', src.includes('accessibilityRole="link"'));
check("accessibility label", src.includes('accessibilityLabel="Forgot password? Opens the reset page in your browser"'));
check("min touch height 44", /minHeight:\s*44/.test(src));
check("disabled while submitting", /disabled=\{isSubmitting\}/.test(src));
check("uses getResetPasswordUrl with EXPO_PUBLIC_API_BASE_URL", src.includes("getResetPasswordUrl(process.env.EXPO_PUBLIC_API_BASE_URL)"));
check("catch uses the fallback message, not the raw error", /catch \{\s*setError\(FORGOT_PASSWORD_FALLBACK_MESSAGE\)/.test(src));
check("does not clear email or password", !/handleForgotPassword[\s\S]{0,500}setEmail\(""\)/.test(src));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
