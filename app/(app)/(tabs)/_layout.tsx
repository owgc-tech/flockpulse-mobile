import { useEffect } from "react";
import { AppState } from "react-native";
import { Tabs } from "expo-router";
import { useSession } from "@/src/features/auth/hooks/useSession";
import { Avatar } from "@/src/features/profile/components/Avatar";
import { syncConfirmationBadge } from "@/src/features/notifications/services/confirmationBadge.service";
import { useConfirmationBadgeCount } from "@/src/features/notifications/hooks/useConfirmationBadgeCount";

export default function TabsLayout() {
  const { session } = useSession();
  const role = session?.user.app_metadata?.role;
  const showConfirmations = role !== undefined && role !== "MEMBER";

  const pendingCount = useConfirmationBadgeCount();

  // FP-99: syncs both the OS app icon badge and (via the shared store
  // useConfirmationBadgeCount exposes) this tab's own badge — on mount and
  // on every foreground transition, same AppState precedent as
  // src/lib/supabase.ts's auto-refresh toggle. Gated on showConfirmations so
  // a Member account (already 403'd server-side) never bothers making the
  // call at all.
  useEffect(() => {
    if (!showConfirmations) return;

    syncConfirmationBadge().catch((err) => {
      console.warn("Failed to sync confirmation badge:", err);
    });

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        syncConfirmationBadge().catch((err) => {
          console.warn("Failed to sync confirmation badge:", err);
        });
      }
    });

    return () => subscription.remove();
  }, [showConfirmations]);

  return (
    <Tabs screenOptions={{ headerRight: () => <Avatar /> }}>
      {/* FP-118: title used to double as both the native header text and
          the bottom tab bar's label (React Navigation falls back to title
          for tabBarLabel when it isn't set explicitly) — blanking title
          outright would've silently wiped the tab bar's own labels too.
          tabBarLabel + headerTitle: () => null keeps the tab bar text while
          removing just the now-redundant native header title. */}
      <Tabs.Screen name="index" options={{ tabBarLabel: "My Events", headerTitle: () => null }} />
      <Tabs.Screen
        name="confirmations/index"
        options={{
          tabBarLabel: "Confirmations",
          headerTitle: () => null,
          href: showConfirmations ? undefined : null,
          // undefined (not 0) when there's nothing pending — Tabs.Screen
          // renders a bare dot for any defined badge value, including 0.
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
        }}
      />
    </Tabs>
  );
}
