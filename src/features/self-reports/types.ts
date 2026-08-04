export type SelfReportStatus = "SELF_REPORTED_YES" | "SELF_REPORTED_NO";

export type ConfirmationStatus = "PENDING_CONFIRMATION" | "CONFIRMED" | "REJECTED" | "NOT_REQUIRED";

// DIP-FP-191-mobile: 'self_report' is the original FP-119-web row;
// 'announcement' is an Announcement-type event this member hasn't
// acknowledged yet — unioned into the same array so the Check-In badge count
// combines both without a second endpoint. Confirmed against web's merged
// PR #151 (self-report.types.ts) — no announcement_body field on this row
// (that only lives on MyEvent/EventDetail); the Check-In tab navigates to
// the event detail screen for the full write-up instead of rendering it
// inline here.
export type PendingSelfReportKind = "self_report" | "announcement";

// Matches flockpulse-web's PendingSelfReportRow (GET /api/self-reports/pending)
// exactly — confirmed live against the repository/route, including the
// DIP-FP-191-web `kind` addition (PR #151, merged into dev at 6638877).
export interface PendingSelfReportRow {
  kind: PendingSelfReportKind;
  event_id: string;
  event_name: string;
  event_start_datetime: string;
  event_end_datetime: string;
  event_location_name: string;
}

// Matches flockpulse-web's SelfReportResponse (POST /api/self-reports success
// body) exactly — confirmed live against the route handler and service.
export interface SelfReportResponse {
  id: string;
  event_id: string;
  member_id: string;
  self_report_status: SelfReportStatus;
  reason: string | null;
  feedback: string | null;
  star_rating: number | null;
  confirmation_status: ConfirmationStatus;
  submitted_at: string;
}
