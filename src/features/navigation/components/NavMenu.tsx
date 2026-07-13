import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSession } from "@/src/features/auth/hooks/useSession";

// Replaces the removed bottom tab bar (DIP-FP-115-mobile-nav-calendar-edit)
// — same popover pattern as Avatar.tsx (self-contained trigger + transparent
// backdrop Modal), just anchored top-left instead of top-right. Confirmations
// visibility uses the same "role known and not MEMBER" check that used to
// gate the tab bar button's `href: null`; the underlying rule is unchanged,
// only which UI surface enforces it.
export function NavMenu() {
  const { session } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  const role = session?.user.app_metadata?.role;
  const showConfirmations = role !== undefined && role !== "MEMBER";

  // router.navigate (not push) — this is a destination switch, not a
  // drill-down; re-selecting the screen you're already on shouldn't stack a
  // duplicate entry the way tapping into an event detail should.
  const goToMyEvents = () => {
    setIsOpen(false);
    router.navigate("/(app)");
  };

  const goToConfirmations = () => {
    setIsOpen(false);
    router.navigate("/(app)/confirmations");
  };

  return (
    <>
      <Pressable style={styles.menuButton} onPress={() => setIsOpen(true)} testID="nav-menu-button">
        <Text style={styles.menuIcon}>☰</Text>
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)} testID="nav-menu-backdrop" />

        <View style={styles.cardWrapper} testID="nav-menu-card">
          <Pressable style={styles.menuItem} onPress={goToMyEvents} testID="nav-menu-my-events">
            <Text style={styles.menuItemText}>My Events</Text>
          </Pressable>
          {showConfirmations ? (
            <Pressable style={styles.menuItem} onPress={goToConfirmations} testID="nav-menu-confirmations">
              <Text style={styles.menuItemText}>Confirmations</Text>
            </Pressable>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    padding: 4,
  },
  menuIcon: {
    fontSize: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  cardWrapper: {
    position: "absolute",
    top: 70,
    left: 16,
    width: "55%",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  menuItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
  },
});
