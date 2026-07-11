import { apiFetch } from "@/src/lib/api";
import type { EventReminderContext } from "@/src/features/notifications/types";

// No spec'd limit on notification body length — defensive truncation is a
// practical judgment call, not an AC requirement.
const MAX_TALK_DESCRIPTION_LENGTH = 120;

export async function fetchReminderContext(eventId: string): Promise<EventReminderContext> {
  return apiFetch<EventReminderContext>(`/api/events/${eventId}/reminder-context`);
}

function formatReminderDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

export function buildReminderContent(context: EventReminderContext): { title: string; body: string } {
  const lines = [formatReminderDateTime(context.start_datetime), context.location_name];

  if (context.formation) {
    const { course_name, module_name, talk_name, talk_description } = context.formation;
    lines.push(`${course_name} › ${module_name} › ${talk_name}`);
    if (talk_description) {
      lines.push(truncate(talk_description, MAX_TALK_DESCRIPTION_LENGTH));
    }
  }

  return { title: context.name, body: lines.join("\n") };
}
