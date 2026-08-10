// DIP-FP-182-mobile-adj-1: matches flockpulse-web's report.repository.ts
// exactly (DashboardEventType/DashboardEventOption/DefaultDashboardEvent/
// DashboardStatsResult) — confirmed live against the route/service/
// repository files directly, not guessed. The original draft's flat
// event_type_id/event_type_name and invented attendance_rate/total_invited
// fields never matched anything real; removed entirely rather than left
// unused.

export interface DashboardEventType {
  id: string;
  name: string;
}

export interface DashboardEventOption {
  id: string;
  name: string;
  start_datetime: string;
}

// GET /api/reports/dashboard/default's success shape. No stats bundled in —
// unlike this feature's first draft, which wrongly assumed the default
// endpoint returned stats too (avoiding a second round-trip on first paint).
// It doesn't; the initial stats fetch is a separate getDashboardStats() call
// once event_type/event are known (see dashboard/index.tsx).
export interface DefaultDashboardEvent {
  event_type: DashboardEventType;
  event: DashboardEventOption;
}

export interface DashboardAttendanceStats {
  expected_count: number;
  attended_count: number;
  did_not_attend_count: number;
  did_not_self_report_count: number;
  // 0-100, one decimal, already rounded server-side; null when
  // expected_count is 0 (nothing to divide by).
  percent: number | null;
}

export interface DashboardRsvpStats {
  yes_count: number;
  no_count: number;
  tentative_count: number;
  no_response_count: number;
}

// No member_name — anonymized at the data layer server-side (the feedback
// query's SELECT list never includes member_id or any joined member field),
// so there is nothing to remove client-side either; this type simply
// doesn't have the field.
export interface DashboardFeedbackEntry {
  star_rating: number | null;
  feedback: string;
}

export interface DashboardRatingBreakdownEntry {
  star: number;
  count: number;
}

export interface DashboardRatingStats {
  // Raw average (e.g. 4.3), shown as-is.
  average: number | null;
  // Math.round(average) — used for banding instead of the raw average, so a
  // score just under a threshold (e.g. 3.98) isn't banded any harsher than
  // one just over it (4.01). Computed server-side now, not locally.
  rounded: number | null;
  rating_count: number;
  // DIP-FP-182-mobile-adj-2 / DIP-FP-182-web-adj-2: one entry per star value
  // 5 down to 1, driving the Rating card's bar rows. Depends on
  // DIP-FP-182-web-adj-2 landing — not present in the field yet as of this
  // DIP, per its own Grounding Check.
  breakdown: DashboardRatingBreakdownEntry[];
  feedback: DashboardFeedbackEntry[];
}

// DIP-FP-197-mobile: Announcement-type events have no attendance/rsvp/
// rating data (FP-191's design routes them through
// announcement_acknowledgements instead) — confirmed live against web's
// report.repository.ts, which returns only `announcement` for these events,
// omitting the other three entirely rather than returning them empty.
export interface DashboardAnnouncementStats {
  acknowledged_count: number;
  not_acknowledged_count: number;
  total_count: number;
  // Same null-when-nothing-to-divide-by convention as
  // DashboardAttendanceStats.percent above.
  percent: number | null;
}

export interface DashboardStats {
  attendance?: DashboardAttendanceStats;
  rsvp?: DashboardRsvpStats;
  rating?: DashboardRatingStats;
  announcement?: DashboardAnnouncementStats;
}
