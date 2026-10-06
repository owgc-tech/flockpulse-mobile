import { Linking, Platform } from "react-native";
import type { MyEvent, RsvpStatus } from "@/src/features/events/types";
import type { ThemeColors } from "@/src/theme/colors";
import { CORE_TASK_NAMES } from "@/src/features/tasks/types";
import type { EventTaskAssignment } from "@/src/features/tasks/types";
import type { TargetSelection } from "@/src/features/shared/components/MemberGroupPicker";

// DIP-FP-147: prefer whatever's actually installed/preferred on-device
// instead of always handing off to a Google Maps web URL, which on iOS
// triggers an App Store redirect if Google Maps isn't installed. iOS has no
// true default-app setting exposed to apps, so "prefer Google Maps if
// installed, else Apple Maps" is the closest approximation of user intent;
// Android's geo: scheme genuinely does resolve to the OS-level default.
// Async because the iOS installed-check (Linking.canOpenURL) is inherently
// async — requires "comgooglemaps" under ios.infoPlist.LSApplicationQueriesSchemes
// in app.json (iOS 9+ privacy restriction) or canOpenURL always returns
// false regardless of what's actually installed. That's a native config
// change, not shippable via eas update — needs an actual EAS Build.
export async function getMapUrl(event: MyEvent): Promise<string> {
  const query = encodeURIComponent(event.location_address);

  try {
    if (Platform.OS === "ios") {
      const canOpenGoogleMaps = await Linking.canOpenURL(`comgooglemaps://?q=${query}`);
      if (canOpenGoogleMaps) {
        return `comgooglemaps://?q=${query}`;
      }
      return `http://maps.apple.com/?q=${query}`;
    }

    if (Platform.OS === "android") {
      return `geo:0,0?q=${query}`;
    }
  } catch (err) {
    console.warn("Failed to resolve native maps URL:", err);
  }

  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

// DIP-FP-132-FP-133-FP-134: single source of truth for "is RSVP still
// open," shared by RsvpControls' prompt (via EventListItem/Event Detail)
// and the Event Detail screen's editable gate — replaces the old
// effective_status === "SCHEDULED"-only check with closure-cutoff
// awareness now that rsvp_closure_at is server-computed (PR #77).
export function isRsvpWindowOpen(event: Pick<MyEvent, "effective_status" | "rsvp_closure_at">): boolean {
  return event.effective_status === "SCHEDULED" && Date.now() < new Date(event.rsvp_closure_at).getTime();
}

// DIP-FP-143: shared Accept=green/Decline=red/Tentative=amber/No
// response=grey mapping for every mobile surface keyed off RsvpStatus
// (EventListItem, RsvpControls, self-report) — RosterList uses its own
// RosterResponseValue type and getResponseColors(), left as-is.
export function getRsvpStatusColor(colors: ThemeColors, status: RsvpStatus | null): string {
  switch (status) {
    case "YES":
      return colors.success;
    case "NO":
      return colors.danger;
    case "TENTATIVE":
      return colors.warning;
    default:
      return colors.textMuted;
  }
}

// ---------------------------------------------------------------------------
// FP-222-mobile: Needs Attention / Recently Modified indicators
// ---------------------------------------------------------------------------

export interface EventIndicatorFields {
  needs_attention: boolean;
  needs_attention_tasks: string[];
  is_modified: boolean;
  modified_fields: string[];
}

function toStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];
}

// The boundary where server responses are read (events.service.ts): a server
// that predates web part 1 / adj-1 simply omits these fields, and one that is
// partway through (flags but no labels) omits the lists — treat every missing
// or malformed value as "no indicator" so an older server never breaks a screen.
export function normalizeEventIndicators<T extends object>(raw: T): T & EventIndicatorFields {
  const r = raw as Partial<EventIndicatorFields>;
  return {
    ...raw,
    needs_attention: r.needs_attention === true,
    needs_attention_tasks: toStringList(r.needs_attention_tasks),
    is_modified: r.is_modified === true,
    modified_fields: toStringList(r.modified_fields),
  };
}

