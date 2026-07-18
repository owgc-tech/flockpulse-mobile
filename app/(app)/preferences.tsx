import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { listMyEvents } from "@/src/features/events/services/events.service";
import { reconcileEventReminders } from "@/src/features/notifications/services/reminders.service";
import {
  getReminderOffsetHours,
  setReminderOffsetHours,
} from "@/src/features/notifications/services/reminderSettings.service";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

// DIP-FP-110: soft cap, not a hard business rule — just keeps a member from
// entering something absurd (e.g. a typo'd extra digit) into a slot.
const MAX_HOURS = 336;

function validateHours(raw: string): number | null {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_HOURS) {
    return null;
  }
  return parsed;
}

// Only the color-bearing keys from `styles` below, recomputed from the
// current theme at render time — everything structural stays in the static
// StyleSheet.create() untouched. Merged on top via style arrays.
function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { backgroundColor: colors.background },
    center: { backgroundColor: colors.background },
    backLinkText: { color: colors.accent },
    title: { color: colors.text },
    label: { color: colors.text },
    input: { borderColor: colors.border, color: colors.text },
    button: { backgroundColor: colors.accent },
    error: { color: colors.danger },
  });
}

export default function PreferencesScreen() {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [slot1Hours, setSlot1Hours] = useState("");
  const [slot2Hours, setSlot2Hours] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const offsetHours = await getReminderOffsetHours();
      setSlot1Hours(String(offsetHours.slot1Hours));
      setSlot2Hours(String(offsetHours.slot2Hours));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load preferences.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async () => {
    const parsedSlot1 = validateHours(slot1Hours);
    const parsedSlot2 = validateHours(slot2Hours);
    if (parsedSlot1 === null || parsedSlot2 === null) {
      setError(`Enter a whole number of hours between 1 and ${MAX_HOURS} for each reminder.`);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await setReminderOffsetHours(parsedSlot1, parsedSlot2);
      // DIP-FP-110 Grounding Check: reconciliation only otherwise runs on
      // the events list's initial mount / pull-to-refresh, so this applies
      // the new offsets immediately rather than leaving them silent until
      // the member happens to refresh or reopen the app.
      const events = await listMyEvents();
      await reconcileEventReminders(events);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save preferences.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.center, themed.center]}>
        <Pressable onPress={() => router.back()} style={styles.backLink} testID="back-link">
          <Text style={[styles.backLinkText, themed.backLinkText]}>‹ Back</Text>
        </Pressable>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, themed.container]}>
      <Pressable onPress={() => router.back()} style={styles.backLink} testID="back-link">
        <Text style={[styles.backLinkText, themed.backLinkText]}>‹ Back</Text>
      </Pressable>

      <Text style={[styles.title, themed.title]}>Preferences</Text>

      <Text style={[styles.label, themed.label]}>Reminder 1 (hours before event)</Text>
      <TextInput
        style={[styles.input, themed.input]}
        value={slot1Hours}
        onChangeText={setSlot1Hours}
        keyboardType="number-pad"
        editable={!isSubmitting}
        placeholderTextColor={colors.textMuted}
        testID="preferences-slot1-hours"
      />

      <Text style={[styles.label, themed.label]}>Reminder 2 (hours before event)</Text>
      <TextInput
        style={[styles.input, themed.input]}
        value={slot2Hours}
        onChangeText={setSlot2Hours}
        keyboardType="number-pad"
        editable={!isSubmitting}
        placeholderTextColor={colors.textMuted}
        testID="preferences-slot2-hours"
      />

      {error ? (
        <Text style={[styles.error, themed.error]} testID="preferences-error">
          {error}
        </Text>
      ) : null}

      <Pressable
        style={[styles.button, themed.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        testID="preferences-submit"
      >
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: "#fff",
    flexGrow: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
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
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 32,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: "#c0392b",
    fontSize: 13,
    marginTop: 16,
  },
});
