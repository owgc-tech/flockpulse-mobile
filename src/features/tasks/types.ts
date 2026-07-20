import type { EventTargetSelector } from "@/src/features/events/types";

// Matches flockpulse-web's TaskRow (GET /api/tasks) exactly — confirmed live
// against the route handler and repository, same "mirror the row exactly"
// convention as EventType.
export interface Task {
  id: string;
  tenant_id: string;
  name: string;
  // DIP-FP-163: when true, this task's assignee picker excludes groups
  // entirely (individuals only) — restores the constraint Prayer Leader had
  // before DIP-FP-161-3-task-wiring unified all tasks onto one picker.
  individual_only: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// Matches flockpulse-web's EventTaskAssignmentRow (GET
// /api/event-tasks-assignments?event_id=) exactly — confirmed live against
// the route handler and eventTaskAssignment.types.ts. assignee reuses
// EventTargetSelector rather than a new duplicate type, since it's the same
// { group_ids?, member_ids? } shape as web's AssigneeSelector.
export interface EventTaskAssignment {
  id: string;
  tenant_id: string;
  event_id: string;
  task_id: string;
  assignee: EventTargetSelector | null;
  created_at: string;
  updated_at: string;
}

// DIP-FP-161-3-task-wiring: the three tasks always shown on the Event
// Form/Detail (matched by name), replacing the old dedicated Prayer
// Leader/Food Assignment fields — not a schema concept, just this DIP's UI
// convention, mirrored from web's EventForm.tsx.
export const CORE_TASK_NAMES: readonly string[] = ["Prayer Leader", "Food Assignment", "Music"];
