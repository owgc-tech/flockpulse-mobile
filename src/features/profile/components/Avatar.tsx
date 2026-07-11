import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSession } from "@/src/features/auth/hooks/useSession";
import { signOut } from "@/src/features/auth/services/auth.service";
import { fetchMyProfile } from "@/src/features/members/services/myProfile.service";
import type { MyProfile } from "@/src/features/members/types";

function getInitials(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0).toUpperCase();
  const last = lastName.trim().charAt(0).toUpperCase();
  const initials = `${first}${last}`;
  return initials || "?";
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  LEADER: "Leader",
  MEMBER: "Member",
};

// Small circular badge in the header (top-right, present on every tab) —
// tapping it opens the Profile Card as a positioned popover anchored to
// this badge, not a navigated screen (only "Edit Profile" pushes a real
// route). Owns the profile fetch and the overlay's own open/close state.
export function Avatar() {
  const { session } = useSession();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchMyProfile()
      .then(setProfile)
      .catch(() => {
        // Leave the card's content blank rather than blocking/erroring the
        // header over a failed profile fetch — tapping it still works.
      });
  }, []);

  const handleEditProfile = () => {
    setIsOpen(false);
    router.push("/(app)/profile/edit");
  };

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
    router.replace("/(auth)/login");
  };

  const initials = profile ? getInitials(profile.first_name, profile.last_name) : "";
  const role = session?.user.app_metadata?.role;
  const roleLabel = typeof role === "string" ? (ROLE_LABELS[role] ?? role) : "";

  return (
    <>
      <Pressable style={styles.avatar} onPress={() => setIsOpen(true)} testID="avatar-button">
        <Text style={styles.initials}>{initials}</Text>
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        {/* Full-screen, fully transparent (no dimming) — its only job is
            capturing taps outside the card to dismiss. Rendered as a
            sibling of the card, not a parent, so a tap that lands on the
            card hits the card's own view first and never reaches this. */}
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)} testID="profile-overlay-backdrop" />

        <View style={styles.cardWrapper} testID="profile-card">
          {!profile ? (
            <Text style={styles.loading}>Loading…</Text>
          ) : (
            <>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarLargeInitials}>{initials}</Text>
              </View>
              <Text style={styles.name}>
                {profile.first_name} {profile.last_name}
              </Text>
              {roleLabel ? <Text style={styles.role}>{roleLabel}</Text> : null}

              {profile.groups.length > 0 ? (
                <View style={styles.groupsSection}>
                  <Text style={styles.groupsHeading}>Groups</Text>
                  {profile.groups.map((group) => (
                    <Text key={group.id} style={styles.groupText}>
                      {group.name}
                    </Text>
                  ))}
                </View>
              ) : null}

              <Pressable style={styles.editButton} onPress={handleEditProfile} testID="profile-edit-button">
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </Pressable>

              <Pressable onPress={handleSignOut} style={styles.signOutLink} testID="sign-out">
                <Text style={styles.signOutText}>Sign Out</Text>
              </Pressable>
            </>
          )}
        </View>
      </Modal>
    </>
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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  cardWrapper: {
    position: "absolute",
    top: 70,
    right: 16,
    width: "60%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  loading: {
    fontSize: 14,
    color: "#555",
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarLargeInitials: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  role: {
    fontSize: 13,
    fontWeight: "400",
    color: "#666",
    marginTop: 2,
  },
  groupsSection: {
    alignSelf: "stretch",
    marginTop: 16,
  },
  groupsHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  groupText: {
    fontSize: 14,
    color: "#555",
  },
  editButton: {
    alignSelf: "stretch",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#2563eb",
    marginTop: 20,
  },
  editButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  signOutLink: {
    alignSelf: "flex-end",
    marginTop: 12,
  },
  signOutText: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "600",
  },
});
