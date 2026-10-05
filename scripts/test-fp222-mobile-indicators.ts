/**
 * FP-222 (mobile, part 2) — Needs Attention / Recently Modified: standalone checks
 *
 * No test runner exists in this repo, so this is a plain script. The real
 * helpers, service functions and signal are imported; only the modules that
 * cannot load under Node are stubbed:
 *   - "react-native"   (utils.ts imports Linking/Platform)
 *   - "@/src/lib/api"  (apiFetch is replaced by a recording mock)
 *
 * Covers: the summary and Changed lines (1, 2, 3+ items, none), the accessibility
 * labels, the badge count rule, the boundary normalizer for a server that omits
 * the new fields, the exact shape of the recordEventView request, the
 * list-clearing helper and its signal, and the measured contrast ratios of the
 * banner colour tokens.
 *
 * Run:  npx tsx scripts/test-fp222-mobile-indicators.ts
 */

// No @types/node in this project (tsconfig includes scripts/), so Node's module loader is
// reached through a plain require instead of a typed import.
declare const require: (id: string) => any;
const Module = require("module");

// ---------------------------------------------------------------- stubs
type ApiCall = { path: string; init?: RequestInit };
const apiCalls: ApiCall[] = [];
let apiHandler: (path: string, init?: RequestInit) => unknown | Promise<unknown> = () => undefined;

