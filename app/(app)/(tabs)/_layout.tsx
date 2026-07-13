import { Stack } from "expo-router";
import { Avatar } from "@/src/features/profile/components/Avatar";

// DIP-FP-115-mobile-nav-calendar-edit: the bottom tab bar is gone — My
// Events and Confirmations are now both reached through the hamburger
// NavMenu (rendered by index.tsx's own headerLeft), not tab buttons. This
// is a plain Stack so each screen still gets its own header + the shared
// Avatar on the right; the role-based Confirmations visibility check that
// used to live here as `href: null` now lives in NavMenu instead, since
// there's no tab bar button left to hide.
export default function TabsLayout() {
  return (
    <Stack screenOptions={{ headerRight: () => <Avatar /> }}>
      <Stack.Screen name="index" options={{ title: "My Events" }} />
      <Stack.Screen name="confirmations/index" options={{ title: "Confirmations" }} />
    </Stack>
  );
}
