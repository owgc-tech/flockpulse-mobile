/**
 * FP-257 (mobile) — Leader's confirmation card hides rating and feedback:
 * standalone checks
 *
 * No test runner exists in this repo, so this is a plain script (run with
 * `npx tsx scripts/test-fp257-confirm-card.ts`). The screen and types import
 * React Native / app modules that cannot load under tsx, so these are source
 * checks.
 */
declare const require: (id: string) => any;
declare const process: { exit(code: number): never };
const fs = require("fs");

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
const read = (p: string): string => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

// Strip comments so the explanatory FP-257 comments don't count as usage.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const card = stripComments(read("app/(app)/(tabs)/confirmations/index.tsx"));
check("confirmations/index.tsx has no `feedback` outside comments", !/feedback/i.test(card));
check("confirmations/index.tsx has no `star_rating` outside comments", !/star_rating/.test(card));
check("confirmations/index.tsx no longer renders a Rating line", !/Rating:/.test(card));
check("confirmations card still shows name and status", /member_first_name/.test(card) && /Self-reported: Attended/.test(card));

const types = read("src/features/confirmations/types.ts");
const m = types.match(/export interface PendingConfirmationRow \{[\s\S]*?\n\}/);
const body = m ? stripComments(m[0]) : "";
check("PendingConfirmationRow exists", !!m);
check("PendingConfirmationRow no longer declares feedback", !/\bfeedback\b/.test(body));
check("PendingConfirmationRow no longer declares star_rating", !/\bstar_rating\b/.test(body));
check("PendingConfirmationRow keeps its other fields", /self_report_id/.test(body) && /member_first_name/.test(body) && /rsvp_reason/.test(body));

// The member's own side is unchanged.
const selfReport = read("app/(app)/(tabs)/self-report/index.tsx");
check("self-report/index.tsx still sends feedback", /feedback:\s*feedback\.trim\(\)/.test(selfReport));
check("self-report/index.tsx still sends starRating", /starRating:\s*starRating/.test(selfReport));

console.log(`\n${passed}/${passed + failed} checks passed`);
if (failed > 0) process.exit(1);
