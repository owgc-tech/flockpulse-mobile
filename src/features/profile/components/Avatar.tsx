import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { fetchMyProfile } from "@/src/features/members/services/myProfile.service";

export function getInitials(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0).toUpperCase();
  const last = lastName.trim().charAt(0).toUpperCase();
  const initials = `${first}${last}`;
  return initials || "?";
}

// Small circular badge in the header (top-right, present on every tab) —
// tapping it opens the Profile Card. Fetches the cached profile itself
// rather than requiring every screen that renders this to thread profile
// data down as a prop.
export function Avatar() {
  const [initials, setInitials] = useState("");

  useEffect(() => {
    fetchMyProfile()
      .then((profile) => setInitials(getInitials(profile.first_name, profile.last_name)))
      .catch(() => {
        // Leave the badge blank rather than blocking/erroring the header
        // over a failed profile fetch — tapping it still works either way.
      });
  }, []);

  return (
    <Pressable style={styles.avatar} onPress={() => router.push("/(app)/profile")} testID="avatar-button">
      <Text style={styles.initials}>{initials}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  initials: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
