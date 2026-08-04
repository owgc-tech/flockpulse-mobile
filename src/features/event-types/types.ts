// Matches flockpulse-web's EventTypeRow (GET /api/event-types) exactly —
// confirmed live against the route handler and repository.
export interface EventType {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  // DIP-FP-191-mobile-adj-3: confirmed live — the repository's column list
  // already includes this (added by web's merged PR #151 for FP-181/
  // FP-191's system-managed-type pattern), it just wasn't reflected here
  // yet. 'ANNOUNCEMENT' for the one system-managed row every tenant has,
  // null for every other type — same signal EventListItem.tsx/
  // AnnouncementSection already use via the nested EventTypeSummary on
  // MyEvent/EventDetail. Note: web's own admin EventForm.tsx actually
  // detects Announcement via this row's `code` field instead
  // (code === 'ANNOUNCEMENT'), not system_key — an inconsistency in web's
  // own codebase between that convenience check and its authoritative
  // server-side system_key check. Kept on system_key here regardless, to
  // stay consistent with every other mobile-side Announcement check.
  system_key: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}
