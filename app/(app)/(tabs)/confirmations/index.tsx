import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import {
  listPendingConfirmations,
  submitConfirmation,
} from "@/src/features/confirmations/services/confirmations.service";
import type { ConfirmationDecision, PendingConfirmationRow } from "@/src/features/confirmations/types";

function formatSubmittedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// DIP-FP-99-adj-1: event_start_datetime/event_end_datetime are now part of
// PendingConfirmationRow (previously only event_id was available).
function formatEventRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateLabel = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const startTime = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const endTime = end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${dateLabel}, ${startTime} – ${endTime}`;
}

export default function ConfirmationsScreen() {
  const [items, setItems] = useState<PendingConfirmationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listPendingConfirmations();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load confirmations.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDecision = async (item: PendingConfirmationRow, decision: ConfirmationDecision) => {
    await submitConfirmation(item.self_report_id, decision);
    setItems((prev) => prev.filter((i) => i.self_report_id !== item.self_report_id));
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={items}
          keyExtractor={(item) => item.self_report_id}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>No pending confirmations</Text>
            </View>
          }
          renderItem={({ item }) => (
            <ConfirmationItem item={item} onDecision={(decision) => handleDecision(item, decision)} />
          )}
        />
      )}
    </View>
  );
}

function ConfirmationItem({
  item,
  onDecision,
}: {
  item: PendingConfirmationRow;
  onDecision: (decision: ConfirmationDecision) => Promise<void>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attended = item.self_report_status === "SELF_REPORTED_YES";

  const handlePress = async (decision: ConfirmationDecision) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await onDecision(decision);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit confirmation.");
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.card} testID={`confirmation-item-${item.self_report_id}`}>
      <Text style={styles.eventName}>{item.event_name}</Text>
      <Text style={styles.meta}>{formatEventRange(item.event_start_datetime, item.event_end_datetime)}</Text>
      <Text style={styles.meta}>{item.event_location_name}</Text>
      <Text style={styles.name}>
        {item.member_first_name} {item.member_last_name}
      </Text>
      <Text style={styles.meta}>Submitted {formatSubmittedAt(item.submitted_at)}</Text>
      <Text style={styles.status}>{attended ? "Self-reported: Attended" : "Self-reported: Did not attend"}</Text>
      {/* Note: the self-report's own decline reason isn't part of this
          endpoint's response (only rsvp_reason, a separate field) — nothing
          to show here for a No report beyond the status itself. */}
      {attended && item.star_rating ? <Text style={styles.meta}>Rating: {item.star_rating}/5</Text> : null}
      {attended && item.feedback ? <Text style={styles.meta}>{item.feedback}</Text> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.row}>
        <Pressable
          style={[styles.button, styles.buttonPrimary]}
          onPress={() => handlePress("CONFIRM")}
          disabled={isSubmitting}
          testID={`confirm-${item.self_report_id}`}
        >
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Attended</Text>}
        </Pressable>
        <Pressable
          style={[styles.button, styles.buttonDanger]}
          onPress={() => handlePress("REJECT")}
          disabled={isSubmitting}
          testID={`reject-${item.self_report_id}`}
        >
          <Text style={styles.buttonText}>Did Not Attend</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 48,
  },
  empty: {
    fontSize: 15,
    color: "#555",
  },
  card: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    marginBottom: 12,
  },
  eventName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 8,
  },
  meta: {
    fontSize: 14,
    color: "#555",
    marginTop: 2,
  },
  status: {
    fontSize: 14,
    color: "#333",
    marginTop: 6,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  button: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonPrimary: {
    backgroundColor: "#16a34a",
  },
  buttonDanger: {
    backgroundColor: "#dc2626",
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  error: {
    color: "#c0392b",
    fontSize: 13,
    marginTop: 8,
  },
});
