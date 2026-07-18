import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { RsvpStatus } from "@/src/features/events/types";
import { getRsvpStatusColor } from "@/src/features/events/utils";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

// Only the color-bearing keys from `styles` below, recomputed from the
// current theme at render time — everything structural stays in the static
// StyleSheet.create() untouched. Merged on top via style arrays.
function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    currentLabel: { color: colors.textSecondary },
    readOnly: { backgroundColor: colors.cardBackground },
    buttonSecondary: { backgroundColor: colors.backgroundSecondary },
    buttonSecondaryText: { color: colors.text },
    buttonAccent: { backgroundColor: colors.warning },
    label: { color: colors.text },
    input: { color: colors.text, borderColor: colors.border },
    error: { color: colors.danger },
  });
}

interface RsvpControlsProps {
  currentStatus: RsvpStatus | null;
  editable: boolean;
  readOnlyLabel: string;
  onSubmit: (status: RsvpStatus, reason?: string) => Promise<void>;
}

export function RsvpControls({ currentStatus, editable, readOnlyLabel, onSubmit }: RsvpControlsProps) {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);
  const [reason, setReason] = useState("");
  const [showReasonForm, setShowReasonForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState<RsvpStatus | "NO_REASON" | null>(null);

  if (!editable) {
    return (
      <View style={[styles.readOnly, themed.readOnly]} testID="rsvp-readonly">
        <Text style={[styles.readOnlyText, { color: getRsvpStatusColor(colors, currentStatus) }]}>
          {readOnlyLabel}
        </Text>
      </View>
    );
  }

  const handlePressYes = async () => {
    setError(null);
    setSubmittingAction("YES");
    try {
      await onSubmit("YES");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit RSVP.");
    } finally {
      setSubmittingAction(null);
    }
  };

  const handlePressTentative = async () => {
    setError(null);
    setSubmittingAction("TENTATIVE");
    try {
      await onSubmit("TENTATIVE");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit RSVP.");
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleSubmitNo = async () => {
    if (!reason.trim()) {
      setError("Please provide a reason.");
      return;
    }
    setError(null);
    setSubmittingAction("NO_REASON");
    try {
      await onSubmit("NO", reason.trim());
      setShowReasonForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit RSVP.");
    } finally {
      setSubmittingAction(null);
    }
  };

  return (
    <View style={styles.container}>
      {currentStatus ? (
        <Text style={[styles.currentLabel, { color: getRsvpStatusColor(colors, currentStatus) }]}>
          Current response:{" "}
          {currentStatus === "YES" ? "Accepted" : currentStatus === "TENTATIVE" ? "Tentative" : "Declined"}
        </Text>
      ) : (
        <Text style={[styles.currentLabel, themed.currentLabel]}>You have not RSVPed</Text>
      )}

      {error ? (
        <Text style={[styles.error, themed.error]} testID="rsvp-error">
          {error}
        </Text>
      ) : null}

      {showReasonForm ? (
        <View>
          <Text style={[styles.label, themed.label]}>Reason for declining</Text>
          <TextInput
            style={[styles.input, themed.input]}
            value={reason}
            onChangeText={setReason}
            multiline
            editable={submittingAction === null}
            placeholderTextColor={colors.textMuted}
            testID="rsvp-reason-input"
          />
          <View style={styles.row}>
            <Pressable
              style={[styles.button, styles.buttonSecondary, themed.buttonSecondary]}
              onPress={() => {
                setShowReasonForm(false);
                setError(null);
              }}
              disabled={submittingAction !== null}
              testID="rsvp-cancel-no"
            >
              <Text style={[styles.buttonSecondaryText, themed.buttonSecondaryText]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.buttonDanger]}
              onPress={handleSubmitNo}
              disabled={submittingAction !== null}
              testID="rsvp-submit-no"
            >
              {submittingAction === "NO_REASON" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Submit</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <Pressable
            style={[styles.button, styles.buttonPrimary]}
            onPress={handlePressYes}
            disabled={submittingAction !== null}
            testID="rsvp-yes"
          >
            {submittingAction === "YES" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Accept</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.button, themed.buttonAccent]}
            onPress={handlePressTentative}
            disabled={submittingAction !== null}
            testID="rsvp-tentative"
          >
            {submittingAction === "TENTATIVE" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Tentative</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.button, styles.buttonDanger]}
            onPress={() => setShowReasonForm(true)}
            disabled={submittingAction !== null}
            testID="rsvp-no"
          >
            <Text style={styles.buttonText}>Decline</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  currentLabel: {
    fontSize: 14,
    color: "#555",
    marginBottom: 8,
  },
  readOnly: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
  },
  readOnlyText: {
    fontSize: 14,
    color: "#333",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonPrimary: {
    backgroundColor: "#16a34a",
  },
  buttonDanger: {
    backgroundColor: "#dc2626",
  },
  buttonSecondary: {
    backgroundColor: "#e5e7eb",
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  buttonSecondaryText: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "600",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
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
    marginBottom: 12,
  },
  error: {
    color: "#c0392b",
    fontSize: 13,
    marginBottom: 8,
  },
});
