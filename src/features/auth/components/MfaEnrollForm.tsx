import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SvgXml } from "react-native-svg";
import type { TotpEnrollment } from "@/src/features/auth/types";

interface MfaEnrollFormProps {
  enrollment: TotpEnrollment;
  onVerify: (code: string) => Promise<void>;
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
      <Text style={styles.instructions}>
        Scan this QR code with your authenticator app (e.g. Google Authenticator, Authy).
      </Text>

      <View style={styles.qrWrapper} testID="mfa-enroll-qr">
        <SvgXml xml={svgMarkup} width={220} height={220} />
      </View>

      <Text style={styles.fallbackLabel}>Can&apos;t scan? Enter this code manually:</Text>
      <Text selectable style={styles.secret} testID="mfa-enroll-secret">
        {enrollment.secret}
      </Text>

      <Text style={styles.label}>Verification code</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        editable={!isSubmitting}
        testID="mfa-enroll-code-input"
      />

      {error ? (
        <Text style={styles.error} testID="mfa-enroll-error">
          {error}
        </Text>
      ) : null}

      <Pressable
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
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
