import { useEffect } from "react";
import { AppState } from "react-native";
import { Tabs } from "expo-router";
import { useSession } from "@/src/features/auth/hooks/useSession";
import { syncConfirmationBadge } from "@/src/features/notifications/services/confirmationBadge.service";
import { useConfirmationBadgeCount } from "@/src/features/notifications/hooks/useConfirmationBadgeCount";
import { syncSelfReportBadge } from "@/src/features/notifications/services/selfReportBadge.service";
import { useSelfReportBadgeCount } from "@/src/features/notifications/hooks/useSelfReportBadgeCount";
import { syncMyTasksBadge } from "@/src/features/notifications/services/myTasksBadge.service";
import { useMyTasksBadgeCount } from "@/src/features/notifications/hooks/useMyTasksBadgeCount";
import { useMyEventsBadgeCount } from "@/src/features/notifications/hooks/useMyEventsBadgeCount";
import { AnimatedTabBar } from "@/src/features/navigation/AnimatedTabBar";

export default function TabsLayout() {
  const { session } = useSession();
  const role = session?.user.app_metadata?.role;
  const showConfirmations = role !== undefined && role !== "MEMBER";

  const pendingCount = useConfirmationBadgeCount();
  const pendingSelfReportCount = useSelfReportBadgeCount();
  const pendingMyTasksCount = useMyTasksBadgeCount();
  // DIP-FP-165: no accompanying sync effect here, unlike the other three
  // badges above — My Events (index.tsx) computes and syncs its own count
  // locally from state it already holds, rather than this layout fetching
  // anything on its behalf. This just consumes the resulting store value.
  const pendingMyEventsCount = useMyEventsBadgeCount();

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

  // DIP-FP-164: mirrors the Self-Report effect above exactly — My Tasks is
  // visible to every role (no role gate), so this syncs unconditionally on
  // mount and on every foreground transition, same AppState precedent.
  useEffect(() => {
    syncMyTasksBadge().catch((err) => {
      console.warn("Failed to sync My Tasks badge:", err);
    });

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        syncMyTasksBadge().catch((err) => {
          console.warn("Failed to sync My Tasks badge:", err);
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
  //
  // DIP-FP-155: tabBar hands rendering entirely to AnimatedTabBar, which
  // reads tabBarLabel/tabBarBadge/href (via tabBarItemStyle) itself from
  // each screen's descriptor options below — so tabBarStyle/
  // tabBarActiveTintColor/tabBarInactiveTintColor (the default renderer's
  // own styling hooks) are now redundant and removed; the custom tab bar
  // owns all of that.
  return (
    <Tabs
      tabBar={(props) => <AnimatedTabBar {...props} />}
      // DIP-FP-182-mobile-adj-1: the story's own confirmed decision is that
      // Dashboard is the landing route, not My Events — corrects the first
      // draft, which pinned initialRouteName to "index" instead.
      initialRouteName="dashboard/index"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="dashboard/index"
        options={{
          // Icon-only tab (see AnimatedTabBar's ALWAYS_ACCENT_ROUTES) — no
          // role gating, per this DIP's Grounding Check: visibility is
          // entirely a function of what the dashboard API returns, not
          // conditional logic here.
          tabBarLabel: "",
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: "My Events",
          // DIP-FP-165: events with no RSVP response yet, RSVP still open —
          // count computed locally in index.tsx (see its own comments),
          // synced into this same module-level-store/OS-badge pattern as
          // the other three tabs.
          tabBarBadge: pendingMyEventsCount > 0 ? pendingMyEventsCount : undefined,
        }}
      />
      <Tabs.Screen
        name="my-tasks/index"
        options={{
          tabBarLabel: "My Tasks",
          // DIP-FP-161-5-my-tasks-tab: no href gating — task assignments
          // aren't role-scoped (any member can be individually or
          // group-assigned a task). DIP-FP-164 superseded that DIP's
          // original "no badge" decision — badge added, mirroring
          // Confirmations/Self-Report's exact pattern.
          tabBarBadge: pendingMyTasksCount > 0 ? pendingMyTasksCount : undefined,
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
    </Tabs>
  );
}
