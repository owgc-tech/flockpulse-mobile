import { apiFetch } from "@/src/lib/api";
import type { EventTargetSelector } from "@/src/features/events/types";
import type {
  EventTaskAssignment,
  MyTaskAssignment,
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
  return apiFetch<EventTaskAssignment[]>(`/api/event-tasks-assignments?event_id=${eventId}`);
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
