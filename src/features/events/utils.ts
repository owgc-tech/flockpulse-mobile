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
