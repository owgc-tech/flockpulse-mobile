import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SwipeableTabScreen } from "@/src/features/navigation/SwipeableTabScreen";
import { submitSelfReport, listPendingSelfReports } from "@/src/features/self-reports/services/selfReports.service";
import type { PendingSelfReportRow } from "@/src/features/self-reports/types";
import { syncSelfReportBadge } from "@/src/features/notifications/services/selfReportBadge.service";
import { consumePendingAcknowledgements } from "@/src/features/self-reports/selfReportRefreshSignal";
import { ApiError } from "@/src/lib/api";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

const STAR_VALUES = [1, 2, 3, 4, 5];

// Only the color-bearing keys from `styles` below, recomputed from the
// current theme at render time — everything structural stays in the static
// StyleSheet.create() untouched. Merged on top via style arrays.
function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { backgroundColor: colors.background },
    empty: { color: colors.textSecondary },
    card: { backgroundColor: colors.cardBackground },
    eventName: { color: colors.text },
    meta: { color: colors.textSecondary },
    label: { color: colors.text },
    input: { borderColor: colors.border, color: colors.text },
    buttonNeutral: { backgroundColor: colors.backgroundSecondary },
    buttonSelected: { backgroundColor: colors.accent },
    buttonText: { color: colors.text },
    submitButton: { backgroundColor: colors.success },
    error: { color: colors.danger },
    announcementBadge: { backgroundColor: colors.accent + "22" },
    announcementBadgeText: { color: colors.accent },
    announcementCta: { color: colors.accent },
  });
}

function formatEventRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateLabel = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const startTime = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const endTime = end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${dateLabel}, ${startTime} – ${endTime}`;
}

export default function SelfReportTabScreen() {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);
  const [items, setItems] = useState<PendingSelfReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    setError(null);
    try {
      const data = await listPendingSelfReports();
      setItems(data);
      // Gated on isRefresh, not the initial mount load — the tab layout's
      // own useEffect already syncs the badge on mount, same precedent as
      // Confirmations (see confirmations/index.tsx).
      if (isRefresh) {
        syncSelfReportBadge().catch((err) => {
          console.warn("Failed to sync self-report badge:", err);
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pending self-reports.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // DIP-FP-191-mobile: Announcement acknowledgement happens on the event
  // detail screen (navigated to from this list, My Events, or a reminder
  // tap), not inline here — this consumes that hand-off on every focus (not
  // just mount) so a just-acknowledged row disappears on return without a
  // full refetch/loading blink. See selfReportRefreshSignal.ts.
  useFocusEffect(
    useCallback(() => {
      const acknowledgedIds = consumePendingAcknowledgements();
      if (!acknowledgedIds) return;
      setItems((prev) => prev.filter((i) => !(i.kind === "announcement" && acknowledgedIds.has(i.event_id))));
      syncSelfReportBadge().catch((err) => {
        console.warn("Failed to sync self-report badge:", err);
      });
    }, [])
  );

  // DIP-FP-152: mirrors Confirmation's exact pattern (confirmations/index.tsx
  // handleDecision) — instant local removal plus an immediate badge resync,
  // no re-fetch needed, called right after a successful submission rather
  // than only on manual pull-refresh.
  const handleSubmitted = (eventId: string) => {
    setItems((prev) => prev.filter((i) => i.event_id !== eventId));
    syncSelfReportBadge().catch((err) => {
      console.warn("Failed to sync self-report badge:", err);
    });
  };

  const handleOpenAnnouncement = (eventId: string) => {
    router.push({ pathname: "/(app)/events/[id]", params: { id: eventId } });
  };

  return (
    <SwipeableTabScreen>
    <View style={[styles.container, themed.container]}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.error, themed.error]}>{error}</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={items}
          keyExtractor={(item) => item.event_id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.empty, themed.empty]}>No pending self-reports</Text>
            </View>
          }
          renderItem={({ item }) =>
            item.kind === "announcement" ? (
              <AnnouncementCheckInItem item={item} onPress={() => handleOpenAnnouncement(item.event_id)} themed={themed} />
            ) : (
              <SelfReportItem item={item} onSubmitted={() => handleSubmitted(item.event_id)} themed={themed} />
            )
          }
        />
      )}
    </View>
    </SwipeableTabScreen>
  );
}

// DIP-FP-152: mirrors ConfirmationItem's per-item submitting/error state
// structurally, but the decision itself is NOT single-tap immediate-submit
// like Confirmation's Confirm/Reject — Attended/Did Not Attend are selection
// toggles that reveal fields (Rating/Feedback, or a required Reason) behind
// a separate Submit button, same two-step flow the retired standalone screen
// (events/[id]/self-report.tsx) already had, just embedded on the card.
function SelfReportItem({
  item,
  onSubmitted,
  themed,
}: {
  item: PendingSelfReportRow;
  onSubmitted: () => void;
  themed: ReturnType<typeof getThemedStyles>;
}) {
  const colors = useThemeColors();
  const [attended, setAttended] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [starRating, setStarRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (attended === null) return;
    if (!attended && !reason.trim()) {
      setError("Please provide a reason.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await submitSelfReport(
        item.event_id,
        attended ? "SELF_REPORTED_YES" : "SELF_REPORTED_NO",
        attended
          ? { feedback: feedback.trim() || undefined, starRating: starRating ?? undefined }
          : { reason: reason.trim() }
      );
      onSubmitted();
    } catch (err) {
      // No proactive "already self-reported" check — attempt submission and
      // handle the existing error code gracefully, same precedent as the
      // retired standalone screen: treated as a soft-success (the card is
      // gone either way, since it's already resolved server-side), not a
      // hard error left on-screen.
      if (err instanceof ApiError && err.code === "SELF_REPORT_ALREADY_SUBMITTED") {
        onSubmitted();
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to submit self-report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.card, themed.card]} testID={`self-report-item-${item.event_id}`}>
      <Text style={[styles.eventName, themed.eventName]}>{item.event_name}</Text>
      <Text style={[styles.meta, themed.meta]}>{formatEventRange(item.event_start_datetime, item.event_end_datetime)}</Text>
      <Text style={[styles.meta, themed.meta]}>{item.event_location_name}</Text>

      <Text style={[styles.label, themed.label, styles.sectionLabel]}>Did you attend?</Text>
      <View style={styles.row}>
        <Pressable
          style={[
            styles.button,
            styles.buttonNeutral,
            themed.buttonNeutral,
            attended === true && [styles.buttonSelected, themed.buttonSelected],
          ]}
          onPress={() => setAttended(true)}
          disabled={isSubmitting}
          testID={`self-report-attended-${item.event_id}`}
        >
          <Text style={[styles.buttonText, themed.buttonText, attended === true && styles.buttonTextSelected]}>
            Attended
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.button,
            styles.buttonNeutral,
            themed.buttonNeutral,
            attended === false && [styles.buttonSelected, themed.buttonSelected],
          ]}
          onPress={() => setAttended(false)}
          disabled={isSubmitting}
          testID={`self-report-not-attended-${item.event_id}`}
        >
          <Text style={[styles.buttonText, themed.buttonText, attended === false && styles.buttonTextSelected]}>
            Did Not Attend
          </Text>
        </Pressable>
      </View>

      {attended === true ? (
        <View style={styles.formSection}>
          <Text style={[styles.label, themed.label]}>Rating</Text>
          <View style={styles.starsRow}>
            {STAR_VALUES.map((value) => (
              <Pressable
                key={value}
                onPress={() => setStarRating(value)}
                disabled={isSubmitting}
                testID={`self-report-star-${value}-${item.event_id}`}
              >
                <Text style={styles.star}>{starRating !== null && value <= starRating ? "★" : "☆"}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, themed.label]}>Feedback (optional)</Text>
          <TextInput
            style={[styles.input, themed.input]}
            value={feedback}
            onChangeText={(text) => setFeedback(text.slice(0, 1000))}
            multiline
            editable={!isSubmitting}
            placeholderTextColor={colors.textMuted}
            testID={`self-report-feedback-input-${item.event_id}`}
          />
        </View>
      ) : attended === false ? (
        <View style={styles.formSection}>
          <Text style={[styles.label, themed.label]}>Reason</Text>
          <TextInput
            style={[styles.input, themed.input]}
            value={reason}
            onChangeText={setReason}
            multiline
            editable={!isSubmitting}
            placeholderTextColor={colors.textMuted}
            testID={`self-report-reason-input-${item.event_id}`}
          />
        </View>
      ) : null}

      {error ? (
        <Text style={[styles.error, themed.error]} testID={`self-report-error-${item.event_id}`}>
          {error}
        </Text>
      ) : null}

      <Pressable
        style={[styles.submitButton, themed.submitButton, attended === null && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting || attended === null}
        testID={`self-report-submit-${item.event_id}`}
      >
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={[styles.buttonText, styles.buttonTextSelected]}>Submit</Text>}
      </Pressable>
    </View>
  );
}

// DIP-FP-191-mobile: announcement rows carry only event_id/name/start/end/
// location + kind (confirmed against web's merged PendingSelfReportRow —
// no announcement_body here), so unlike SelfReportItem this is a simple
// tappable card, not a form — the full write-up and the actual Acknowledge
// action both live on the event detail screen this navigates to.
function AnnouncementCheckInItem({
  item,
  onPress,
  themed,
}: {
  item: PendingSelfReportRow;
  onPress: () => void;
  themed: ReturnType<typeof getThemedStyles>;
}) {
  return (
    <Pressable
      style={[styles.card, themed.card]}
      onPress={onPress}
      testID={`announcement-check-in-item-${item.event_id}`}
    >
      <View style={[styles.announcementBadge, themed.announcementBadge]}>
        <Text style={[styles.announcementBadgeText, themed.announcementBadgeText]}>Announcement</Text>
      </View>
      <Text style={[styles.eventName, themed.eventName]}>{item.event_name}</Text>
      <Text style={[styles.meta, themed.meta]}>{formatEventRange(item.event_start_datetime, item.event_end_datetime)}</Text>
      <Text style={[styles.meta, themed.meta]}>{item.event_location_name}</Text>
      <Text style={[styles.announcementCta, themed.announcementCta]}>Tap to read & acknowledge ›</Text>
    </Pressable>
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
  meta: {
    fontSize: 14,
    color: "#555",
    marginTop: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  sectionLabel: {
    marginTop: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  formSection: {
    marginTop: 12,
  },
  starsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  star: {
    fontSize: 32,
    color: "#f59e0b",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: "top",
  },
  button: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonNeutral: {
    backgroundColor: "#e5e7eb",
  },
  buttonSelected: {
    backgroundColor: "#2563eb",
  },
  submitButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#16a34a",
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
  },
  buttonTextSelected: {
    color: "#fff",
  },
  error: {
    color: "#c0392b",
    fontSize: 13,
    marginTop: 8,
  },
  announcementBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#dbeafe",
    marginBottom: 6,
  },
  announcementBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563eb",
    textTransform: "uppercase",
  },
  announcementCta: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2563eb",
    marginTop: 10,
  },
});
