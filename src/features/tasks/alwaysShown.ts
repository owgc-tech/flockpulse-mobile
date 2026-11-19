import type { Task } from "@/src/features/tasks/types";

// FP-261: whether a task is shown automatically on the create/edit event
// screens. Driven by the server's per-task "Always show on events" setting.
// A missing field (older server) is treated as false.
export function isAlwaysShown(task: Task): boolean {
  return task.always_show === true;
}
