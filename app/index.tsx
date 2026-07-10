import { Redirect } from "expo-router";

// Single entry point: the (app) route group's layout owns all auth/MFA/
// biometric gating and redirects to (auth) screens as needed, so routing
// here just hands off to it rather than duplicating that logic.
export default function Index() {
  return <Redirect href="/(app)" />;
}
