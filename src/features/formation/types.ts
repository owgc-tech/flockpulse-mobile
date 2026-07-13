// Matches flockpulse-web's CourseRow/ModuleRow/TalkRow (GET /api/courses,
// GET /api/modules?course_id=, GET /api/talks?module_id=) exactly —
// confirmed live against the route handlers and repositories.

export interface Course {
  id: string;
  tenant_id: string;
  name: string;
  alias: string | null;
  description: string | null;
  sequence_order: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormationModule {
  id: string;
  tenant_id: string;
  course_id: string;
  name: string;
  alias: string | null;
  description: string | null;
  sequence_order: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Talk {
  id: string;
  tenant_id: string;
  module_id: string;
  name: string;
  alias: string | null;
  description: string | null;
  sequence_order: number;
  for_single_men: boolean;
  for_single_women: boolean;
  for_married_men: boolean;
  for_married_women: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}
