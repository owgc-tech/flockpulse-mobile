/**
 * FP-258 (mobile) — account-deletion blockers: standalone checks
 *
 * No test runner exists in this repo, so this is a plain script (run with
 * `npx tsx scripts/test-fp258-removal-blockers.ts`). It exercises the real
 * describeDeletionBlockers helper.
 */
declare const require: (id: string) => any;
declare const process: { exit(code: number): never };
const { describeDeletionBlockers, DELETION_BLOCKED_FALLBACK } = require("../src/features/members/removalBlockers");

let passed = 0;
let failed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}\n        got:      ${JSON.stringify(actual)}\n        expected: ${JSON.stringify(expected)}`);
  }
}

const UUID = "3f2b8c1e-9d4a-4e7b-8a21-5c6d7e8f9a0b";
const none = { assignedMemberCount: null, ownedGroupCount: null, ownedEventCount: null, lastAdmin: false, message: "x" };

const ADMIN =
  "You are this community's only Administrator. Make another member an Administrator first, or email support@flockpulse.ca to close the community.";
const MEMBERS = (n: string) => `You lead ${n}. Ask your Administrator to assign them to another leader first.`;
const GROUPS = (n: string) => `You own ${n}. Ask your Administrator to give them to someone else first.`;
const EVENTS = (n: string) => `You own ${n}. Ask your Administrator to give them to someone else first.`;

// Each block alone
check("lastAdmin alone", describeDeletionBlockers({ ...none, lastAdmin: true }), [ADMIN]);
check("members led alone", describeDeletionBlockers({ ...none, assignedMemberCount: 3 }), [MEMBERS("3 members")]);
check("groups alone", describeDeletionBlockers({ ...none, ownedGroupCount: 2 }), [GROUPS("2 groups")]);
check("events alone", describeDeletionBlockers({ ...none, ownedEventCount: 4 }), [EVENTS("4 upcoming events")]);

// All four together, in order: lastAdmin, members, groups, events
check(
  "all four together, in order",
  describeDeletionBlockers({ assignedMemberCount: 2, ownedGroupCount: 5, ownedEventCount: 7, lastAdmin: true, message: "x" }),
  [ADMIN, MEMBERS("2 members"), GROUPS("5 groups"), EVENTS("7 upcoming events")]
);
check(
  "two together (members + groups)",
  describeDeletionBlockers({ ...none, assignedMemberCount: 1, ownedGroupCount: 1 }),
  [MEMBERS("1 member"), GROUPS("1 group")]
);

// Singular / plural
check("singular member", describeDeletionBlockers({ ...none, assignedMemberCount: 1 }), [MEMBERS("1 member")]);
check("singular group", describeDeletionBlockers({ ...none, ownedGroupCount: 1 }), [GROUPS("1 group")]);
check("singular event", describeDeletionBlockers({ ...none, ownedEventCount: 1 }), [EVENTS("1 upcoming event")]);

// Older-server shape: exactly one count, no lastAdmin (field absent -> false)
check(
  "old server: one count, lastAdmin false",
  describeDeletionBlockers({ assignedMemberCount: null, ownedGroupCount: 2, ownedEventCount: null, lastAdmin: false, message: `Cannot deactivate member ${UUID}: owns groups` }),
  [GROUPS("2 groups")]
);

// Counts of 0 are not blocks
check(
  "zero counts are ignored (falls back to message)",
  describeDeletionBlockers({ ...none, assignedMemberCount: 0, ownedGroupCount: 0, ownedEventCount: 0, message: "Please try later." }),
  ["Please try later."]
);

// Nothing present
check("nothing present, friendly message", describeDeletionBlockers({ ...none, message: "Deletion is not allowed right now." }), [
  "Deletion is not allowed right now.",
]);
check(
  "nothing present, raw message with a UUID -> fallback",
  describeDeletionBlockers({ ...none, message: `Cannot deactivate member ${UUID}: still assigned` }),
  [DELETION_BLOCKED_FALLBACK]
);
check("nothing present, empty message -> fallback", describeDeletionBlockers({ ...none, message: "" }), [DELETION_BLOCKED_FALLBACK]);
check("nothing present, missing message -> fallback", describeDeletionBlockers({ ...none, message: undefined }), [DELETION_BLOCKED_FALLBACK]);

// No output ever contains a UUID, even when the raw message does
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const samples = [
  describeDeletionBlockers({ ...none, message: `Cannot deactivate member ${UUID}` }),
  describeDeletionBlockers({ ...none, lastAdmin: true, message: `Cannot deactivate member ${UUID}` }),
  describeDeletionBlockers({ assignedMemberCount: 1, ownedGroupCount: 1, ownedEventCount: 1, lastAdmin: true, message: `member ${UUID}` }),
].flat();
check("no output contains a UUID", samples.some((s: string) => UUID_RE.test(s)), false);

console.log(`\n${passed}/${passed + failed} checks passed`);
if (failed > 0) process.exit(1);
