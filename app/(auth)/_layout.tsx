import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="mfa-enroll" />
      <Stack.Screen name="mfa-verify" />
    </Stack>
  );
}
