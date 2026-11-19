/**
 * FP-261 (mobile) — task "always show" flag: standalone checks
 *
 * No test runner exists in this repo, so this is a plain script (run with
 * `npx tsx scripts/test-fp261-always-show.ts`). It exercises the real
 * isAlwaysShown helper and greps app/ and src/ to prove the hardcoded
 * CORE_TASK_NAMES list is gone.
 */
declare const require: (id: string) => any;
declare const process: { cwd(): string; exit(code: number): never };
const fs = require("fs");
const path = require("path");
const { isAlwaysShown } = require("../src/features/tasks/alwaysShown");

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

const base = {
  id: "t1",
  tenant_id: "tn",
  name: "Hospitality",
  individual_only: false,
  deleted_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

check("always_show: true -> shown", isAlwaysShown({ ...base, always_show: true }) === true);
check("always_show: false -> not shown", isAlwaysShown({ ...base, always_show: false }) === false);
check("field missing (older server) -> not shown", isAlwaysShown({ ...base }) === false);
check(
  'task named "Prayer Leader" without the flag -> not shown',
  isAlwaysShown({ ...base, name: "Prayer Leader" }) === false
);
check(
  'task named "Food Assignment" with always_show: false -> not shown',
  isAlwaysShown({ ...base, name: "Food Assignment", always_show: false }) === false
);
check(
  "non-boolean junk (e.g. string 'true') -> not shown",
  isAlwaysShown({ ...base, always_show: "true" as any }) === false
);

// Grep: CORE_TASK_NAMES must be gone from app/ and src/.
function walk(dir: string, out: string[]) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }) as any[]) {
    if (e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
}
const files: string[] = [];
for (const d of ["app", "src"]) walk(path.join(process.cwd(), d), files);
const offenders = files.filter((f) => fs.readFileSync(f, "utf8").includes("CORE_TASK_NAMES"));
check(`CORE_TASK_NAMES gone from app/ and src/ (${files.length} files scanned)`, offenders.length === 0);
for (const o of offenders) console.log(`        still in: ${o}`);

console.log(`\n${passed}/${passed + failed} checks passed`);
if (failed > 0) process.exit(1);
