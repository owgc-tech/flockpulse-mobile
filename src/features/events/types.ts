export type EventStatus = "DRAFT" | "SCHEDULED" | "CANCELLED";

export type EffectiveEventStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "ACTIVE"
  | "COMPLETED"
  | "LOCKED"
  | "CANCELLED";

export type RsvpStatus = "YES" | "NO";

export interface EventTargetSelector {
  group_ids?: string[];
  member_ids?: string[];
}

// Matches flockpulse-web's EventListRow (app/api/events/mine), confirmed
// live — flat, snake_case, no nesting for the appended RSVP fields.
export interface MyEvent {
  id: string;
  name: string;
  status: EventStatus;
  start_datetime: string;
  end_datetime: string;
  location_name: string;
  location_address: string;
  location_url: string | null;
  target: EventTargetSelector;
  event_type_id: string;
  prayer_leader_member_id: string | null;
  food_assignment: EventTargetSelector | null;
  created_at: string;
  effective_status: EffectiveEventStatus;
  rsvp_status: RsvpStatus | null;
  rsvp_reason: string | null;
}

// Matches flockpulse-web's EventDetailRow (GET /api/events/:id) — confirmed
// live against the route handler. Same base fields as MyEvent, but does NOT
// include rsvp_status/rsvp_reason (only /api/events/mine's list response
// appends those) — deliberately typed without them here so a fresh-fetch
// merge (`{ ...prevEvent, ...eventDetail }`) can't accidentally clobber an
// already-known RSVP with a missing field.
export type EventDetail = Omit<MyEvent, "rsvp_status" | "rsvp_reason">;

// Matches flockpulse-web's RsvpResponse (POST /api/rsvps success body).
export interface RsvpResponse {
  id: string;
  event_id: string;
  member_id: string;
  rsvp_status: RsvpStatus;
  rsvp_reason: string | null;
  responded_at: string;
  is_late: false;
}

export type RosterResponseValue = "ACCEPTED" | "DECLINED" | "NOT_RESPONDED";

// Matches flockpulse-web's RosterEntry (GET /api/events/:id/roster) exactly.
export interface RosterEntry {
  member_id: string;
  first_name: string;
  last_name: string;
  response: RosterResponseValue;
  rsvp_reason: string | null;
}

// Matches flockpulse-web's POST /api/events request body exactly — the
// outer body is camelCase, but confirmed live that target/foodAssignment's
// *inner* keys stay snake_case (group_ids/member_ids), same shape as
// EventTargetSelector above.
export interface CreateEventInput {
  eventTypeId: string;
  name: string;
  startDatetime: string;
  endDatetime: string;
  locationName: string;
  locationAddress: string;
  locationUrl?: string;
  target: EventTargetSelector;
  talkId?: string;
  prayerLeaderMemberId?: string;
  foodAssignment?: EventTargetSelector;
}

// POST /api/events success response — confirmed live. status is always
// 'DRAFT' (hardcoded server-side in insert_event_with_audit).
export interface CreatedEvent {
  id: string;
  name: string;
  status: EventStatus;
  start_datetime: string;
  end_datetime: string;
  location_name: string;
  location_address: string;
  location_url: string | null;
  target: EventTargetSelector;
  talk_id: string | null;
  prayer_leader_member_id: string | null;
  food_assignment: EventTargetSelector | null;
  created_at: string;
  created_by_member_id: string;
}

// POST /api/events/:id/publish success response — confirmed live, a
// smaller field set than CreatedEvent. status is 'SCHEDULED' on success.
export interface PublishedEvent {
  id: string;
  name: string;
  status: EventStatus;
  start_datetime: string;
  end_datetime: string;
}
