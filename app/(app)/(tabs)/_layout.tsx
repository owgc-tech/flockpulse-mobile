import { Tabs } from "expo-router";
import { useSession } from "@/src/features/auth/hooks/useSession";
import { Avatar } from "@/src/features/profile/components/Avatar";

export default function TabsLayout() {
  const { session } = useSession();
  // Guarded on role being known yet (not just "!== MEMBER"), same pattern
  // used for the roster section on the event detail screen — defaults to
  // hidden while this layout's own useSession() call is still resolving
  // (even though the parent gate already confirmed a valid session), rather
  // than briefly flashing the Confirmations tab in for a Member.
  const role = session?.user.app_metadata?.role;
  const showConfirmationsTab = role !== undefined && role !== "MEMBER";

  return (
    <Tabs screenOptions={{ headerRight: () => <Avatar /> }}>
      <Tabs.Screen name="index" options={{ title: "My Events" }} />
      <Tabs.Screen
        name="confirmations/index"
        options={{
          title: "Confirmations",
          // href: null hides the tab bar button entirely (not just an empty
          // screen) — the documented Expo Router pattern for this.
          href: showConfirmationsTab ? undefined : null,
        }}
      />
    </Tabs>
  );
}
