import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { AnnouncementRosterEntry } from "@/src/features/announcements/services/announcements.service";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

interface AnnouncementRosterListProps {
  entries: AnnouncementRosterEntry[];
}

// Only the color-bearing keys from `styles` below, recomputed from the
// current theme at render time — everything structural stays in the static
// StyleSheet.create() untouched. Merged on top via style arrays.
function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: { borderBottomColor: colors.border },
    name: { color: colors.text },
    empty: { color: colors.textSecondary },
  });
}

// DIP-FP-191-mobile-adj-5: mirrors RosterList.tsx's structure exactly (same
// row layout, same testID convention) but typed on AnnouncementRosterEntry —
// no guest-count suffix, no reason line, neither concept applies to
// Announcements. Kept as a sibling component rather than a union-typed
// retrofit of RosterList, since RosterEntry's response/rsvp_reason/
// guest_count fields are meaningless here.
export function AnnouncementRosterList({ entries }: AnnouncementRosterListProps) {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);

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
            <Text style={[styles.status, { color: entry.acknowledged_at ? colors.success : colors.textMuted }]}>
              {entry.acknowledged_at ? "Acknowledged" : "Not responded yet"}
            </Text>
          </View>
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
  status: {
    fontSize: 13,
    fontWeight: "600",
  },
  empty: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    paddingVertical: 24,
  },
});