// "Food Assignment refused" / "Food Assignment, Music refused" /
// "Food Assignment, Music +1 more refused". No task names (the server did not
// send any) -> no line at all; the strip then shows only its title.
export function formatNeedsAttentionSummary(tasks: string[]): string | null {
  if (tasks.length === 0) return null;
  if (tasks.length <= 2) return `${tasks.join(", ")} refused`;
  return `${tasks[0]}, ${tasks[1]} +${tasks.length - 2} more refused`;
}

// "Changed: Date & time, Location"; no labels -> no line.
export function formatModifiedSummary(labels: string[]): string | null {
  if (labels.length === 0) return null;
  return `Changed: ${labels.join(", ")}`;
}

// Spoken forms ("&" is read as "and"; the visible strip keeps the ampersand).
export function getNeedsAttentionA11yLabel(tasks: string[]): string {
  const summary = formatNeedsAttentionSummary(tasks);
  return summary ? `Needs attention: ${summary}` : "Needs attention";
}

export function getModifiedA11yLabel(labels: string[]): string {
  const summary = formatModifiedSummary(labels);
  return summary ? `Recently modified. ${summary.replace(/&/g, "and")}` : "Recently modified";
}

// DIP-FP-165 / FP-191-mobile-adj-4 / FP-223-mobile-adj-1, moved here from
// (tabs)/index.tsx WITHOUT changing the rule. Derived locally from the list
// already in state (rsvp_status / effective_status / rsvp_closure_at all
// present) rather than a separate fetch, so it can never disagree with what the
// list is showing. Announcements contribute via !acknowledged_at alone (no
// isRsvpWindowOpen-style time gating — acknowledging is never gated by time);
// every other event keeps its exact rsvp_status / isRsvpWindowOpen logic. An
// Admin or owning Leader can see events they were never invited to (FP-223), so
// is_attendee false means those events must not contribute regardless of
// rsvp_status / isRsvpWindowOpen.
export function getPendingRsvpCount(events: MyEvent[]): number {
  return events.filter((e) =>
    e.event_type?.system_key === "ANNOUNCEMENT"
      ? !e.acknowledged_at
      : !e.rsvp_status && e.is_attendee && isRsvpWindowOpen(e)
  ).length;
}

// The Events tab badge: the existing pending RSVP / acknowledgement count plus
// the number of events that need attention (decided by the server, and only ever
// true for the event's owner and Admins).
export function getEventsBadgeCount(events: MyEvent[]): number {
  return getPendingRsvpCount(events) + events.filter((e) => e.needs_attention === true).length;
}

// Opening an event records a view; the list then drops that card's Recently
// Modified strip locally (no network call). Needs Attention is never touched —
// viewing does not resolve a refusal.
export function applyViewedEvents(events: MyEvent[], viewedIds: string[]): MyEvent[] {
  if (viewedIds.length === 0) return events;
  const viewed = new Set(viewedIds);
  return events.map((e) =>
    viewed.has(e.id) && (e.is_modified || (e.modified_fields?.length ?? 0) > 0)
      ? { ...e, is_modified: false, modified_fields: [] }
      : e
  );
}

// FP-219-mobile: mirrors web's validateLocationAddress (event.types.ts) so the
// two clients reject the same input — a length cap plus a rejection of
// obviously-junk input (blank, or one character repeated throughout, e.g.
// "aaaaaaaa"). Shared by create.tsx and edit.tsx so the two screens can't
// drift. Not real address verification; server-side enforcement already
// covers both apps since they call the same routes.
export const LOCATION_ADDRESS_MAX_LENGTH = 200;

export function validateLocationAddress(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Location address is required";
  if (value.length > LOCATION_ADDRESS_MAX_LENGTH) {
    return `Location address must be ${LOCATION_ADDRESS_MAX_LENGTH} characters or fewer`;
  }
  if (/^([\s\S])\1*$/u.test(trimmed)) return "Enter a valid location address";
  return null;
}

// FP-234: same behavior as flockpulse-web's sameIds (EventForm.tsx) — order
// never matters, only membership.
export function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((id, i) => id === sb[i]);
}

// FP-234: core tasks (Food Assignment, Prayer Leader, Music) are never
// removable from an event, exactly like web.
export function isRemovableTask(taskName: string): boolean {
  return !CORE_TASK_NAMES.includes(taskName);
}

