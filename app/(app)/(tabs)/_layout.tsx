import { useEffect } from "react";
import { AppState } from "react-native";
import { Tabs } from "expo-router";
import { useSession } from "@/src/features/auth/hooks/useSession";
import { syncConfirmationBadge } from "@/src/features/notifications/services/confirmationBadge.service";
import { useConfirmationBadgeCount } from "@/src/features/notifications/hooks/useConfirmationBadgeCount";
import { syncSelfReportBadge } from "@/src/features/notifications/services/selfReportBadge.service";
import { useSelfReportBadgeCount } from "@/src/features/notifications/hooks/useSelfReportBadgeCount";

export default function TabsLayout() {
  const { session } = useSession();
  const role = session?.user.app_metadata?.role;
  const showConfirmations = role !== undefined && role !== "MEMBER";

  const pendingCount = useConfirmationBadgeCount();
  const pendingSelfReportCount = useSelfReportBadgeCount();

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

  // DIP-FP-119-mobile: Self-Report is visible to every role (unlike
  // Confirmations), so this syncs unconditionally on mount and on every
  // foreground transition — same AppState precedent as the Confirmations
  // effect above, kept as a separate effect since it has no role gate to
  // share.
  useEffect(() => {
    syncSelfReportBadge().catch((err) => {
      console.warn("Failed to sync self-report badge:", err);
    });

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        syncSelfReportBadge().catch((err) => {
          console.warn("Failed to sync self-report badge:", err);
        });
      }
    });

    return () => subscription.remove();
  }, []);

  // FP-118 round 2: headerShown: false (was headerRight: () => <Avatar />)
  // — Avatar now lives in CommunityBanner, rendered once above this whole
  // Stack/Tabs tree in (app)/_layout.tsx, not per-tab. tabBarLabel/
  // tabBarBadge/href below are untouched — those control the bottom tab
  // bar, which headerShown doesn't affect.
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ tabBarLabel: "My Events" }} />
      <Tabs.Screen
        name="confirmations/index"
        options={{
          tabBarLabel: "Confirmations",
          href: showConfirmations ? undefined : null,
          // undefined (not 0) when there's nothing pending — Tabs.Screen
          // renders a bare dot for any defined badge value, including 0.
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
        }}
      />
      <Tabs.Screen
        name="self-report/index"
        options={{
          tabBarLabel: "Self-Report",
          // No href gating — visible to every role, unlike Confirmations.
          tabBarBadge: pendingSelfReportCount > 0 ? pendingSelfReportCount : undefined,
        }}
      />
    </Tabs>
  );
}
