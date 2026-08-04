export type EventStatus = "DRAFT" | "SCHEDULED" | "CANCELLED";

export type EffectiveEventStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "ACTIVE"
  | "COMPLETED"
  | "LOCKED"
  | "CANCELLED";

export type RsvpStatus = "YES" | "NO" | "TENTATIVE";

export interface EventTargetSelector {
  group_ids?: string[];
  member_ids?: string[];
}

// DIP-FP-191-mobile: nested on MyEvent/EventDetail so mobile can detect an
// Announcement (system_key === 'ANNOUNCEMENT') without a second round-trip
// to /api/event-types — confirmed against web's merged PR #151
// (event.types.ts's EventTypeSummary), field names exact.
export interface EventTypeSummary {
  id: string;
  name: string;
  system_key: string | null;
}

// DIP-FP-191-mobile-adj-1: nested on MyEvent/EventDetail via web's
// created_by_member_id join — confirmed against web's merged PR #152
// (event.types.ts's CreatedByMemberSummary), field names exact. Null for
// events that predate the underlying column or whose creator was later
// anonymized/deleted.
export interface CreatedByMemberSummary {
  id: string;
  first_name: string;
  last_name: string;
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
  created_at: string;
  effective_status: EffectiveEventStatus;
  rsvp_status: RsvpStatus | null;
  rsvp_reason: string | null;
  // DIP-FP-132-FP-133-FP-134: server-computed RSVP cutoff (start_datetime
  // minus the event's rsvp_closure_days override or the tenant default) —
  // confirmed live on both /api/events/mine and /api/events/:id (PR #77).
  rsvp_closure_at: string;
  // DIP-FP-191-mobile: both added by web's merged PR #151 — null for every
  // non-Announcement event. event_type lets My Events/EventListItem detect
  // an Announcement card without a second fetch; announcement_body carries
  // the full write-up so My Events and event detail can render it from the
  // same payload (the Check-In tab's pending-list endpoint does NOT carry
  // this field — see PendingSelfReportRow's doc comment).
  announcement_body: string | null;
  event_type: EventTypeSummary;
  // DIP-FP-191-mobile-adj-1: added by web's merged PR #152 — confirmed on
  // both EventListRow (this type) and EventDetailRow. Replaces the
  // placeholder location_name/location_address ("Announcement"/"N/A", still
  // forced server-side to satisfy a NOT NULL constraint) with a real "From:
  // {name}" display on Announcement cards.
  created_by_member: CreatedByMemberSummary | null;
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
  // Atlas fix-in-place (DIP-FP-132-FP-133-FP-134 PR review): the raw
  // per-event override behind rsvp_closure_at, confirmed live on
  // GET /api/events/:id's select list — added so edit.tsx can prefill its
  // override field instead of always defaulting to blank (which was
  // silently clearing any existing override on every unrelated save).
  rsvp_closure_days: number | null;
  // DIP-FP-161-2-event-owner: the transferable owner, same endpoint
  // asymmetry as created_by_member_id above (present on GET
  // /api/events/:id, absent from /api/events/mine) — created_by_member_id
  // is left in place for display/audit purposes, this is now the field
  // the canEdit permission gate reads.
  owner_member_id: string | null;
  // DIP-FP-191-mobile-adj-1: detail-only (not on MyEvent/EventListRow),
  // confirmed against web's merged PR #152 — whether the current
  // authenticated caller has acknowledged this event. Null for any event
  // the caller hasn't acknowledged, including every non-Announcement event.
  acknowledged_at: string | null;
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

export type RosterResponseValue = "ACCEPTED" | "DECLINED" | "NOT_RESPONDED" | "TENTATIVE";

// Matches flockpulse-web's RosterEntry (GET /api/events/:id/roster) exactly.
export interface RosterEntry {
  member_id: string;
  first_name: string;
  last_name: string;
  response: RosterResponseValue;
  rsvp_reason: string | null;
}

// Matches flockpulse-web's POST /api/events request body exactly — the
// outer body is camelCase, but confirmed live that target's *inner* keys
// stay snake_case (group_ids/member_ids), same shape as EventTargetSelector
// above. Task assignment goes through the separate event-tasks-assignments
// endpoints (see src/features/tasks), not this input — DIP-FP-161-3
// stopped writing prayer_leader_member_id/food_assignment here, and
// DIP-FP-161-4 dropped the underlying columns entirely (removed from
// MyEvent/CreatedEvent/UpdatedEvent too).
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
// update_event_with_audit()'s JSONB patch handling.
//
// Every optional-on-the-wire field is typed `T | null` rather than `T |
// undefined` and always sent (never omitted): the SQL uses a JSONB
// key-presence check (`p_patch ? 'talk_id'`), not a truthiness check, so an
// *omitted* key means "no change" while an explicit `null` means "clear
// it." The edit screen submits a full representation of the form on every
// save, not a sparse diff, so it always sends one or the other deliberately
// rather than relying on JSON.stringify's undefined-drops-the-key behavior.
//
// prayerLeaderMemberId/foodAssignment removed — same reasoning as
// CreateEventInput's own comment above, task assignment goes through the
// event-tasks-assignments endpoints instead.
export interface UpdateEventInput {
  eventTypeId: string;
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
  updated_at: string;
}

// Matches web's listMeetingResources() (GET /api/meeting-resources) — the
// tracked Zoom accounts available to book against.
export interface MeetingResource {
  id: string;
  name: string;
  join_url: string;
}