export interface TaskAssignmentOp {
  kind: "create" | "update" | "delete";
  taskId: string;
  taskName: string;
  assignmentId?: string;
  selection?: TargetSelection;
}

interface TaskRef {
  id: string;
  name: string;
}

// FP-234: decides what the edit screen's Save must send for task
// assignments. `existing` must be the rows as loaded from the server (not
// edited state): an unchanged assignment (same group_ids and member_ids,
// order ignored) produces no op at all. Covers displayed tasks plus removed
// tasks that already have an assignment (web's "visible UNION already
// assigned"), so removing a row deletes its stored assignment on Save and
// sends nothing when it had none. Only tasks explicitly in `removedTasks`
// are ever deleted this way — a task merely missing from the catalog is left
// alone.
export function planTaskAssignmentOps(args: {
  displayedTasks: TaskRef[];
  removedTasks: TaskRef[];
  existing: EventTaskAssignment[];
  getSelection: (taskId: string) => TargetSelection;
}): TaskAssignmentOp[] {
  const ops: TaskAssignmentOp[] = [];
  const displayedIds = new Set(args.displayedTasks.map((t) => t.id));

  for (const task of args.displayedTasks) {
    const existing = args.existing.find((a) => a.task_id === task.id);
    const selection = args.getSelection(task.id);
    const hasSelection = selection.group_ids.length > 0 || selection.member_ids.length > 0;

    if (existing && !hasSelection) {
      ops.push({ kind: "delete", taskId: task.id, taskName: task.name, assignmentId: existing.id });
    } else if (existing && hasSelection) {
      const loaded = existing.assignee;
      const unchanged =
        sameIds(loaded?.group_ids ?? [], selection.group_ids) &&
        sameIds(loaded?.member_ids ?? [], selection.member_ids);
      if (!unchanged) {
        ops.push({ kind: "update", taskId: task.id, taskName: task.name, assignmentId: existing.id, selection });
      }
    } else if (!existing && hasSelection) {
      ops.push({ kind: "create", taskId: task.id, taskName: task.name, selection });
    }
  }

  for (const task of args.removedTasks) {
    if (displayedIds.has(task.id)) continue;
    const existing = args.existing.find((a) => a.task_id === task.id);
    if (existing) {
      ops.push({ kind: "delete", taskId: task.id, taskName: task.name, assignmentId: existing.id });
    }
  }

  return ops;
}

export interface TaskAssignmentExecutor {
  create: (taskId: string, selection: TargetSelection) => Promise<unknown>;
  update: (assignmentId: string, selection: TargetSelection) => Promise<unknown>;
  delete: (assignmentId: string) => Promise<unknown>;
}

export interface TaskAssignmentFailure {
  taskName: string;
  message: string;
}

// FP-234: attempts every op (one failure never stops the others) and
// returns the failures by task name.
export async function runTaskAssignmentOps(
  ops: TaskAssignmentOp[],
  executor: TaskAssignmentExecutor
): Promise<TaskAssignmentFailure[]> {
  const results = await Promise.allSettled(
    ops.map((op) => {
      if (op.kind === "delete") return executor.delete(op.assignmentId!);
      if (op.kind === "update") return executor.update(op.assignmentId!, op.selection!);
      return executor.create(op.taskId, op.selection!);
    })
  );

  const failures: TaskAssignmentFailure[] = [];
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      const reason = result.reason;
      failures.push({
        taskName: ops[i].taskName,
        message: reason instanceof Error ? reason.message : "Something went wrong.",
      });
    }
  });
  return failures;
}

export function formatTaskAssignmentFailures(failures: TaskAssignmentFailure[]): string {
  return `Event updated but these task assignments could not be saved: ${failures
    .map((f) => `${f.taskName}: ${f.message}`)
    .join("; ")}`;
}

// FP-240: every role that can open an event sees the RSVP roster; the server
// decides what each person may see (decline reasons, removed members). Still
// returns false until the role is known, so the section never flashes in for
// a screen whose session is still resolving.
export function shouldShowRoster(role: string | undefined): boolean {
  return role !== undefined;
}
