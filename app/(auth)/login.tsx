import { useMemo, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { LoginForm } from "@/src/features/auth/components/LoginForm";
import { getAssuranceLevel, hasEnrolledTotpFactor, signInWithPassword } from "@/src/features/auth/services/auth.service";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

// Only the color-bearing keys from `styles` below, recomputed from the
// current theme at render time — everything structural stays in the static
// StyleSheet.create() untouched. Merged on top via style arrays.
function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { backgroundColor: colors.background },
    poweredBy: { color: colors.textSecondary },
  });
}

export default function LoginScreen() {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleSubmit = async (email: string, password: string) => {
    await signInWithPassword(email, password);
    setIsNavigating(true);

    // FP-89 AC: session alone doesn't grant app access — check assurance
    // level immediately so an aal2-required account never sees the app
    // shell before completing MFA (FP-91).
    const { currentLevel, nextLevel } = await getAssuranceLevel();

    if (nextLevel === "aal2" && currentLevel === "aal1") {
      router.replace("/(auth)/mfa-verify");
      return;
    }

    const hasFactor = await hasEnrolledTotpFactor();
    if (!hasFactor) {
      router.replace("/(auth)/mfa-enroll");
      return;
    }

    router.replace("/(app)");
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, themed.container]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.content}>
        <View style={styles.logoBlock}>
          <Text style={[styles.poweredBy, themed.poweredBy]}>Powered by:</Text>
          <Image
            source={require("@/assets/flockpulse-logo.png")}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="FlockPulse"
          />
        </View>
        <LoginForm onSubmit={isNavigating ? async () => {} : handleSubmit} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  logoBlock: {
    alignItems: "flex-start",
    marginBottom: 32,
  },
  poweredBy: {
    fontSize: 13,
    marginBottom: 4,
  },
  logo: {
    // FlockPulseLogo2_AP5.png is a square/stacked mark (measured source: 2000x2000,
    // bundled at 640x640) — fixed width rather than a screen-width percentage so it
    // doesn't balloon into an oversized square on tablets (aspectRatio: 1 means
    // height grows 1:1 with width, unlike web's wide 2:1 lockup).
    width: 140,
    aspectRatio: 1,
  },
});
