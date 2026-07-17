import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

interface MfaVerifyFormProps {
  onSubmit: (code: string) => Promise<void>;
}

// Only the color-bearing keys from `styles` below, recomputed from the
// current theme at render time — everything structural stays in the static
// StyleSheet.create() untouched. Merged on top via style arrays.
function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    instructions: { color: colors.text },
    input: { borderColor: colors.border, color: colors.text },
    error: { color: colors.danger },
    button: { backgroundColor: colors.accent },
  });
}

export function MfaVerifyForm({ onSubmit }: MfaVerifyFormProps) {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(code.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.instructions, themed.instructions]}>
        Enter the 6-digit code from your authenticator app.
      </Text>

      <TextInput
        style={[styles.input, themed.input]}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        editable={!isSubmitting}
        autoFocus
        placeholderTextColor={colors.textMuted}
        testID="mfa-verify-code-input"
      />

      {error ? (
        <Text style={[styles.error, themed.error]} testID="mfa-verify-error">
          {error}
        </Text>
      ) : null}

      <Pressable
        style={[styles.button, themed.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting || code.length < 6}
        testID="mfa-verify-submit"
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verify</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
  },
  instructions: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 20,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    textAlign: "center",
    letterSpacing: 4,
  },
  error: {
    color: "#c0392b",
    marginTop: 12,
  },
  button: {
    width: "100%",
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
