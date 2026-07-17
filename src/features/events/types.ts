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
  online_meeting_resource_id: string | null;
  online_meeting_url: string | null;
  online_meeting_platform_label: string | null;
  target: EventTargetSelector;
  event_type_id: string;
  prayer_leader_member_id: string | null;
  food_assignment: EventTargetSelector | null;
  created_at: string;
  effective_status: EffectiveEventStatus;
  rsvp_status: RsvpStatus | null;
  rsvp_reason: string | null;
  // DIP-FP-132-FP-133-FP-134: server-computed RSVP cutoff (start_datetime
  // minus the event's rsvp_closure_days override or the tenant default) —
  // confirmed live on both /api/events/mine and /api/events/:id (PR #77).
  rsvp_closure_at: string;
}

// Matches flockpulse-web's EventDetailRow (GET /api/events/:id) — confirmed
// live against the route handler's select list. Same base fields as MyEvent,
// but does NOT include rsvp_status/rsvp_reason (only /api/events/mine's list
// response appends those) — deliberately typed without them here so a
// fresh-fetch merge (`{ ...prevEvent, ...eventDetail }`) can't accidentally
// clobber an already-known RSVP with a missing field.
//
// DIP-FP-115-mobile-nav-calendar-edit: talk_id and created_by_member_id are
// both confirmed live on GET /api/events/:id's select list but NOT on
// /api/events/mine's (checked both service functions directly) — added here
// (talk_id was a pre-existing gap this DIP's edit-form prefill surfaced;
// created_by_member_id is this DIP's own addition), not on the base MyEvent
// type. This type always represents the endpoint's actual complete response
// — see ScreenEvent in events/[id].tsx for how the component that merges
// this over a partial initial-render object handles the fields not being
// known yet.
export type EventDetail = Omit<MyEvent, "rsvp_status" | "rsvp_reason"> & {
  talk_id: string | null;
  created_by_member_id: string | null;
};

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
  onlineMeetingResourceId?: string;
  onlineMeetingUrl?: string;
  onlineMeetingPlatformLabel?: string;
  target: EventTargetSelector;
  talkId?: string;
  prayerLeaderMemberId?: string;
  foodAssignment?: EventTargetSelector;
  // DIP-FP-132-FP-133-FP-134: per-event RSVP closure override, in days
  // before start_datetime. Omitted (not sent) falls back to the tenant
  // default — confirmed live against POST /api/events's route handler.
  rsvpClosureDays?: number;
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
  online_meeting_resource_id: string | null;
  online_meeting_url: string | null;
  online_meeting_platform_label: string | null;
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

// PATCH /api/events/:id request body — confirmed live against
// update_event_with_audit()'s JSONB patch handling. eventTypeId is
// deliberately NOT a field here: the route handler doesn't destructure it
// from the body at all, so event type is immutable after creation.
//
// Every optional-on-the-wire field is typed `T | null` rather than `T |
// undefined` and always sent (never omitted): the SQL uses a JSONB
// key-presence check (`p_patch ? 'talk_id'`), not a truthiness check, so an
// *omitted* key means "no change" while an explicit `null` means "clear
// it." The edit screen submits a full representation of the form on every
// save, not a sparse diff, so it always sends one or the other deliberately
// rather than relying on JSON.stringify's undefined-drops-the-key behavior.
export interface UpdateEventInput {
  name: string;
  startDatetime: string;
  endDatetime: string;
  locationName: string;
  locationAddress: string;
  locationUrl: string | null;
  onlineMeetingResourceId: string | null;
  onlineMeetingUrl: string | null;
  onlineMeetingPlatformLabel: string | null;
  target: EventTargetSelector;
  talkId: string | null;
  prayerLeaderMemberId: string | null;
  foodAssignment: EventTargetSelector | null;
  // DIP-FP-132-FP-133-FP-134: always sent (never omitted), same convention
  // as every other field on this type — null explicitly reverts the event
  // to the tenant default, matching PATCH /api/events/:id's JSONB
  // key-presence patch handling confirmed live.
  rsvpClosureDays: number | null;
}

// PATCH /api/events/:id success response — confirmed live against
// update_event_with_audit()'s RETURNS TABLE column list.
export interface UpdatedEvent {
  id: string;
  name: string;
  status: EventStatus;
  version: number;
  start_datetime: string;
  end_datetime: string;
  location_name: string;
  location_address: string;
  location_url: string | null;
  online_meeting_resource_id: string | null;
  online_meeting_url: string | null;
  online_meeting_platform_label: string | null;
  target: EventTargetSelector;
  talk_id: string | null;
  prayer_leader_member_id: string | null;
  food_assignment: EventTargetSelector | null;
  updated_at: string;
}

// Matches web's listMeetingResources() (GET /api/meeting-resources) — the
// tracked Zoom accounts available to book against.
export interface MeetingResource {
  id: string;
  name: string;
  join_url: string;
}
