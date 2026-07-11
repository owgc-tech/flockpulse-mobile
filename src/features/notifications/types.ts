export type ReminderOffset = "24h" | "1h";

// Matches web's EventReminderFormation exactly (GET /api/events/:id/reminder-context).
export interface EventReminderFormation {
  course_name: string;
  module_name: string;
  talk_name: string;
  talk_description: string | null;
}

// Matches web's getEventReminderContext() response: EventDetailRow + formation.
export interface EventReminderContext {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  start_datetime: string;
  end_datetime: string;
  location_name: string;
  location_address: string;
  location_url: string | null;
  talk_id: string | null;
  formation: EventReminderFormation | null;
}

// FP-97/98: distinguishes which screen a tapped notification should open.
// Optional (not required) so pre-existing scheduled notifications from
// before this field existed — created by FP-96's code, already sitting
// on-device — still route correctly: the root layout's tap handler treats
// a missing `type` as `"reminder"` for backward compatibility.
export type NotificationType = "reminder" | "self-report" | "confirmation";

// Serialized into a scheduled notification's `data` payload — same shape the
// events list screen already passes as route params to the detail screen,
// so the tap handler can reuse that exact navigation without re-fetching.
// `eventId`/`event` are omitted for `type: "confirmation"`, which needs no
// event-specific data (Grounding Check).
export interface NotificationDataPayload {
  type?: NotificationType;
  eventId?: string;
  event?: string;
}
