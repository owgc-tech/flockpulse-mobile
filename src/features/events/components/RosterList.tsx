import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { RosterEntry, RosterResponseValue } from "@/src/features/events/types";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

interface RosterListProps {
  entries: RosterEntry[];
}

const RESPONSE_LABELS: Record<RosterResponseValue, string> = {
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  TENTATIVE: "Tentative",
  NOT_RESPONDED: "No response yet",
};

// Bespoke to this component (not part of the shared token set in
// src/theme/colors.ts) — the original light-only values ("#166534" dark
// green, "#991b1b" dark red, "#6b7280" gray) were tuned for a white
// background and would be near-invisible on the dark palette's black
// background, so these are derived from the theme's own
// success/danger/textMuted tokens instead of a hardcoded second pair.
function getResponseColors(colors: ThemeColors): Record<RosterResponseValue, { color: string }> {
  return {
    ACCEPTED: { color: colors.success },
    DECLINED: { color: colors.danger },
    TENTATIVE: { color: colors.warning },
    NOT_RESPONDED: { color: colors.textMuted },
  };
}

// Only the color-bearing keys from `styles` below, recomputed from the
// current theme at render time — everything structural stays in the static
// StyleSheet.create() untouched. Merged on top via style arrays.
function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: { borderBottomColor: colors.border },
    name: { color: colors.text },
    reason: { color: colors.textSecondary },
    empty: { color: colors.textSecondary },
  });
}

export function RosterList({ entries }: RosterListProps) {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);
  const responseColors = useMemo(() => getResponseColors(colors), [colors]);

  if (entries.length === 0) {
    return <Text style={[styles.empty, themed.empty]}>No one has been invited to this event yet.</Text>;
  }

  return (
    <View>
      {entries.map((entry) => (
        <View key={entry.member_id} style={[styles.row, themed.row]} testID={`roster-entry-${entry.member_id}`}>
          <View style={styles.rowHeader}>
            <Text style={[styles.name, themed.name]}>
              {entry.first_name} {entry.last_name}
            </Text>
            <Text style={[styles.response, responseColors[entry.response]]}>
              {RESPONSE_LABELS[entry.response]}
            </Text>
          </View>
          {entry.response === "DECLINED" && entry.rsvp_reason ? (
            <Text style={[styles.reason, themed.reason]}>{entry.rsvp_reason}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
  },
  response: {
    fontSize: 13,
    fontWeight: "600",
  },
  reason: {
    fontSize: 13,
    color: "#555",
    marginTop: 4,
  },
  empty: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    paddingVertical: 24,
  },
});
