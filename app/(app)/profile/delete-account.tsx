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
  View,
} from "react-native";
import { router } from "expo-router";
import { useSession } from "@/src/features/auth/hooks/useSession";
import { signOut, verifyPassword } from "@/src/features/auth/services/auth.service";
import { deleteOwnAccount } from "@/src/features/members/services/myProfile.service";
import { describeDeletionBlockers, withNotDeletedLine } from "@/src/features/members/removalBlockers";
import { ApiError } from "@/src/lib/api";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

// Only the color-bearing keys from `styles` below, recomputed from the
// current theme at render time — everything structural stays in the static
// StyleSheet.create() untouched. Merged on top via style arrays.
function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { backgroundColor: colors.background },
    backLinkText: { color: colors.accent },
    title: { color: colors.text },
    warning: { color: colors.textSecondary },
    label: { color: colors.text },
    input: { borderColor: colors.border, color: colors.text },
    button: { backgroundColor: colors.danger },
    error: { color: colors.danger },
  });
}

export default function DeleteAccountScreen() {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);
  const { session } = useSession();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  // FP-258: every reason the server says deletion is blocked, one sentence each.
  const [blockers, setBlockers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setBlockers([]);

    const email = session?.user.email;
    if (!email) {
      setError("No active session. Please sign in again.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Re-verifies identity via the same Supabase Auth check used at
      // login — a failure here throws a generic "Incorrect email or
      // password." message (see auth.service.ts) and the deletion call
      // below is never reached.
      await verifyPassword(email, password);

      try {
        await deleteOwnAccount();
      } catch (err) {
        if (err instanceof ApiError && err.code === "INVALID_STATE_TRANSITION") {
          setBlockers(withNotDeletedLine(describeDeletionBlockers(err)));
          return;
        }
        if (err instanceof ApiError && err.code === "AUTH_DELETE_FAILED") {
          // DIP-FP-187-mobile: the DB half already succeeded — this
          // person's data is already scrubbed and every other API call
          // already rejects them (deleted_at IS NULL check). A stray
          // auth.users row is a server-side cleanup item, not something
          // that leaves them with working access, so this still signs
          // them out and treats it as a completed deletion.
          await signOut();
          router.replace("/(auth)/login");
          return;
        }
        throw err;
      }

      await signOut();
      router.replace("/(auth)/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account.");
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

      <Text style={[styles.title, themed.title]}>Delete My Account</Text>
      <Text style={[styles.warning, themed.warning]}>
        This permanently deletes your account and cannot be undone. Enter your password to confirm.
      </Text>

      <Text style={[styles.label, themed.label]}>Password</Text>
      <TextInput
        style={[styles.input, themed.input]}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        editable={!isSubmitting}
        placeholderTextColor={colors.textMuted}
        testID="delete-account-password"
      />

      {blockers.length > 0 ? (
        <View accessible accessibilityLabel={blockers.join(" ")} style={styles.blockers} testID="delete-account-blockers">
          {blockers.map((line) => (
            <View key={line} style={styles.blockerRow}>
              <Text style={[styles.blockerBullet, themed.error]}>{"•"}</Text>
              <Text style={[styles.blockerText, themed.error]}>{line}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {error ? (
        <Text style={[styles.error, themed.error]} testID="delete-account-error">
          {error}
        </Text>
      ) : null}

      <Pressable
        style={[styles.button, themed.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting || !password}
        testID="delete-account-submit"
      >
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Delete My Account</Text>}
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
    // Extra keyboard-clearance room: this is a short form — only the Submit
    // button (no marginBottom) follows the single password field, not
    // enough runway on its own for the ScrollView to bring that field above
    // the keyboard (FP-203-mobile-adj-1).
    paddingBottom: 300,
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
  warning: {
    fontSize: 14,
    lineHeight: 20,
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
    backgroundColor: "#dc2626",
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
  blockers: {
    marginTop: 16,
    gap: 8,
  },
  blockerRow: {
    flexDirection: "row",
    gap: 8,
  },
  blockerBullet: {
    color: "#c0392b",
    fontSize: 14,
    lineHeight: 20,
  },
  blockerText: {
    flex: 1,
    color: "#c0392b",
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    color: "#c0392b",
    fontSize: 13,
    marginTop: 16,
  },
});
