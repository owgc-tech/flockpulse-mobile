import type { SelfReportStatus } from "@/src/features/self-reports/types";

export type ConfirmationDecision = "CONFIRM" | "REJECT";

// Matches flockpulse-web's PendingConfirmationRow (GET /api/confirmations/pending)
// exactly — confirmed live against the repository/service. Note: this does
// NOT include the self-report's own decline `reason` (only `rsvp_reason`,
// a separate field from the RSVP flow). DIP-FP-99-adj-1: event_name/
// event_start_datetime/event_end_datetime/event_location_name were added on
// the web side — this row does now carry event info, joined server-side
// from the events table via event_id.
// FP-257: feedback and star_rating are deliberately not declared. Feedback is
// anonymous and never shown to Leaders; the server stops sending them with
// FP-257, and an older server that still does is ignored by the app.
export interface PendingConfirmationRow {
  self_report_id: string;
  event_id: string;
  event_name: string;
  event_start_datetime: string;
  event_end_datetime: string;
  event_location_name: string;
  member_id: string;
  member_first_name: string;
  member_last_name: string;
  self_report_status: SelfReportStatus;
  submitted_at: string;
  rsvp_status: string | null;
  rsvp_reason: string | null;
}

// Matches flockpulse-web's ConfirmationResult (POST /api/confirmations/:selfReportId
// success body).
export interface ConfirmationResult {
  attendance_id: string;
  confirmation_status: string;
  confirmed_at: string;
}
