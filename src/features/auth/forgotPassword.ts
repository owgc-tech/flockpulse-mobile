/**
 * FP-265 (mobile): pure helpers for the login screen's "Forgot password?" link.
 * No React or Expo imports, so it can be exercised by a plain tsx script.
 */

export const FORGOT_PASSWORD_FALLBACK_MESSAGE =
  "We couldn't open the reset page. Please try again, or contact your community administrator.";

/**
 * Builds the web reset-page address (with ?from=app, so the page can offer a way
 * back to the app) from the web host the build talks to
 * (EXPO_PUBLIC_API_BASE_URL). Uses only the origin, so a trailing slash or a
 * path in the variable cannot break the result. Returns null when the value is
 * missing or is not an http(s) address with a host.
 */
export function getResetPasswordUrl(baseUrl: string | undefined | null): string | null {
  if (typeof baseUrl !== "string") return null;
  const trimmed = baseUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!parsed.host) return null;
    return `${parsed.origin}/reset-password?from=app`;
  } catch {
    return null;
  }
}
