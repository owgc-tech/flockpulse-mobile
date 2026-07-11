import { apiFetch } from "@/src/lib/api";
import type {
  ConfirmationDecision,
  ConfirmationResult,
  PendingConfirmationRow,
} from "@/src/features/confirmations/types";

export async function listPendingConfirmations(): Promise<PendingConfirmationRow[]> {
  return apiFetch<PendingConfirmationRow[]>("/api/confirmations/pending");
}

export async function submitConfirmation(
  selfReportId: string,
  decision: ConfirmationDecision,
  leaderNote?: string
): Promise<ConfirmationResult> {
  return apiFetch<ConfirmationResult>(`/api/confirmations/${selfReportId}`, {
    method: "POST",
    body: JSON.stringify({
      decision,
      ...(leaderNote ? { leader_note: leaderNote } : {}),
    }),
  });
}
