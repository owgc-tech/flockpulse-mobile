import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SvgXml } from "react-native-svg";
import type { TotpEnrollment } from "@/src/features/auth/types";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

interface MfaEnrollFormProps {
  enrollment: TotpEnrollment;
  onVerify: (code: string) => Promise<void>;
}

// Only the color-bearing keys from `styles` below, recomputed from the
// current theme at render time — everything structural stays in the static
// StyleSheet.create() untouched. Merged on top via style arrays.
// Deliberate exception: `qrWrapper`'s white background is NOT themed — the
// QR SVG itself is rendered black-on-white by Supabase and needs that
// contrast to stay scannable; darkening the card around it would risk an
// unscannable code in dark mode, which is worse than a visual mismatch.
function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    instructions: { color: colors.text },
    fallbackLabel: { color: colors.textSecondary },
    secret: { color: colors.text },
    label: { color: colors.text },
    input: { borderColor: colors.border, color: colors.text },
    error: { color: colors.danger },
    button: { backgroundColor: colors.accent },
  });
}

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// No Buffer/atob global is guaranteed on Hermes, so decode base64 manually
// rather than pulling in a polyfill for this one call site.
function decodeBase64(input: string): string {
  const clean = input.replace(/[^A-Za-z0-9+/=]/g, "");
  let output = "";
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    if (char === "=") break;
    const value = BASE64_CHARS.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return output;
}

// Supabase returns totp.qr_code as a raw "data:image/svg+xml;utf-8,<svg>...</svg>"
// (or base64-encoded) data URI. React Native's <Image> can't rasterize SVG, so
// we strip the data-URI prefix and hand the raw markup to react-native-svg's
// SvgXml, which renders an SVG string directly at runtime.
function extractSvgMarkup(dataUri: string): string {
  const commaIndex = dataUri.indexOf(",");
  if (commaIndex === -1) return dataUri;
  const encoded = dataUri.slice(commaIndex + 1);
  if (dataUri.includes(";base64,")) {
    return decodeBase64(encoded);
  }
  return decodeURIComponent(encoded);
}

export function MfaEnrollForm({ enrollment, onVerify }: MfaEnrollFormProps) {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const svgMarkup = extractSvgMarkup(enrollment.qrCode);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await onVerify(code.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.instructions, themed.instructions]}>
        Scan this QR code with your authenticator app (e.g. Google Authenticator, Authy).
      </Text>

      {/* Deliberately not themed — see getThemedStyles' comment. */}
      <View style={styles.qrWrapper} testID="mfa-enroll-qr">
        <SvgXml xml={svgMarkup} width={220} height={220} />
      </View>

      <Text style={[styles.fallbackLabel, themed.fallbackLabel]}>Can&apos;t scan? Enter this code manually:</Text>
      <Text selectable style={[styles.secret, themed.secret]} testID="mfa-enroll-secret">
        {enrollment.secret}
      </Text>

      <Text style={[styles.label, themed.label]}>Verification code</Text>
      <TextInput
        style={[styles.input, themed.input]}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        editable={!isSubmitting}
        placeholderTextColor={colors.textMuted}
        testID="mfa-enroll-code-input"
      />

      {error ? (
        <Text style={[styles.error, themed.error]} testID="mfa-enroll-error">
          {error}
        </Text>
      ) : null}

      <Pressable
        style={[styles.button, themed.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting || code.length < 6}
        testID="mfa-enroll-submit"
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verify and Enable</Text>
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
    marginBottom: 16,
  },
  qrWrapper: {
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 16,
  },
  fallbackLabel: {
    fontSize: 13,
    color: "#555",
    marginTop: 4,
  },
  secret: {
    fontSize: 14,
    fontFamily: "monospace",
    marginTop: 4,
    marginBottom: 16,
    letterSpacing: 1,
  },
  label: {
    alignSelf: "flex-start",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
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
