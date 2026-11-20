// FP-258: plain-words reasons why "Delete My Account" was blocked. Pure (no
// React Native imports) so it runs under tsx in the standalone test script.
//
// The server (FP-258 web) returns every block at once; an older server
// returns exactly one count and no lastAdmin. Both shapes work here. Never
// returns raw error text that could carry an id: the DB trigger's message
// reads "Cannot deactivate member <uuid>: ..." and is not fit for display.

export interface DeletionBlockerSource {
  assignedMemberCount: number | null;
  ownedGroupCount: number | null;
  ownedEventCount: number | null;
  lastAdmin: boolean;
  message?: string | null;
}

export const DELETION_BLOCKED_FALLBACK =
  "Your account can't be deleted right now. Please contact support@flockpulse.ca.";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function present(n: number | null): n is number {
  return typeof n === "number" && n > 0;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function describeDeletionBlockers(err: DeletionBlockerSource): string[] {
  const lines: string[] = [];

  if (err.lastAdmin === true) {
    lines.push(
      "You are this community's only Administrator. Make another member an Administrator first, or email support@flockpulse.ca to close the community."
    );
  }
  if (present(err.assignedMemberCount)) {
    lines.push(
      `You lead ${plural(err.assignedMemberCount, "member", "members")}. Ask your Administrator to assign them to another leader first.`
    );
  }
  if (present(err.ownedGroupCount)) {
    lines.push(
      `You own ${plural(err.ownedGroupCount, "group", "groups")}. Ask your Administrator to give them to someone else first.`
    );
  }
  if (present(err.ownedEventCount)) {
    lines.push(
      `You own ${plural(err.ownedEventCount, "upcoming event", "upcoming events")}. Ask your Administrator to give them to someone else first.`
    );
  }

  if (lines.length > 0) return lines;

  const message = typeof err.message === "string" ? err.message.trim() : "";
  if (message && !UUID_RE.test(message)) return [message];
  return [DELETION_BLOCKED_FALLBACK];
}
