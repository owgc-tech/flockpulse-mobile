import { apiFetch } from "@/src/lib/api";
import type { Course, FormationModule, Talk } from "@/src/features/formation/types";

export async function listCourses(): Promise<Course[]> {
  return apiFetch<Course[]>("/api/courses");
}

export async function listModules(courseId: string): Promise<FormationModule[]> {
  return apiFetch<FormationModule[]>(`/api/modules?course_id=${courseId}`);
}

export async function listTalks(moduleId: string): Promise<Talk[]> {
  return apiFetch<Talk[]>(`/api/talks?module_id=${moduleId}`);
}

// Display-name convention confirmed live from getEventReminderContext()'s
// same alias-or-name fallback, applied consistently at all three levels.
export function formationDisplayName(item: { name: string; alias: string | null }): string {
  return item.alias || item.name;
}
