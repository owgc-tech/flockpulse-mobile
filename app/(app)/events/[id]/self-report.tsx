import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { submitSelfReport } from "@/src/features/self-reports/services/selfReports.service";
import { getEventById } from "@/src/features/events/services/events.service";
import { getRsvpStatusColor } from "@/src/features/events/utils";
import { ApiError } from "@/src/lib/api";
import type { MyEvent } from "@/src/features/events/types";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

const STAR_VALUES = [1, 2, 3, 4, 5];

// Only the color-bearing keys from `styles` below, recomputed from the
// current theme at render time — everything structural stays in the static
// StyleSheet.create() untouched. Merged on top via style arrays.
function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { backgroundColor: colors.background },
    backLinkText: { color: colors.accent },
    center: { backgroundColor: colors.background },
    name: { color: colors.text },
    meta: { color: colors.textSecondary },
    metaSecondary: { color: colors.textMuted },
    divider: { backgroundColor: colors.divider },
    sectionTitle: { color: colors.text },
    info: { color: colors.textSecondary },
    label: { color: colors.text },
    input: { borderColor: colors.border, color: colors.text },
    buttonNeutral: { backgroundColor: colors.backgroundSecondary },
    buttonSelected: { backgroundColor: colors.accent },
    buttonText: { color: colors.text },
    submitButton: { backgroundColor: colors.success },
    error: { color: colors.danger },
  });
}

function formatDateTimeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateLabel = start.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const startTime = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const endTime = end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${dateLabel} · ${startTime} – ${endTime}`;
}

function rsvpLabel(event: MyEvent): string {
  if (event.rsvp_status === "YES") return "Your RSVP: Going";
  if (event.rsvp_status === "NO") return "Your RSVP: Not going";
  if (event.rsvp_status === "TENTATIVE") return "Your RSVP: Might attend";
  return "Your RSVP: No response";
}

type ViewState = "form" | "already-responded" | "submitted";

export default function SelfReportScreen() {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);
  const params = useLocalSearchParams<{ id: string; event?: string }>();
  const [event, setEvent] = useState<MyEvent | null>(null);
  const [parseError, setParseError] = useState(false);

  useEffect(() => {
    if (!params.event) {
      setParseError(true);
      return;
    }
    try {
      setEvent(JSON.parse(params.event) as MyEvent);
    } catch {
      setParseError(true);
    }
  }, [params.event]);

  // Same staleness correction as the event detail screen: the baked-in
  // event came from the notification's data payload at scheduling time and
  // can be stale (edited/cancelled since) — fresh-fetch on open and merge
  // over it, keeping the baked-in data only for the initial render so
  // there's no blank flash. getEventById() lacks rsvp_status/rsvp_reason,
  // so this can't clobber those fields.
  useEffect(() => {
    if (!params.id) return;
    getEventById(params.id)
      .then((fresh) => {
        setEvent((prev) => (prev ? { ...prev, ...fresh } : prev));
      })
      .catch((err) => {
        console.warn("Failed to fresh-fetch event:", err);
      });
  }, [params.id]);

  const [viewState, setViewState] = useState<ViewState>("form");
  const [attended, setAttended] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [starRating, setStarRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (parseError || !event) {
    return (
      <View style={[styles.center, themed.center]}>
        <Pressable onPress={() => router.back()} style={styles.backLink} testID="back-link">
          <Text style={[styles.backLinkText, themed.backLinkText]}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.error, themed.error]}>
          {parseError ? "Couldn't open this event — please go back and try again." : "Loading…"}
        </Text>
      </View>
    );
  }

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
        event.id,
        attended ? "SELF_REPORTED_YES" : "SELF_REPORTED_NO",
        attended
          ? { feedback: feedback.trim() || undefined, starRating: starRating ?? undefined }
          : { reason: reason.trim() }
      );
      setViewState("submitted");
    } catch (err) {
      // No proactive "already self-reported" check — this screen just
      // attempts submission and handles the existing error code gracefully,
      // rather than adding a new GET endpoint purely to check first.
      if (err instanceof ApiError && err.code === "SELF_REPORT_ALREADY_SUBMITTED") {
        setViewState("already-responded");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to submit self-report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, themed.container]}>
      <Pressable onPress={() => router.back()} style={styles.backLink} testID="back-link">
        <Text style={[styles.backLinkText, themed.backLinkText]}>‹ Back</Text>
      </Pressable>

      <Text style={[styles.name, themed.name]}>{event.name}</Text>
      <Text style={[styles.meta, themed.meta]}>{formatDateTimeRange(event.start_datetime, event.end_datetime)}</Text>
      <Text style={[styles.meta, themed.meta]}>{event.location_name}</Text>
      <Text style={[styles.metaSecondary, themed.metaSecondary]}>{event.location_address}</Text>
      <Text style={[styles.rsvp, { color: getRsvpStatusColor(colors, event.rsvp_status) }]}>{rsvpLabel(event)}</Text>

      <View style={[styles.divider, themed.divider]} />

      {viewState === "already-responded" ? (
        <Text style={[styles.info, themed.info]} testID="self-report-already-responded">
          You&apos;ve already submitted a self-report for this event.
        </Text>
      ) : viewState === "submitted" ? (
        <Text style={[styles.info, themed.info]} testID="self-report-submitted">Thanks — your self-report was submitted.</Text>
      ) : (
        <>
          <Text style={[styles.sectionTitle, themed.sectionTitle]}>Did you attend?</Text>

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
              testID="self-report-yes"
            >
              <Text style={[styles.buttonText, themed.buttonText, attended === true && styles.buttonTextSelected]}>
                Yes
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
              testID="self-report-no"
            >
              <Text style={[styles.buttonText, themed.buttonText, attended === false && styles.buttonTextSelected]}>
                No
              </Text>
            </Pressable>
          </View>

          {attended === true ? (
            <View style={styles.formSection}>
              <Text style={[styles.label, themed.label]}>Rating</Text>
              <View style={styles.starsRow}>
                {STAR_VALUES.map((value) => (
                  <Pressable key={value} onPress={() => setStarRating(value)} disabled={isSubmitting} testID={`self-report-star-${value}`}>
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
                testID="self-report-feedback-input"
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
                testID="self-report-reason-input"
              />
            </View>
          ) : null}

          {error ? (
            <Text style={[styles.error, themed.error]} testID="self-report-error">
              {error}
            </Text>
          ) : null}

          <Pressable
            style={[styles.submitButton, themed.submitButton, attended === null && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting || attended === null}
            testID="self-report-submit"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.buttonText, styles.buttonTextSelected]}>Submit</Text>
            )}
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: "#fff",
    flexGrow: 1,
  },
  backLink: {
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  backLinkText: {
    color: "#2563eb",
    fontSize: 15,
    fontWeight: "600",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 24,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
  },
  meta: {
    fontSize: 15,
    color: "#333",
    marginTop: 8,
  },
  metaSecondary: {
    fontSize: 14,
    color: "#777",
    marginTop: 2,
  },
  rsvp: {
    fontSize: 14,
    color: "#555",
    marginTop: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ddd",
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 12,
  },
  info: {
    fontSize: 15,
    color: "#333",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  formSection: {
    marginTop: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
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
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonNeutral: {
    backgroundColor: "#e5e7eb",
  },
  buttonSelected: {
    backgroundColor: "#2563eb",
  },
  // FP-96-FP-97-adj-1: this used to compose [styles.button, styles.buttonSubmit]
  // — button's flex: 1 makes sense for the Yes/No pair sharing a
  // flexDirection: "row" parent (styles.row), but this button sits alone in
  // the screen's column-direction ScrollView, where flex: 1 instead grows it
  // to fill all remaining vertical space. Dedicated style, no flex.
  submitButton: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#16a34a",
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "600",
  },
  buttonTextSelected: {
    color: "#fff",
  },
  error: {
    color: "#c0392b",
    fontSize: 13,
    marginTop: 12,
  },
});
