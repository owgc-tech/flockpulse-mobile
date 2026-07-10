import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { RsvpStatus } from "@/src/features/events/types";

interface RsvpControlsProps {
  currentStatus: RsvpStatus | null;
  editable: boolean;
  readOnlyLabel: string;
  onSubmit: (status: RsvpStatus, reason?: string) => Promise<void>;
}

export function RsvpControls({ currentStatus, editable, readOnlyLabel, onSubmit }: RsvpControlsProps) {
  const [reason, setReason] = useState("");
  const [showReasonForm, setShowReasonForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!editable) {
    return (
      <View style={styles.readOnly} testID="rsvp-readonly">
        <Text style={styles.readOnlyText}>{readOnlyLabel}</Text>
      </View>
    );
  }

  const handlePressYes = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit("YES");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit RSVP.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitNo = async () => {
    if (!reason.trim()) {
      setError("Please provide a reason.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit("NO", reason.trim());
      setShowReasonForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit RSVP.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {currentStatus ? (
        <Text style={styles.currentLabel}>
          Current response: {currentStatus === "YES" ? "Going" : "Not going"}
        </Text>
      ) : null}

      {error ? (
        <Text style={styles.error} testID="rsvp-error">
          {error}
        </Text>
      ) : null}

      {showReasonForm ? (
        <View>
          <Text style={styles.label}>Reason for declining</Text>
          <TextInput
            style={styles.input}
            value={reason}
            onChangeText={setReason}
            multiline
            editable={!isSubmitting}
            testID="rsvp-reason-input"
          />
          <View style={styles.row}>
            <Pressable
              style={[styles.button, styles.buttonSecondary]}
              onPress={() => {
                setShowReasonForm(false);
                setError(null);
              }}
              disabled={isSubmitting}
              testID="rsvp-cancel-no"
            >
              <Text style={styles.buttonSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.buttonDanger]}
              onPress={handleSubmitNo}
              disabled={isSubmitting}
              testID="rsvp-submit-no"
            >
              {isSubmitting ? (
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
            disabled={isSubmitting}
            testID="rsvp-yes"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Yes, I&apos;ll be there</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.button, styles.buttonDanger]}
            onPress={() => setShowReasonForm(true)}
            disabled={isSubmitting}
            testID="rsvp-no"
          >
            <Text style={styles.buttonText}>Can&apos;t make it</Text>
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
