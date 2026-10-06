import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { morePillAccessibilityLabel, pillAccessibilityLabel } from "@/src/features/tasks/assigneePillSections";
import type { PillSection } from "@/src/features/tasks/assigneePillSections";
import type { AssigneeState } from "@/src/features/tasks/types";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

// Only the color-bearing keys, recomputed from the current theme at render
// time — structure stays in the static StyleSheet below.
function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    caption: { color: colors.textSecondary },
    committed: { backgroundColor: colors.pillCommittedBg, borderColor: colors.pillCommittedBorder },
    committedText: { color: colors.pillCommittedText },
    refused: { backgroundColor: colors.pillRefusedBg, borderColor: colors.pillRefusedBorder },
    refusedText: { color: colors.pillRefusedText },
    pending: { backgroundColor: colors.pillPendingBg, borderColor: colors.pillPendingBorder },
    pendingText: { color: colors.pillPendingText },
  });
}

interface AssigneeStatePillsProps {
  sections: PillSection[];
  testIDPrefix: string;
}

const MARKS: Record<AssigneeState, string> = { COMMITTED: "✓ ", REFUSED: "✕ ", PENDING: "" };

// FP-242: one pill per assignee — green ✓ committed, red ✕ refused, grey name
// only when not yet responded. The state is carried by the mark, the color and
// the accessibility label; the words committed/refused/pending are never shown
// on screen. Group sections get a small neutral caption; the last section may
// end with a neutral "+N more" pill.
export function AssigneeStatePills({ sections, testIDPrefix }: AssigneeStatePillsProps) {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);

  const pillStyles: Record<AssigneeState, { box: object; text: object }> = {
    COMMITTED: { box: themed.committed, text: themed.committedText },
    REFUSED: { box: themed.refused, text: themed.refusedText },
    PENDING: { box: themed.pending, text: themed.pendingText },
  };

  return (
    <View>
      {sections.map((section) => (
        <View key={section.key} style={styles.section}>
          {section.caption !== null ? (
            <Text style={[styles.caption, themed.caption]}>{section.caption}</Text>
          ) : null}
          <View style={styles.row}>
            {section.pills.map((entry) => (
              <View
                key={`${entry.member_id}-${entry.via_group_id ?? "direct"}`}
                accessible={true}
                accessibilityLabel={pillAccessibilityLabel(entry)}
                style={[styles.pill, pillStyles[entry.state].box]}
                testID={`${testIDPrefix}-pill-${entry.member_id}`}
              >
                <Text style={[styles.pillText, pillStyles[entry.state].text]}>
                  {MARKS[entry.state]}
                  {entry.name}
                </Text>
              </View>
            ))}
            {section.moreCount > 0 ? (
              <View
                accessible={true}
                accessibilityLabel={morePillAccessibilityLabel(section.moreCount)}
                style={[styles.pill, themed.pending]}
                testID={`${testIDPrefix}-more`}
              >
                <Text style={[styles.pillText, themed.pendingText]}>+{section.moreCount} more</Text>
              </View>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 6,
  },
  caption: {
    fontSize: 13,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
