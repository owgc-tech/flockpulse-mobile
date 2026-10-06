/**
 * FP-240 (mobile) — roster for every role: standalone checks
 *
 * No test runner exists in this repo, so this is a plain script. The real
 * shouldShowRoster() and the real RosterList component function are imported;
 * only modules that cannot load under Node are stubbed (react-native, react's
 * element creation/useMemo, the theme hook). RosterList is called as a plain
 * function and the element tree it returns is walked for text.
 *
 * Run:  npx tsx scripts/test-fp240-mobile.ts
 */

declare const require: (id: string) => any;
const Module = require("module");

type El = { type: unknown; props: Record<string, any> };
const createElement = (type: unknown, props: Record<string, any> | null, ...children: unknown[]): El => ({
  type,
  props: { ...(props ?? {}), ...(children.length ? { children: children.length === 1 ? children[0] : children } : {}) },
});
const jsx = (type: unknown, props: Record<string, any>, key?: unknown): El => ({ type, props: { ...props, key } });

const stubs: Record<string, unknown> = {
  "react-native": {
    Linking: {}, Platform: { OS: "ios" },
    StyleSheet: { create: (o: unknown) => o },
    Text: "Text", View: "View",
  },
  react: { useMemo: (fn: () => unknown) => fn(), createElement, Fragment: "Fragment" },
  "@/src/theme/useThemeColors": {
    useThemeColors: () => require("../src/theme/colors").lightColors,
  },
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

// Collect every string rendered anywhere in the element tree.
function texts(node: any, out: string[] = []): string[] {
  if (node === null || node === undefined || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") { out.push(String(node)); return out; }
  if (Array.isArray(node)) { node.forEach((n) => texts(n, out)); return out; }
  if (typeof node === "object" && "props" in node) texts(node.props?.children, out);
  return out;
}

const entry = (over: Record<string, unknown> = {}): any => ({
  member_id: "m1", first_name: "Ana", last_name: "Cruz", response: "ACCEPTED", rsvp_reason: null, guest_count: 0, ...over,
});

async function main() {
  const { shouldShowRoster } = await import("../src/features/events/utils");
  const { RosterList } = await import("../src/features/events/components/RosterList");
  const render = (entries: any[]) => texts((RosterList as any)({ entries }));

  console.log("\n=== shouldShowRoster(role)");
  check("MEMBER -> shown (this used to be hidden)", shouldShowRoster("MEMBER") === true);
  check("LEADER -> shown", shouldShowRoster("LEADER") === true);
  check("PASTORAL_LEADER -> shown", shouldShowRoster("PASTORAL_LEADER") === true);
  check("ADMIN -> shown", shouldShowRoster("ADMIN") === true);
  check("undefined role (session still resolving) -> hidden", shouldShowRoster(undefined) === false);

  console.log("\n=== RosterList reason rule");
  const withReason = render([entry({ response: "DECLINED", rsvp_reason: "Out of town" })]);
  check("declined with a reason -> reason shown", withReason.includes("Out of town"));
  const redacted = render([entry({ response: "DECLINED", rsvp_reason: null })]);
  check("declined, reason redacted by the server (null) -> no reason line", !redacted.some((t) => /Out of town/.test(t)) && redacted.includes("Declined"));
  const baseline = render([entry({ response: "DECLINED", rsvp_reason: null })]);
  const emptyReason = render([entry({ response: "DECLINED", rsvp_reason: "" })]);
  check("declined, empty reason -> same output as no reason (no extra line)", JSON.stringify(emptyReason) === JSON.stringify(baseline));
  const acceptedWithStaleReason = render([entry({ response: "ACCEPTED", rsvp_reason: "leftover" })]);
  check("not declined -> reason never shown even if present", !acceptedWithStaleReason.includes("leftover"));
  const guests = render([entry({ guest_count: 2 })]);
  check("positive guest_count -> +N suffix (unchanged)", guests.includes(" +2"));
  const emptyList = render([]);
  check("empty roster -> existing empty message (unchanged)", emptyList.includes("No one has been invited to this event yet."));
  const mixed = render([
    entry({ member_id: "m1", first_name: "Ana", response: "DECLINED", rsvp_reason: "Sick" }),
    entry({ member_id: "m2", first_name: "Ben", response: "DECLINED", rsvp_reason: null }),
  ]);
  check("two decliners: only the one with a reason shows one", mixed.filter((t) => t === "Sick").length === 1 && mixed.filter((t) => t === "Declined").length === 2);

  console.log(`\n${passed}/${passed + failed} checks passed${failed ? "  (" + failed + " FAILED)" : ""}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error("TEST SCRIPT ERROR", e); process.exit(1); });
