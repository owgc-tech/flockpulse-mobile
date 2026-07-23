// DIP-FP-182-mobile: this feature's endpoints depend on flockpulse-web's
// companion DIP-FP-182-web, which hadn't been implemented/merged as of this
// DIP — these shapes are the proposed contract this screen was built
// against, not one confirmed live against a running route handler (see this
// PR's description for what that means for testing).

export interface DashboardEventOption {
  id: string;
  name: string;
  start_datetime: string;
}

export interface DashboardAttendanceStats {
  attended_count: number;
  expected_count: number;
  // Raw 0-1 ratio (expected_count > 0 ? attended_count / expected_count : 0)
  // — banding buckets this separately from the displayed percentage, same
  // raw-vs-banded split as DashboardRatingStats.average_rating below.
  attendance_rate: number;
}

export interface DashboardRsvpStats {
  yes_count: number;
  no_count: number;
  no_response_count: number;
  total_invited: number;
}

export interface DashboardFeedbackEntry {
  member_name: string;
  star_rating: number | null;
  feedback: string;
}

export interface DashboardRatingStats {
  // Raw average (e.g. 4.3), shown as-is. Card color banding rounds this to
  // the nearest whole star separately (see dashboard/index.tsx) so a score
  // just under a threshold (e.g. 3.98) doesn't get a harsher band than one
  // just over it (4.01) — the displayed number and the banding decision are
  // deliberately not the same calculation.
  average_rating: number | null;
  feedback: DashboardFeedbackEntry[];
}

export interface DashboardStats {
  event_id: string;
  event_name: string;
  attendance: DashboardAttendanceStats;
  rsvp: DashboardRsvpStats;
  rating: DashboardRatingStats;
}

// GET /api/dashboard/default's success shape — bundles the winning event's
// stats directly so the initial paint doesn't need a second round-trip once
// the two dropdowns are pre-selected to event_type_id/event_id.
export interface DefaultDashboard {
  event_type_id: string;
  event_type_name: string;
  event_id: string;
  event_name: string;
  stats: DashboardStats;
}
