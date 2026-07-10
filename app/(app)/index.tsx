import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { signOut } from "@/src/features/auth/services/auth.service";

// Placeholder app shell landing screen — the actual post-auth app
// experience is out of scope for this DIP (auth foundation only).
export default function AppHome() {
  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>You&apos;re signed in.</Text>
      <Pressable style={styles.button} onPress={handleSignOut} testID="sign-out">
        <Text style={styles.buttonText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 18,
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
