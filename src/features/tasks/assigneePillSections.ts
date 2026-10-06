import type { AssigneeStateEntry } from "@/src/features/tasks/types";

// FP-242: pure helpers (no React, no I/O) that turn the server's already-
// ordered assignee_states into the sections the Event Detail renders. The
// server's order is kept as is — this only splits the list into sections.
export interface PillSection {
  key: string;
  // null for the direct-members section (no caption); a group's name otherwise.
  caption: string | null;
  pills: AssigneeStateEntry[];
  // "+N more" count; only ever non-zero on the last section.
  moreCount: number;
}

const UNKNOWN_GROUP = "Unknown group";

export function buildPillSections(
  states: AssigneeStateEntry[],
  total: number,
  groupIds: string[],
  groupNameById: Map<string, string>
): PillSection[] {
  if (states.length === 0) return [];

  const sections: PillSection[] = [];

  const direct = states.filter((s) => s.via_group_id === null);
  if (direct.length > 0) {
    sections.push({ key: "direct", caption: null, pills: direct, moreCount: 0 });
  }

  for (const groupId of groupIds) {
    const pills = states.filter((s) => s.via_group_id === groupId);
    if (pills.length > 0) {
      sections.push({
        key: `group-${groupId}`,
        caption: groupNameById.get(groupId) ?? UNKNOWN_GROUP,
        pills,
        moreCount: 0,
      });
    }
  }

  // Entries naming a group that is not in this assignment's group_ids should
  // never happen, but must never crash or silently vanish.
  const knownGroupIds = new Set(groupIds);
  const orphans = states.filter((s) => s.via_group_id !== null && !knownGroupIds.has(s.via_group_id));
  if (orphans.length > 0) {
    sections.push({ key: "unknown-group", caption: UNKNOWN_GROUP, pills: orphans, moreCount: 0 });
  }

  const moreCount = Math.max(0, total - states.length);
  if (sections.length > 0) {
    sections[sections.length - 1].moreCount = moreCount;
  }
  return sections;
}

// The screen's render rule: pills only when the server sent states we could
// section; otherwise today's names line (+ Refused line) is shown.
export function shouldRenderPills(sections: PillSection[]): boolean {
  return sections.length > 0;
}

export function pillAccessibilityLabel(entry: AssigneeStateEntry): string {
  if (entry.state === "COMMITTED") return `${entry.name}, committed`;
  if (entry.state === "REFUSED") return `${entry.name}, refused`;
  return `${entry.name}, not yet responded`;
}

export function morePillAccessibilityLabel(n: number): string {
  return `${n} more assignees`;
}
