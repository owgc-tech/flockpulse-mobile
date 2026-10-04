import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { TaskResponseStatus } from "@/src/features/tasks/types";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

// Only the color-bearing keys from `styles` below, recomputed from the
// current theme at render time — same convention as RsvpControls.
function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    commitOutline: { borderColor: colors.success },
    commitOutlineText: { color: colors.success },
    commitFilled: { backgroundColor: colors.success, borderColor: colors.success },
    refuseOutline: { borderColor: colors.danger },
    refuseOutlineText: { color: colors.danger },
    refuseFilled: { backgroundColor: colors.danger, borderColor: colors.danger },
    error: { color: colors.danger },
  });
}

interface TaskResponsePillsProps {
  assignmentId: string;
  currentResponse: TaskResponseStatus | null;
  // Rejects with the user-facing message on failure; the parent decides
  // whether to also reload the list (VALIDATION_ERROR / FORBIDDEN_SCOPE).
  onSubmit: (status: TaskResponseStatus) => Promise<void>;
}

// FP-221: Commit / Refuse pills for one My Tasks card. The chosen pill is
// filled, the other outlined, neither filled while currentResponse is null.
// The pills are nested Pressables, so a tap on an enabled pill is claimed by
// it and doesn't reach the card's navigation onPress. They are deliberately
// NOT set `disabled` while sending: a disabled Pressable doesn't claim the
// touch, so a second tap in the in-flight window would fall through to the
// card. handlePress's guard ignores presses while sending instead.
// Submitting state is per-card (local).
export function TaskResponsePills({ assignmentId, currentResponse, onSubmit }: TaskResponsePillsProps) {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);
  const [submitting, setSubmitting] = useState<TaskResponseStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePress = async (status: TaskResponseStatus) => {
    if (submitting || status === currentResponse) return;
    setError(null);
    setSubmitting(status);
    try {
      await onSubmit(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save your response.");
    } finally {
      setSubmitting(null);
    }
  };

  const isCommitted = currentResponse === "COMMITTED";
  const isRefused = currentResponse === "REFUSED";
  const disabled = submitting !== null;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable
          style={[styles.pill, isCommitted ? themed.commitFilled : themed.commitOutline]}
          onPress={() => handlePress("COMMITTED")}
          accessibilityRole="button"
          accessibilityLabel="Commit to this task"
          accessibilityState={{ selected: isCommitted, disabled }}
          testID={`my-task-commit-${assignmentId}`}
        >
          {submitting === "COMMITTED" ? (
            <ActivityIndicator size="small" color={isCommitted ? "#fff" : colors.success} />
          ) : (
            <Text style={[styles.pillText, isCommitted ? styles.pillTextFilled : themed.commitOutlineText]}>
              Commit
            </Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.pill, isRefused ? themed.refuseFilled : themed.refuseOutline]}
          onPress={() => handlePress("REFUSED")}
          accessibilityRole="button"
          accessibilityLabel="Refuse this task"
          accessibilityState={{ selected: isRefused, disabled }}
          testID={`my-task-refuse-${assignmentId}`}
        >
          {submitting === "REFUSED" ? (
            <ActivityIndicator size="small" color={isRefused ? "#fff" : colors.danger} />
          ) : (
            <Text style={[styles.pillText, isRefused ? styles.pillTextFilled : themed.refuseOutlineText]}>
              Refuse
            </Text>
          )}
        </Pressable>
      </View>
      {error ? (
        <Text style={[styles.error, themed.error]} testID={`my-task-response-error-${assignmentId}`}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  pill: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
  },
  pillText: {
    fontSize: 14,
    fontWeight: "600",
  },
  pillTextFilled: {
    color: "#fff",
  },
  error: {
    fontSize: 13,
    marginTop: 8,
  },
});
