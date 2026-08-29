import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "@/src/lib/supabase";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

// DIP-FP-186-mobile: reuses registration's exact rule (web's
// register/set-password/page.tsx and reset-password/confirm/actions.ts both
// enforce this same threshold), confirmed live — not a new rule invented
// for this screen.
const MIN_PASSWORD_LENGTH = 8;

// Only the color-bearing keys from `styles` below, recomputed from the
// current theme at render time — everything structural stays in the static
// StyleSheet.create() untouched. Merged on top via style arrays.
function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { backgroundColor: colors.background },
    backLinkText: { color: colors.accent },
    title: { color: colors.text },
    label: { color: colors.text },
    input: { borderColor: colors.border, color: colors.text },
    button: { backgroundColor: colors.accent },
    error: { color: colors.danger },
    success: { color: colors.success },
  });
}

export default function ChangePasswordScreen() {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSuccessMessage(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      // DIP-FP-186-mobile: calls Supabase Auth directly against the
      // caller's own already-authenticated session — no current-password
      // re-entry, confirmed against web's own updateUser({ password })
      // usage (register/set-password, reset-password/confirm). No new
      // backend endpoint involved.
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setSuccessMessage("Password updated.");
      // Brief pause so the confirmation message is actually visible before
      // navigating back — this app has no toast/alert system to show it
      // any other way (confirmed: no Alert.alert usage anywhere in the app).
      setTimeout(() => router.back(), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView contentContainerStyle={[styles.container, themed.container]}>
      <Pressable onPress={() => router.back()} style={styles.backLink} testID="back-link">
        <Text style={[styles.backLinkText, themed.backLinkText]}>‹ Back</Text>
      </Pressable>

      <Text style={[styles.title, themed.title]}>Change Password</Text>

      <Text style={[styles.label, themed.label]}>New Password</Text>
      <TextInput
        style={[styles.input, themed.input]}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        editable={!isSubmitting}
        placeholderTextColor={colors.textMuted}
        testID="change-password-new"
      />

      <Text style={[styles.label, themed.label]}>Confirm New Password</Text>
      <TextInput
        style={[styles.input, themed.input]}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoComplete="new-password"
        editable={!isSubmitting}
        placeholderTextColor={colors.textMuted}
        testID="change-password-confirm"
      />

      {error ? (
        <Text style={[styles.error, themed.error]} testID="change-password-error">
          {error}
        </Text>
      ) : null}

      {successMessage ? (
        <Text style={[styles.success, themed.success]} testID="change-password-success">
          {successMessage}
        </Text>
      ) : null}

      <Pressable
        style={[styles.button, themed.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting || !password || !confirmPassword}
        testID="change-password-submit"
      >
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Update Password</Text>}
      </Pressable>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
  success: {
    color: "#16a34a",
    fontSize: 13,
    marginTop: 16,
  },
});
