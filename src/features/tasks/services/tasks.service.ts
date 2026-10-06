import { apiFetch } from "@/src/lib/api";
import type { EventTargetSelector } from "@/src/features/events/types";
import type {
  AssigneeState,
  AssigneeStateEntry,
  EventTaskAssignment,
  MyTaskAssignment,
  RefusedBy,
  Task,
  TaskResponseResult,
  TaskResponseStatus,
} from "@/src/features/tasks/types";

export async function listTasks(): Promise<Task[]> {
  return apiFetch<Task[]>("/api/tasks");
}

// GET /api/event-tasks-assignments/mine — confirmed live against the web
// PR's MyTaskAssignmentRow once it landed (DIP-FP-161-5-my-tasks-tab).
export async function listMyTaskAssignments(): Promise<MyTaskAssignment[]> {
  return apiFetch<MyTaskAssignment[]>("/api/event-tasks-assignments/mine");
}

// GET /api/event-tasks-assignments?event_id= — confirmed live against the
// route handler's req.nextUrl.searchParams.get('event_id') (snake_case).
export async function listEventTaskAssignments(eventId: string): Promise<EventTaskAssignment[]> {
  const rows = await apiFetch<EventTaskAssignment[]>(`/api/event-tasks-assignments?event_id=${eventId}`);
  return rows.map((row) => {
    const { states, total } = normalizeAssigneeStates(row.assignee_states, row.assignee_states_total);
    return { ...row, refused_by: normalizeRefusedBy(row.refused_by), assignee_states: states, assignee_states_total: total };
  });
}

const ASSIGNEE_STATES: readonly string[] = ["COMMITTED", "REFUSED", "PENDING"];

// FP-242: boundary normalizer for assignee_states / assignee_states_total. A
// non-array becomes []; entries that are not objects, have no non-empty name,
// or have an unknown state are dropped; via_group_id becomes a string or null.
// The server's order is kept (the screen must not re-sort). The total is
// trusted only when it is a finite integer at least as large as the kept
// list, otherwise the kept length is used.
export function normalizeAssigneeStates(
  states: unknown,
  total: unknown
): { states: AssigneeStateEntry[]; total: number } {
  const kept: AssigneeStateEntry[] = [];
  if (Array.isArray(states)) {
    for (const entry of states) {
      if (typeof entry !== "object" || entry === null) continue;
      const { member_id, name, state, via_group_id } = entry as Record<string, unknown>;
      if (typeof name !== "string" || name.trim() === "") continue;
      if (typeof state !== "string" || !ASSIGNEE_STATES.includes(state)) continue;
      kept.push({
        member_id: typeof member_id === "string" ? member_id : "",
        name: name.trim(),
        state: state as AssigneeState,
        via_group_id: typeof via_group_id === "string" ? via_group_id : null,
      });
    }
  }
  const safeTotal = typeof total === "number" && Number.isInteger(total) && total >= kept.length ? total : kept.length;
  return { states: kept, total: safeTotal };
}

// FP-222-adj-1: boundary normalizer — a missing, null or malformed refused_by
// (older server) becomes [], and entries without a non-empty name are dropped,
// so the screen never has to defend against it.
export function normalizeRefusedBy(value: unknown): RefusedBy[] {
  if (!Array.isArray(value)) return [];
  const result: RefusedBy[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const { member_id, name } = entry as { member_id?: unknown; name?: unknown };
    if (typeof name !== "string" || name.trim() === "") continue;
    result.push({ member_id: typeof member_id === "string" ? member_id : "", name: name.trim() });
  }
  return result;
}

// POST /api/event-tasks-assignments — confirmed live against the route
// handler's body destructuring ({ event_id, task_id, assignee }, snake_case
// on the wire despite this function's own camelCase params).
export async function createEventTaskAssignment(
  eventId: string,
  taskId: string,
  assignee: EventTargetSelector | null
): Promise<EventTaskAssignment> {
  return apiFetch<EventTaskAssignment>("/api/event-tasks-assignments", {
    method: "POST",
    body: JSON.stringify({ event_id: eventId, task_id: taskId, assignee }),
  });
}

export async function updateEventTaskAssignment(
  id: string,
  assignee: EventTargetSelector | null
): Promise<EventTaskAssignment> {
  return apiFetch<EventTaskAssignment>(`/api/event-tasks-assignments/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ assignee }),
  });
}

export async function deleteEventTaskAssignment(id: string): Promise<void> {
  return apiFetch<void>(`/api/event-tasks-assignments/${id}`, { method: "DELETE" });
}

// FP-221: POST /api/event-tasks-assignments/[id]/response — confirmed against
// the web route handler on dev. Idempotent server-side; NOT_FOUND,
// FORBIDDEN_SCOPE (not an assignee) and VALIDATION_ERROR (event no longer
// scheduled/active) surface as ApiError via apiFetch.
export async function submitTaskAssignmentResponse(
  assignmentId: string,
  status: TaskResponseStatus
): Promise<TaskResponseResult> {
  return apiFetch<TaskResponseResult>(`/api/event-tasks-assignments/${assignmentId}/response`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}
