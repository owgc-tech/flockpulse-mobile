import { apiFetch } from "@/src/lib/api";
import type { EventType } from "@/src/features/event-types/types";

export async function listEventTypes(): Promise<EventType[]> {
  return apiFetch<EventType[]>("/api/event-types");
}
