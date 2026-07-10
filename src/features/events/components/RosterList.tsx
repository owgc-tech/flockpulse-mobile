import { StyleSheet, Text, View } from "react-native";
import type { RosterEntry, RosterResponseValue } from "@/src/features/events/types";

interface RosterListProps {
  entries: RosterEntry[];
}

const RESPONSE_LABELS: Record<RosterResponseValue, string> = {
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  NOT_RESPONDED: "No response yet",
};

const RESPONSE_COLORS: Record<RosterResponseValue, { color: string }> = {
  ACCEPTED: { color: "#166534" },
  DECLINED: { color: "#991b1b" },
  NOT_RESPONDED: { color: "#6b7280" },
};

export function RosterList({ entries }: RosterListProps) {
  if (entries.length === 0) {
    return <Text style={styles.empty}>No one has been invited to this event yet.</Text>;
  }

  return (
    <View>
      {entries.map((entry) => (
        <View key={entry.member_id} style={styles.row} testID={`roster-entry-${entry.member_id}`}>
          <View style={styles.rowHeader}>
            <Text style={styles.name}>
              {entry.first_name} {entry.last_name}
            </Text>
            <Text style={[styles.response, RESPONSE_COLORS[entry.response]]}>
              {RESPONSE_LABELS[entry.response]}
            </Text>
          </View>
          {entry.response === "DECLINED" && entry.rsvp_reason ? (
            <Text style={styles.reason}>{entry.rsvp_reason}</Text>
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
