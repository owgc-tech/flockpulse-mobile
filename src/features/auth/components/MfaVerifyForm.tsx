import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

interface MfaVerifyFormProps {
  onSubmit: (code: string) => Promise<void>;
}

export function MfaVerifyForm({ onSubmit }: MfaVerifyFormProps) {
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
      <Text style={styles.instructions}>
        Enter the 6-digit code from your authenticator app.
      </Text>

      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        editable={!isSubmitting}
        autoFocus
        testID="mfa-verify-code-input"
      />

      {error ? (
        <Text style={styles.error} testID="mfa-verify-error">
          {error}
        </Text>
      ) : null}

      <Pressable
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
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
