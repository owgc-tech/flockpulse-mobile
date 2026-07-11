import { apiFetch } from "@/src/lib/api";
import type { SelfReportResponse, SelfReportStatus } from "@/src/features/self-reports/types";

interface SubmitSelfReportOptions {
  reason?: string;
  feedback?: string;
  starRating?: number;
}

// Callers can branch on err.code (SELF_REPORT_ALREADY_SUBMITTED /
// SELF_REPORT_REASON_REQUIRED / SELF_REPORT_NOT_OPEN / VALIDATION_ERROR /
// FORBIDDEN_SCOPE / NOT_FOUND / ...) via ApiError — see src/lib/api.ts.
export async function submitSelfReport(
  eventId: string,
  status: SelfReportStatus,
  options: SubmitSelfReportOptions = {}
): Promise<SelfReportResponse> {
  const body: Record<string, unknown> = { event_id: eventId, self_report_status: status };

  // feedback/star_rating are Yes-only fields server-side (sending them on a
  // No submission throws VALIDATION_ERROR); reason is silently ignored on
  // Yes, so it's only sent for No.
  if (status === "SELF_REPORTED_NO") {
    body.reason = options.reason;
  } else {
    if (options.feedback !== undefined) body.feedback = options.feedback;
    if (options.starRating !== undefined) body.star_rating = options.starRating;
  }

  return apiFetch<SelfReportResponse>("/api/self-reports", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
