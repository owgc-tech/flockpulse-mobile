import { useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { signOut } from "@/src/features/auth/services/auth.service";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";
import { canSubmitAcceptance, getLegalPageUrl, type LegalPage } from "../acceptance";
import { submitAcceptance } from "../acceptance.service";

interface AcceptanceScreenProps {
  onAccepted: () => void;
}

const SAVE_FAILED_MESSAGE = "We couldn't save that. Please try again.";
const OPEN_FAILED_MESSAGE = "We couldn't open that page. Please try again.";
const SIGN_OUT_FAILED_MESSAGE = "We couldn't sign you out. Please try again.";

// Only the color-bearing keys from `styles` below, recomputed from the
// current theme at render time (same pattern as the login screen).
function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { backgroundColor: colors.background },
    title: { color: colors.text },
    body: { color: colors.text },
    link: { color: colors.accent },
    checkbox: { borderColor: colors.border },
    checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
    checkLabel: { color: colors.text },
    error: { color: colors.danger },
    button: { backgroundColor: colors.accent },
    note: { color: colors.textMuted },
    signOutText: { color: colors.accent },
  });
}

export function AcceptanceScreen({ onAccepted }: AcceptanceScreenProps) {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);
  const [terms, setTerms] = useState(false);
  const [adult, setAdult] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = canSubmitAcceptance(adult, terms) && !isSubmitting;

  const openLegalPage = async (page: LegalPage) => {
    setError(null);
    const url = getLegalPageUrl(process.env.EXPO_PUBLIC_API_BASE_URL, page);
    if (!url) {
      setError(OPEN_FAILED_MESSAGE);
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      setError(OPEN_FAILED_MESSAGE);
    }
  };

  const handleContinue = async () => {
    if (!canContinue) return;
    setError(null);
    setIsSubmitting(true);
    const ok = await submitAcceptance();
    setIsSubmitting(false);
    if (ok) {
      onAccepted();
    } else {
      setError(SAVE_FAILED_MESSAGE);
    }
  };

  const handleSignOut = async () => {
    setError(null);
    try {
      await signOut();
    } catch {
      setError(SIGN_OUT_FAILED_MESSAGE);
    }
  };

  return (
    <ScrollView
      style={[styles.flex, themed.container]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, themed.title]} accessibilityRole="header">
        Please confirm to continue
      </Text>

      <Text style={[styles.body, themed.body]}>
        We updated our{" "}
        <Text
          style={[styles.link, themed.link]}
          accessibilityRole="link"
          onPress={() => openLegalPage("terms")}
          testID="acceptance-terms-link"
        >
          Terms of Service
        </Text>{" "}
        and{" "}
        <Text
          style={[styles.link, themed.link]}
          accessibilityRole="link"
          onPress={() => openLegalPage("privacy")}
          testID="acceptance-privacy-link"
        >
          Privacy Policy
        </Text>
        . Please read them, then confirm below. FlockPulse does not ask for your birthdate.
      </Text>

      <Pressable
        style={styles.checkRow}
        onPress={() => setTerms((value) => !value)}
        disabled={isSubmitting}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: terms, disabled: isSubmitting }}
        testID="acceptance-terms-checkbox"
      >
        <View style={[styles.checkbox, themed.checkbox, terms && themed.checkboxChecked]}>
          {terms ? <Text style={styles.checkMark}>✓</Text> : null}
        </View>
        <Text style={[styles.checkLabel, themed.checkLabel]}>
          I accept the Terms of Service and the Privacy Policy.
        </Text>
      </Pressable>

      <Pressable
        style={styles.checkRow}
        onPress={() => setAdult((value) => !value)}
        disabled={isSubmitting}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: adult, disabled: isSubmitting }}
        testID="acceptance-adult-checkbox"
      >
        <View style={[styles.checkbox, themed.checkbox, adult && themed.checkboxChecked]}>
          {adult ? <Text style={styles.checkMark}>✓</Text> : null}
        </View>
        <Text style={[styles.checkLabel, themed.checkLabel]}>I confirm I am 18 or older.</Text>
      </Pressable>

      {error ? (
        <Text style={[styles.error, themed.error]} testID="acceptance-error">
          {error}
        </Text>
      ) : null}

      <Pressable
        style={[styles.button, themed.button, !canContinue && styles.buttonDisabled]}
        onPress={handleContinue}
        disabled={!canContinue}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canContinue }}
        testID="acceptance-continue"
      >
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue</Text>}
      </Pressable>

      <Text style={[styles.note, themed.note]}>If you do not agree, you can delete your account.</Text>

      <Pressable
        style={styles.signOut}
        onPress={handleSignOut}
        disabled={isSubmitting}
        accessibilityRole="link"
        testID="acceptance-sign-out"
      >
        <Text style={[styles.signOutText, themed.signOutText]}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
  },
  link: {
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    marginTop: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 4,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  checkLabel: {
    flex: 1,
    fontSize: 16,
  },
  error: {
    marginTop: 12,
  },
  button: {
    minHeight: 44,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  note: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
  },
  signOut: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
