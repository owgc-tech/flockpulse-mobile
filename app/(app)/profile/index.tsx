import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import { fetchMyProfile } from "@/src/features/members/services/myProfile.service";
import { signOut } from "@/src/features/auth/services/auth.service";
import { getInitials } from "@/src/features/profile/components/Avatar";
import type { MyProfile } from "@/src/features/members/types";

export default function ProfileCardScreen() {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchMyProfile();
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "Profile" }} />

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : !profile ? (
        <ActivityIndicator />
      ) : (
        <>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarInitials}>{getInitials(profile.first_name, profile.last_name)}</Text>
          </View>
          <Text style={styles.name}>
            {profile.first_name} {profile.last_name}
          </Text>

          {profile.groups.length > 0 ? (
            <View style={styles.groups}>
              {profile.groups.map((group) => (
                <Text key={group.id} style={styles.groupText}>
                  {group.name}
                </Text>
              ))}
            </View>
          ) : null}

          <Pressable
            style={styles.button}
            onPress={() => router.push("/(app)/profile/edit")}
            testID="profile-edit-button"
          >
            <Text style={styles.buttonText}>Profile</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.buttonDanger]} onPress={handleSignOut} testID="sign-out">
            <Text style={styles.buttonText}>Sign Out</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    padding: 24,
    paddingTop: 48,
    backgroundColor: "#fff",
  },
  avatarLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarInitials: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "700",
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  groups: {
    marginTop: 8,
    alignItems: "center",
  },
  groupText: {
    fontSize: 14,
    color: "#555",
  },
  button: {
    width: "100%",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#2563eb",
    marginTop: 32,
  },
  buttonDanger: {
    backgroundColor: "#dc2626",
    marginTop: 12,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: "#c0392b",
    fontSize: 15,
    textAlign: "center",
  },
});
