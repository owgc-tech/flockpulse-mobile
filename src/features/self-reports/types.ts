export type SelfReportStatus = "SELF_REPORTED_YES" | "SELF_REPORTED_NO";

export type ConfirmationStatus = "PENDING_CONFIRMATION" | "CONFIRMED" | "REJECTED" | "NOT_REQUIRED";

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
