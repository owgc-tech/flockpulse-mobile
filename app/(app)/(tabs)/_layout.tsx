import { Tabs } from "expo-router";
import { useSession } from "@/src/features/auth/hooks/useSession";
import { Avatar } from "@/src/features/profile/components/Avatar";

export default function TabsLayout() {
  const { session } = useSession();
  const role = session?.user.app_metadata?.role;
  const showConfirmations = role !== undefined && role !== "MEMBER";

  return (
    <Tabs screenOptions={{ headerRight: () => <Avatar /> }}>
      <Tabs.Screen name="index" options={{ title: "My Events" }} />
      <Tabs.Screen
        name="confirmations/index"
        options={{ title: "Confirmations", href: showConfirmations ? undefined : null }}
      />
    </Tabs>
  );
}
