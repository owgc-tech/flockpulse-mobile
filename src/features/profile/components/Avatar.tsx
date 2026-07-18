import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/src/lib/supabase";
import { useSession } from "@/src/features/auth/hooks/useSession";
import { signOut } from "@/src/features/auth/services/auth.service";
import { fetchMyProfile } from "@/src/features/members/services/myProfile.service";
import type { MyProfile } from "@/src/features/members/types";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

function getInitials(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0).toUpperCase();
  const last = lastName.trim().charAt(0).toUpperCase();
  const initials = `${first}${last}`;
  return initials || "?";
}

// FP-96-FP-97-adj-1: was missing the four roles FP-113-web added on the
// backend (SR_COORDINATOR/COORDINATOR/COMMUNITY_SERVANT/PASTORAL_LEADER) —
// those accounts fell through to the raw role string via the ?? role
// fallback below instead of a proper label.
const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  SR_COORDINATOR: "Sr. Coordinator",
  COORDINATOR: "Coordinator",
  COMMUNITY_SERVANT: "Community Servant",
  LEADER: "Leader",
  PASTORAL_LEADER: "Pastoral Leader",
  MEMBER: "Member",
};

// FP-118 round 2 Grounding Check: this now sits inside CommunityBanner
// (whose own height varies by device via the safe-area inset) rather than
// a fixed-height native header — so, like the monthCard flyout in the
// FP-118 round, this is a best-effort estimate of the banner's own content
// height (below the inset), not a measured one. Combined with insets.top
// below, it should land close, but plan on one more round of on-device
// pixel tuning if it doesn't sit flush under the banner on your device.
const PROFILE_CARD_BANNER_HEIGHT_ESTIMATE = 70;

// Only the color-bearing keys from `styles` below, recomputed from the
// current theme at render time — everything structural stays in the static
// StyleSheet.create() untouched. Merged on top via style arrays. avatar/
// avatarLarge/editButton stay accent-colored buttons/badges with white text
// in both themes (untouched, same precedent as other screens' FABs).
function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    cardWrapper: { backgroundColor: colors.cardBackground },
    loading: { color: colors.textSecondary },
    name: { color: colors.text },
    role: { color: colors.textSecondary },
    groupsHeading: { color: colors.text },
    groupText: { color: colors.textSecondary },
    signOutText: { color: colors.danger },
  });
}

// Small circular badge in the banner (top-right, present on every screen) —
// tapping it opens the Profile Card as a positioned popover anchored to
// this badge, not a navigated screen (only "Edit Profile" pushes a real
// route). Owns the profile fetch and the overlay's own open/close state.
export function Avatar() {
  const { session } = useSession();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);
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

  // FP-96-FP-97-adj-1: forces a session refresh on open rather than waiting
  // for the natural token-refresh cycle, so a role change made on web shows
  // up here promptly. Best-effort — useSession() already listens for
  // TOKEN_REFRESHED and updates session.user.app_metadata.role reactively
  // once this resolves; if it fails, the card still shows whatever role is
  // in the current session, which is no worse than before this change.
  const handleOpenProfile = () => {
    setIsOpen(true);
    supabase.auth.refreshSession().catch(() => {
      // Best-effort — if this fails, the card still shows whatever role
      // is in the current session; no need to block opening over it.
    });
  };

  const handleEditProfile = () => {
    setIsOpen(false);
    router.push("/(app)/profile/edit");
  };

  const handlePreferences = () => {
    setIsOpen(false);
    router.push("/(app)/preferences");
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
      <Pressable style={styles.avatar} onPress={handleOpenProfile} testID="avatar-button">
        <Text style={styles.initials}>{initials}</Text>
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        {/* Full-screen, fully transparent (no dimming) — its only job is
            capturing taps outside the card to dismiss. Rendered as a
            sibling of the card, not a parent, so a tap that lands on the
            card hits the card's own view first and never reaches this. */}
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)} testID="profile-overlay-backdrop" />

        <View
          style={[styles.cardWrapper, themed.cardWrapper, { top: insets.top + PROFILE_CARD_BANNER_HEIGHT_ESTIMATE }]}
          testID="profile-card"
        >
          {!profile ? (
            <Text style={[styles.loading, themed.loading]}>Loading…</Text>
          ) : (
            <>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarLargeInitials}>{initials}</Text>
              </View>
              <Text style={[styles.name, themed.name]}>
                {profile.first_name} {profile.last_name}
              </Text>
              {roleLabel ? <Text style={[styles.role, themed.role]}>{roleLabel}</Text> : null}

              {profile.groups.length > 0 ? (
                <View style={styles.groupsSection}>
                  <Text style={[styles.groupsHeading, themed.groupsHeading]}>Groups</Text>
                  {profile.groups.map((group) => (
                    <Text key={group.id} style={[styles.groupText, themed.groupText]}>
                      {group.name}
                    </Text>
                  ))}
                </View>
              ) : null}

              <Pressable style={styles.editButton} onPress={handleEditProfile} testID="profile-edit-button">
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </Pressable>

              <View style={styles.secondaryActionsRow}>
                <Pressable onPress={handlePreferences} testID="preferences-link">
                  <Text style={[styles.signOutText, themed.signOutText]}>Preferences</Text>
                </Pressable>

                <Pressable onPress={handleSignOut} testID="sign-out">
                  <Text style={[styles.signOutText, themed.signOutText]}>Sign Out</Text>
                </Pressable>
              </View>
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
    // top is set inline (insets.top + PROFILE_CARD_BANNER_HEIGHT_ESTIMATE)
    // — see that constant's doc comment above.
    position: "absolute",
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
  secondaryActionsRow: {
    flexDirection: "row",
    alignSelf: "stretch",
    justifyContent: "space-between",
    marginTop: 12,
  },
  signOutText: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "600",
  },
});
