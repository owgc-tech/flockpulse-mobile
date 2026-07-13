// Matches flockpulse-web's EventTypeRow (GET /api/event-types) exactly —
// confirmed live against the route handler and repository.
export interface EventType {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}
