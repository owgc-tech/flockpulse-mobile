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
import { useSession } from "@/src/features/auth/hooks/useSession";
import { signInWithPassword, signOut } from "@/src/features/auth/services/auth.service";
import { deleteOwnAccount } from "@/src/features/members/services/myProfile.service";
import { ApiError } from "@/src/lib/api";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

// FP-187-mobile: builds first-person, count-specific copy from whichever of
// the three ApiError fields is set (INVALID_STATE_TRANSITION always sets
// exactly one — confirmed live against the route handler). Deliberately not
// the raw err.message: the DB trigger's text includes the member's raw UUID
// and reads as "Cannot deactivate member <uuid>: ..." — accurate but not
// fit for display to the person who just tapped a delete button.
function describeStateTransitionError(err: ApiError): string {
  if (err.ownedEventCount !== null) {
    const n = err.ownedEventCount;
    return `You still own ${n} event${n === 1 ? "" : "s"} — transfer ownership before deleting your account.`;
  }
  if (err.ownedGroupCount !== null) {
    const n = err.ownedGroupCount;
    return `You still own ${n} group${n === 1 ? "" : "s"} — transfer ownership before deleting your account.`;
  }
  if (err.assignedMemberCount !== null) {
    const n = err.assignedMemberCount;
    return `${n} member${n === 1 ? " is" : "s are"} still assigned to you as Assigned Leader — reassign them before deleting your account.`;
  }
  return err.message;
}

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);

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
      await signInWithPassword(email, password);

      try {
        await deleteOwnAccount();
      } catch (err) {
        if (err instanceof ApiError && err.code === "INVALID_STATE_TRANSITION") {
          setError(describeStateTransitionError(err));
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
  error: {
    color: "#c0392b",
    fontSize: 13,
    marginTop: 16,
  },
});
