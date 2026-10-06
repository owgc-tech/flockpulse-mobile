/**
 * FP-242 (mobile) — colored assignee pills: standalone checks
 *
 * No test runner exists in this repo, so this is a plain script, same pattern as
 * test-fp240-mobile.ts: the real normalizer, section builder, labels and the real
 * AssigneeStatePills component function are imported; only modules that cannot load
 * under Node are stubbed (react-native, React's element creation / useMemo, the theme
 * hook, apiFetch). The component is called as a plain function and the element tree
 * it returns is walked.
 *
 * Run:  npx tsx scripts/test-fp242-mobile.ts
 */

declare const require: (id: string) => any;
const Module = require("module");

type El = { type: unknown; props: Record<string, any> };
const createElement = (type: unknown, props: Record<string, any> | null, ...children: unknown[]): El => ({
  type,
  props: { ...(props ?? {}), ...(children.length ? { children: children.length === 1 ? children[0] : children } : {}) },
});
const jsx = (type: unknown, props: Record<string, any>, key?: unknown): El => ({ type, props: { ...props, key } });

let themeName: "light" | "dark" = "light";
const stubs: Record<string, unknown> = {
  "react-native": {
    Linking: {}, Platform: { OS: "ios" },
    StyleSheet: { create: (o: unknown) => o },
    Text: "Text", View: "View",
  },
  react: { useMemo: (fn: () => unknown) => fn(), createElement, Fragment: "Fragment" },
  "@/src/theme/useThemeColors": {
    useThemeColors: () => {
      const c = require("../src/theme/colors");
      return themeName === "light" ? c.lightColors : c.darkColors;
    },
  },
  "@/src/lib/api": { apiFetch: async () => undefined },
  "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
  "react/jsx-dev-runtime": { jsxDEV: jsx, Fragment: "Fragment" },
};
const mod = Module as { _load: (request: string, ...rest: unknown[]) => unknown };
const originalLoad = mod._load;
mod._load = function (request: string, ...rest: unknown[]) {
  if (request in stubs) return stubs[request];
  return originalLoad.call(this, request, ...rest);
};

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}${detail ? "  -> " + detail : ""}`); }
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Every string rendered anywhere in the tree.
function texts(node: any, out: string[] = []): string[] {
  if (node === null || node === undefined || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") { out.push(String(node)); return out; }
  if (Array.isArray(node)) { node.forEach((n) => texts(n, out)); return out; }
  if (typeof node === "object" && "props" in node) texts(node.props?.children, out);
  return out;
}
// Every element in the tree.
function elements(node: any, out: El[] = []): El[] {
  if (node === null || node === undefined || typeof node !== "object") return out;
  if (Array.isArray(node)) { node.forEach((n) => elements(n, out)); return out; }
  if ("props" in node) { out.push(node); elements(node.props?.children, out); }
  return out;
}
const byTestId = (tree: any, id: string) => elements(tree).find((e) => e.props.testID === id);

const st = (member_id: string, name: string, state: string, via_group_id: string | null = null): any => ({ member_id, name, state, via_group_id });

async function main() {
  const service = await import("../src/features/tasks/services/tasks.service");
  const sections = await import("../src/features/tasks/assigneePillSections");
  const { AssigneeStatePills } = await import("../src/features/tasks/components/AssigneeStatePills");
  const { lightColors, darkColors } = await import("../src/theme/colors");
  const norm = service.normalizeAssigneeStates;

  // ================================================================ normalizer
  console.log("\n=== normalizeAssigneeStates");
  check("missing -> [] / 0", eq(norm(undefined, undefined), { states: [], total: 0 }));
  check("null -> [] / 0", eq(norm(null, null), { states: [], total: 0 }));
  check("non-array (string / object / number) -> []", eq(norm("x", 3).states, []) && eq(norm({}, 1).states, []) && eq(norm(7, 7).states, []));
  const mixed = norm([
    st("m1", "Ana Cruz", "REFUSED"),
    st("m2", "", "PENDING"),                 // blank name
    st("m3", "   ", "PENDING"),              // whitespace name
    { member_id: "m4", state: "PENDING" },   // no name
    st("m5", "Bad State", "MAYBE"),          // unknown state
    null, "x", 5,                            // non-objects
    st("m6", "Ben Lee", "COMMITTED", "g1"),
    st("m7", " Cy Ortiz ", "PENDING"),
  ], 3);
  check("bad entries dropped (no name, blank, unknown state, non-object)", mixed.states.length === 3);
  check("server order preserved (not re-sorted)", eq(mixed.states.map((s) => s.member_id), ["m1", "m6", "m7"]));
  check("name trimmed", mixed.states[2].name === "Cy Ortiz");
  check("via_group_id coerced: string kept, anything else null",
    mixed.states[1].via_group_id === "g1" && mixed.states[0].via_group_id === null &&
    norm([{ member_id: "a", name: "A", state: "PENDING", via_group_id: 5 }], 1).states[0].via_group_id === null &&
    norm([{ member_id: "a", name: "A", state: "PENDING" }], 1).states[0].via_group_id === null);
  check("total kept when >= list length (150 of 100 shown)", norm(Array.from({ length: 100 }, (_, i) => st("m" + i, "P" + i, "PENDING")), 150).total === 150);
  check("total missing -> list length", norm([st("m1", "A", "PENDING")], undefined).total === 1);
  check("total smaller than list -> list length", norm([st("m1", "A", "PENDING"), st("m2", "B", "PENDING")], 1).total === 2);
  check("total not a number / fractional / NaN -> list length", norm([st("m1", "A", "PENDING")], "9").total === 1 && norm([st("m1", "A", "PENDING")], 2.5).total === 1 && norm([st("m1", "A", "PENDING")], NaN).total === 1);
  check("whole list dropped but a valid total: states [] (screen falls back), total kept per spec", eq(norm([null], 4), { states: [], total: 4 }));

  // listEventTaskAssignments applies it per row, next to refused_by
  const apiStub = (stubs["@/src/lib/api"] as { apiFetch: unknown });
  apiStub.apiFetch = async () => [
    { id: "a1", task_id: "t1", assignee: { member_ids: ["m1"] }, assignee_states: [st("m1", "Ana", "REFUSED")], assignee_states_total: 1, refused_by: [{ member_id: "m1", name: "Ana" }] },
    { id: "a2", task_id: "t2", assignee: { member_ids: ["m2"] } },   // older server
  ];
  const rows = await service.listEventTaskAssignments("e1");
  check("listEventTaskAssignments: new fields normalized per row", rows[0].assignee_states!.length === 1 && rows[0].assignee_states_total === 1);
  check("listEventTaskAssignments: older server row -> [] / 0", eq(rows[1].assignee_states, []) && rows[1].assignee_states_total === 0);
  check("listEventTaskAssignments: refused_by still normalized (fallback source)", eq(rows[0].refused_by, [{ member_id: "m1", name: "Ana" }]) && eq(rows[1].refused_by, []));

  // ================================================================ buildPillSections
  console.log("\n=== buildPillSections");
  const names = new Map([["g1", "Choir"], ["g2", "Ushers"]]);
  const direct = [st("m1", "Ana", "REFUSED"), st("m2", "Ben", "PENDING")];
  let sec = sections.buildPillSections(direct, 2, [], names);
  check("direct only: one section, no caption, no more", sec.length === 1 && sec[0].caption === null && sec[0].pills.length === 2 && sec[0].moreCount === 0);
  const g1 = [st("m3", "Cy", "COMMITTED", "g1")];
  const g2 = [st("m4", "Di", "PENDING", "g2"), st("m5", "Ed", "COMMITTED", "g2")];
  sec = sections.buildPillSections([...g2, ...g1], 3, ["g1", "g2"], names);
  check("groups come out in group_ids order (not state order)", eq(sec.map((s) => s.caption), ["Choir", "Ushers"]));
  check("pills inside a section keep the server's order", eq(sec[1].pills.map((p) => p.member_id), ["m4", "m5"]));
  sec = sections.buildPillSections([...direct, ...g1, ...g2], 5, ["g1", "g2"], names);
  check("direct + two groups: 3 sections, direct first without caption", sec.length === 3 && sec[0].caption === null && sec[1].caption === "Choir" && sec[2].caption === "Ushers");
  sec = sections.buildPillSections(g2, 2, ["g1", "g2"], names);
  check("a group with no entries is omitted", sec.length === 1 && sec[0].caption === "Ushers");
  sec = sections.buildPillSections([st("m9", "Zed", "PENDING", "gX")], 1, ["g1"], names);
  check("unknown via_group_id -> last section 'Unknown group', no throw", sec.length === 1 && sec[0].caption === "Unknown group" && sec[0].pills.length === 1);
  sec = sections.buildPillSections([...direct, st("m9", "Zed", "PENDING", "gX")], 3, [], names);
  check("direct + orphan: orphan section is last", sec.length === 2 && sec[1].caption === "Unknown group");
  sec = sections.buildPillSections(g1, 1, ["g1"], new Map());
  check("group name missing from the lookup -> 'Unknown group' caption", sec[0].caption === "Unknown group");
  const hundred = Array.from({ length: 100 }, (_, i) => st("m" + i, "P" + i, "PENDING", i < 40 ? null : "g1"));
  sec = sections.buildPillSections(hundred, 150, ["g1"], names);
  check("100 shown of 150: moreCount 50 on the LAST section only", sec.length === 2 && sec[0].moreCount === 0 && sec[1].moreCount === 50);
  sec = sections.buildPillSections(hundred, 100, ["g1"], names);
  check("total == shown -> no more", sec.every((s) => s.moreCount === 0));
  check("empty input -> []", sections.buildPillSections([], 0, ["g1"], names).length === 0 && sections.buildPillSections([], 9, [], names).length === 0);

  // ================================================================ labels
  console.log("\n=== Accessibility labels");
  check('"Ana, committed"', sections.pillAccessibilityLabel(st("m", "Ana", "COMMITTED")) === "Ana, committed");
  check('"Ana, refused"', sections.pillAccessibilityLabel(st("m", "Ana", "REFUSED")) === "Ana, refused");
  check('"Ana, not yet responded"', sections.pillAccessibilityLabel(st("m", "Ana", "PENDING")) === "Ana, not yet responded");
  check('more label: "50 more assignees" (one "more", no doubling)', sections.morePillAccessibilityLabel(50) === "50 more assignees" && (sections.morePillAccessibilityLabel(50).match(/more/g) ?? []).length === 1);

  // ================================================================ component
  console.log("\n=== AssigneeStatePills (rendered as a function, both themes)");
  const demoSections = sections.buildPillSections(
    [st("m1", "Ana", "REFUSED"), st("m2", "Ben", "PENDING"), st("m3", "Cy", "COMMITTED", "g1")],
    53, ["g1"], names
  );
  for (const theme of ["light", "dark"] as const) {
    themeName = theme;
    const tree = (AssigneeStatePills as any)({ sections: demoSections, testIDPrefix: "t" });
    const all = texts(tree);
    const colors = theme === "light" ? lightColors : darkColors;
    const ana = byTestId(tree, "t-pill-m1")!, ben = byTestId(tree, "t-pill-m2")!, cy = byTestId(tree, "t-pill-m3")!;
    check(`[${theme}] one pill per entry (3) + the more pill`, !!ana && !!ben && !!cy && !!byTestId(tree, "t-more"));
    check(`[${theme}] ✕ mark on refused, ✓ on committed, none on pending`,
      texts(ana).join("") === "✕ Ana" && texts(cy).join("") === "✓ Cy" && texts(ben).join("") === "Ben");
    check(`[${theme}] no state word is ever visible`, !all.some((t) => /committed|refused|pending|responded/i.test(t)), JSON.stringify(all));
    check(`[${theme}] accessibility labels correct and pills are accessible`,
      ana.props.accessibilityLabel === "Ana, refused" && ben.props.accessibilityLabel === "Ben, not yet responded" && cy.props.accessibilityLabel === "Cy, committed" && ana.props.accessible === true);
    check(`[${theme}] state colors come from the pill tokens`,
      ana.props.style.some((s: any) => s?.backgroundColor === colors.pillRefusedBg) &&
      cy.props.style.some((s: any) => s?.backgroundColor === colors.pillCommittedBg) &&
      ben.props.style.some((s: any) => s?.backgroundColor === colors.pillPendingBg));
    check(`[${theme}] caption only on the group section (not the direct one)`, all.includes("Choir") && elements(tree).filter((e) => e.props.children === "Choir").length === 1 && !all.includes("null"));
    const more = byTestId(tree, "t-more")!;
    check(`[${theme}] "+50 more" pill (53 total, 3 shown): visible text and non-repeating label`, texts(more).join("") === "+50 more" && more.props.accessibilityLabel === "50 more assignees");
  }
  themeName = "light";
  const noMore = (AssigneeStatePills as any)({ sections: sections.buildPillSections(direct, 2, [], names), testIDPrefix: "t" });
  check("no more pill when moreCount is 0", !byTestId(noMore, "t-more"));
  check("direct-only: no caption text at all", texts(noMore).join("") === "✕ AnaBen");
  check("no sections -> no pills", elements((AssigneeStatePills as any)({ sections: [], testIDPrefix: "t" })).every((e) => !String(e.props.testID ?? "").includes("-pill-")));

  // ================================================================ screen render rule
  console.log("\n=== Render rule (pills vs today's display)");
  check("sections present -> pills", sections.shouldRenderPills(demoSections) === true);
  check("no sections (non-manager / older server / empty group) -> fallback to names + Refused line", sections.shouldRenderPills([]) === false);
  const fallbackSections = sections.buildPillSections([], 0, ["g1"], names);
  check("manager whose group has no members right now -> fallback (group name stays visible)", sections.shouldRenderPills(fallbackSections) === false);

  // ================================================================ contrast
  console.log("\n=== Pill contrast (WCAG), measured from the real theme tokens");
  const lum = (hex: string) => {
    const h = hex.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (fg: string, bg: string) => { const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  for (const [theme, c] of [["light", lightColors], ["dark", darkColors]] as const) {
    for (const k of ["Committed", "Refused", "Pending"] as const) {
      const fg = (c as any)[`pill${k}Text`], bg = (c as any)[`pill${k}Bg`];
      const r = ratio(fg, bg);
      check(`${theme} ${k}: ${fg} on ${bg} = ${r.toFixed(2)}:1 (>= 4.5)`, r >= 4.5);
    }
  }

  console.log(`\n${passed}/${passed + failed} checks passed${failed ? "  (" + failed + " FAILED)" : ""}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error("TEST SCRIPT ERROR", e); process.exit(1); });