const stubs: Record<string, unknown> = {
  "react-native": {
    Linking: { canOpenURL: async () => false, openURL: async () => undefined },
    Platform: { OS: "ios" },
  },
  "@/src/lib/api": {
    apiFetch: async (path: string, init?: RequestInit) => {
      apiCalls.push({ path, init });
      return apiHandler(path, init);
    },
  },
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

// ---------------------------------------------------------------- fixtures
const DAY = 864e5;
function ev(over: Record<string, unknown> = {}): any {
  return {
    id: "e-" + Math.random().toString(36).slice(2, 8),
    name: "Event", status: "SCHEDULED",
    start_datetime: new Date(Date.now() + 5 * DAY).toISOString(),
    end_datetime: new Date(Date.now() + 5 * DAY + 72e5).toISOString(),
    location_name: "Hall", location_address: "1 Main St",
    online_meeting_resource_id: null, online_meeting_url: null, online_meeting_platform_label: null,
    target: {}, event_type_id: "t1", created_at: new Date().toISOString(),
    effective_status: "SCHEDULED", rsvp_status: null, rsvp_reason: null,
    rsvp_closure_at: new Date(Date.now() + 2 * DAY).toISOString(),
    announcement_body: null, event_type: { id: "t1", name: "Meeting", system_key: null },
    created_by_member: null, acknowledged_at: null, guests_allowed: false, is_attendee: true,
    needs_attention: false, needs_attention_tasks: [], is_modified: false, modified_fields: [],
    ...over,
  };
}

async function main() {
  const utils = await import("../src/features/events/utils");
  const service = await import("../src/features/events/services/events.service");
  const signal = await import("../src/features/events/eventViewedSignal");
  const { lightColors, darkColors } = await import("../src/theme/colors");

  // ================================================================ summary lines
  console.log("\n=== Needs Attention summary line");
  check('1 task:  "Food Assignment refused"', utils.formatNeedsAttentionSummary(["Food Assignment"]) === "Food Assignment refused");
  check('2 tasks: "Food Assignment, Music refused"', utils.formatNeedsAttentionSummary(["Food Assignment", "Music"]) === "Food Assignment, Music refused");
  check('3 tasks: "Food Assignment, Music +1 more refused"', utils.formatNeedsAttentionSummary(["Food Assignment", "Music", "Prayer Leader"]) === "Food Assignment, Music +1 more refused");
  check('5 tasks: "Food Assignment, Music +3 more refused"', utils.formatNeedsAttentionSummary(["Food Assignment", "Music", "A", "B", "C"]) === "Food Assignment, Music +3 more refused");
  check("no task names: no line (null)", utils.formatNeedsAttentionSummary([]) === null);

  console.log("\n=== Recently Modified line");
  check('1 label:  "Changed: Location"', utils.formatModifiedSummary(["Location"]) === "Changed: Location");
  check('2 labels: "Changed: Date & time, Location"', utils.formatModifiedSummary(["Date & time", "Location"]) === "Changed: Date & time, Location");
  check('3 labels: all listed, in order', utils.formatModifiedSummary(["Date & time", "Location", "Name"]) === "Changed: Date & time, Location, Name");
  check("no labels: no line (null)", utils.formatModifiedSummary([]) === null);

  console.log("\n=== Accessibility labels");
  check('"Needs attention: Food Assignment refused"', utils.getNeedsAttentionA11yLabel(["Food Assignment"]) === "Needs attention: Food Assignment refused");
  check('"Needs attention" when no task names', utils.getNeedsAttentionA11yLabel([]) === "Needs attention");
  check('"Recently modified. Changed: Date and time, Location" (ampersand spoken as "and")', utils.getModifiedA11yLabel(["Date & time", "Location"]) === "Recently modified. Changed: Date and time, Location");
  check('"Recently modified" when no labels', utils.getModifiedA11yLabel([]) === "Recently modified");

  // ================================================================ badge count
  console.log("\n=== Badge count rule");
  const pendingRsvp = () => ev();                                                   // attendee, no response, window open
  const responded = () => ev({ rsvp_status: "YES" });
  const notInvited = () => ev({ is_attendee: false });                              // Admin/owner widening: not a pending RSVP
  const closedWindow = () => ev({ rsvp_closure_at: new Date(Date.now() - DAY).toISOString() });
  const unackAnnouncement = () => ev({ event_type: { id: "a", name: "Announcement", system_key: "ANNOUNCEMENT" }, acknowledged_at: null, is_attendee: false });
  const ackAnnouncement = () => ev({ event_type: { id: "a", name: "Announcement", system_key: "ANNOUNCEMENT" }, acknowledged_at: "2026-01-01T00:00:00Z" });
  const needsAttentionOnly = () => ev({ needs_attention: true, needs_attention_tasks: ["Music"], is_attendee: false, rsvp_status: "YES" });
  const needsAttentionAndPending = () => ev({ needs_attention: true, needs_attention_tasks: ["Music"] });   // also an unanswered RSVP

  check("empty list: 0", utils.getEventsBadgeCount([]) === 0);
  check("pending RSVP counts 1", utils.getEventsBadgeCount([pendingRsvp()]) === 1);
  check("responded / not invited / closed window do not count", utils.getEventsBadgeCount([responded(), notInvited(), closedWindow()]) === 0);
  check("unacknowledged announcement counts, acknowledged does not", utils.getEventsBadgeCount([unackAnnouncement(), ackAnnouncement()]) === 1);
  check("an event that needs attention counts 1 on its own", utils.getEventsBadgeCount([needsAttentionOnly()]) === 1);
  check("the existing count is unchanged when nothing needs attention (same rule, moved)",
    utils.getPendingRsvpCount([pendingRsvp(), pendingRsvp(), responded(), unackAnnouncement(), ackAnnouncement(), notInvited()]) === 3
    && utils.getEventsBadgeCount([pendingRsvp(), pendingRsvp(), responded(), unackAnnouncement(), ackAnnouncement(), notInvited()]) === 3);
  check("pending RSVP + announcement + needs attention add up (2 + 1 + 1 = 4)",
    utils.getEventsBadgeCount([pendingRsvp(), pendingRsvp(), unackAnnouncement(), needsAttentionOnly(), responded()]) === 4);
  check("an event that is both a pending RSVP and needs attention counts in BOTH parts (2)", utils.getEventsBadgeCount([needsAttentionAndPending()]) === 2);
  check("is_modified never affects the badge", utils.getEventsBadgeCount([ev({ is_modified: true, modified_fields: ["Location"], rsvp_status: "YES" })]) === 0);

  // ================================================================ normalizer
  console.log("\n=== Boundary normalizer (older server)");
  const old = { id: "x", name: "Old server event" };
  const n1 = utils.normalizeEventIndicators(old);
  check("all four fields omitted -> false / [] / false / []", n1.needs_attention === false && eq(n1.needs_attention_tasks, []) && n1.is_modified === false && eq(n1.modified_fields, []));
  check("the other fields are preserved and the input is not mutated", n1.id === "x" && n1.name === "Old server event" && !("needs_attention" in old));
  const n2 = utils.normalizeEventIndicators({ needs_attention: true, is_modified: true });
  check("flags without lists (server partway through): flags kept, lists []", n2.needs_attention === true && n2.is_modified === true && eq(n2.needs_attention_tasks, []) && eq(n2.modified_fields, []));
  const n3 = utils.normalizeEventIndicators({ needs_attention: "yes", is_modified: 1, needs_attention_tasks: "Music", modified_fields: [1, null, "Location", " "] } as any);
  check("malformed values: only an actual true counts; non-arrays -> []; non-strings and blanks dropped", n3.needs_attention === false && n3.is_modified === false && eq(n3.needs_attention_tasks, []) && eq(n3.modified_fields, ["Location"]));
  const n4 = utils.normalizeEventIndicators({ needs_attention: true, needs_attention_tasks: ["Food Assignment"], is_modified: true, modified_fields: ["Date & time"] });
  check("a complete response passes through unchanged", n4.needs_attention && eq(n4.needs_attention_tasks, ["Food Assignment"]) && n4.is_modified && eq(n4.modified_fields, ["Date & time"]));

  apiCalls.length = 0;
  apiHandler = (path) => (path === "/api/events/mine" ? [{ id: "a" }, { id: "b", is_modified: true, modified_fields: ["Location"] }] : { id: "d", version: 4 });
  const list = await service.listMyEvents();
  check("listMyEvents(): an older server's rows come back with the defaults on every row", list.length === 2 && list.every((e) => e.needs_attention === false && Array.isArray(e.needs_attention_tasks) && e.is_modified === (e.id === "b")));
  check("listMyEvents(): still calls GET /api/events/mine", apiCalls[0]?.path === "/api/events/mine" && apiCalls[0]?.init === undefined);
  const detail = await service.getEventById("d");
  check("getEventById(): defaults applied, version kept", detail.needs_attention === false && eq(detail.modified_fields, []) && detail.version === 4);

  // ================================================================ recordEventView
  console.log("\n=== recordEventView request");
  apiCalls.length = 0;
  apiHandler = () => ({ version: 7 });                                      // web adj-1: 200 { data: { version } } -> apiFetch returns .data
  await service.recordEventView("evt-1", 7);
  const c = apiCalls[0];
  check("POST /api/events/evt-1/view", c?.path === "/api/events/evt-1/view" && c?.init?.method === "POST");
  check('body is exactly {"version":7}', c?.init?.body === '{"version":7}');
  check("exactly one request, and no headers / retry of its own (auth lives in apiFetch)", apiCalls.length === 1 && c?.init?.headers === undefined && Object.keys(c?.init ?? {}).sort().join() === "body,method");
  apiCalls.length = 0;
  await service.recordEventView("evt-2");
  check('no version -> body is exactly {}', apiCalls[0]?.init?.body === "{}");
  apiHandler = () => { throw new SyntaxError("JSON Parse error: Unexpected end of input"); };   // web part 1: 204 with no body
  let threw = false;
  try { await service.recordEventView("evt-3", 1); } catch { threw = true; }
  check("a 204 / empty body (apiFetch's SyntaxError) counts as success (works against web part 1 and adj-1)", !threw);
  apiHandler = () => { const e = new Error("You do not have access to this event") as Error & { code: string }; e.code = "FORBIDDEN_SCOPE"; throw e; };
  let code = "";
  try { await service.recordEventView("evt-4", 1); } catch (e) { code = (e as { code?: string }).code ?? ""; }
  check("a real failure (ApiError-style, e.g. 403 FORBIDDEN_SCOPE) is rethrown for the caller to warn about", code === "FORBIDDEN_SCOPE");
  apiHandler = () => { throw new TypeError("Network request failed"); };
  let netErr = false;
  try { await service.recordEventView("evt-5", 1); } catch (e) { netErr = e instanceof TypeError; }
  check("a network failure is rethrown too (not swallowed)", netErr);

  // ================================================================ clearing + signal
  console.log("\n=== Clearing the card after a view (list signal)");
  const a = ev({ id: "a", is_modified: true, modified_fields: ["Location"], needs_attention: true, needs_attention_tasks: ["Music"] });
  const b = ev({ id: "b", is_modified: true, modified_fields: ["Date & time"] });
  const cEv = ev({ id: "c" });
  const out = utils.applyViewedEvents([a, b, cEv], ["a"]);
  check("the viewed card loses Recently Modified and its labels", out[0].is_modified === false && eq(out[0].modified_fields, []));
  check("Needs Attention on the viewed card is untouched (viewing never changes it)", out[0].needs_attention === true && eq(out[0].needs_attention_tasks, ["Music"]));
  check("other cards are the very same objects, untouched", out[1] === b && out[2] === cEv);
  const same = [a, b];
  check("no ids returns the identical array (no needless re-render)", utils.applyViewedEvents(same, []) === same);
  check("input array not mutated", a.is_modified === true && b.is_modified === true);

  check("signal: nothing pending at first", signal.consumeViewedEventIds().length === 0);
  signal.notifyEventViewed("e1"); signal.notifyEventViewed("e2"); signal.notifyEventViewed("e1");
  const ids = signal.consumeViewedEventIds();
  check("signal: consume returns each viewed id once", ids.length === 2 && ids.includes("e1") && ids.includes("e2"));
  check("signal: consuming clears it", signal.consumeViewedEventIds().length === 0);

  // ================================================================ contrast
  console.log("\n=== Banner colour contrast (WCAG), measured from the real theme tokens");
  const lum = (hex: string) => {
    const h = hex.replace("#", ""); const n = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
    const [r, g, bl] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const ratio = (fg: string, bg: string) => { const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const combos: [string, string, string][] = [
    ["Needs Attention, light theme", lightColors.onDanger, lightColors.danger],
    ["Needs Attention, dark theme", darkColors.onDanger, darkColors.danger],
    ["Recently Modified, light theme", lightColors.onWarning, lightColors.warning],
    ["Recently Modified, dark theme", darkColors.onWarning, darkColors.warning],
  ];
  for (const [label, fg, bg] of combos) {
    const r = ratio(fg, bg);
    check(`${label}: ${fg} on ${bg} = ${r.toFixed(2)}:1 (>= 4.5)`, r >= 4.5);
  }

  console.log(`\n${passed}/${passed + failed} checks passed${failed ? "  (" + failed + " FAILED)" : ""}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error("TEST SCRIPT ERROR", e); process.exit(1); });
