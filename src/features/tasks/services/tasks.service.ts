import { apiFetch } from "@/src/lib/api";
import type { EventTargetSelector } from "@/src/features/events/types";
import type { EventTaskAssignment, MyTaskAssignment, Task } from "@/src/features/tasks/types";

export async function listTasks(): Promise<Task[]> {
  return apiFetch<Task[]>("/api/tasks");
}

// GET /api/event-tasks-assignments/mine — DIP-FP-161-5-my-tasks-tab. See
// MyTaskAssignment's own doc comment: this endpoint's response shape is
// PROPOSED, not yet confirmed live (the web PR hadn't been built at the
// time this was written).
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
