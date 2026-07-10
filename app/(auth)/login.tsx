import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { LoginForm } from "@/src/features/auth/components/LoginForm";
import { getAssuranceLevel, hasEnrolledTotpFactor, signInWithPassword } from "@/src/features/auth/services/auth.service";

export default function LoginScreen() {
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
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>FlockPulse</Text>
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
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 32,
  },
});
