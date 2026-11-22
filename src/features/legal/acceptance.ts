/**
 * FP-254 (mobile): pure helpers for the one-time Terms / Privacy acceptance
 * screen. No React or Expo imports, so a plain tsx script can exercise them.
 */

export type LegalPage = "terms" | "privacy";

export const ACCEPTANCE_PATH = "/api/members/me/acceptance";

/**
 * Address of a public legal page on the web host the build talks to
 * (EXPO_PUBLIC_API_BASE_URL). Uses only the origin, so a trailing slash or a
 * path in the variable cannot break it. Null for missing or non-http(s) input.
 */
export function getLegalPageUrl(baseUrl: string | undefined | null, page: LegalPage): string | null {
  if (typeof baseUrl !== "string") return null;
  const trimmed = baseUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!parsed.host) return null;
    return `${parsed.origin}/${page}`;
  } catch {
    return null;
  }
}

/** Continue is allowed only when both boxes are ticked. */
export function canSubmitAcceptance(adult: boolean, terms: boolean): boolean {
  return adult === true && terms === true;
}

/**
 * Reads GET /api/members/me/acceptance's `{ data: { required } }` response.
 * Accepts either the full envelope or the already-unwrapped `{ required }`
 * that apiFetch returns. Anything unexpected counts as "not required", so a
 * surprise never blocks the app.
 */
export function parseAcceptanceStatus(response: unknown): { required: boolean } {
  if (typeof response !== "object" || response === null) return { required: false };
  const record = response as { required?: unknown; data?: unknown };
  const payload =
    typeof record.data === "object" && record.data !== null ? (record.data as { required?: unknown }) : record;
  return { required: payload.required === true };
}

// Same shape as apiFetch (which already unwraps the `{ data }` envelope).
export type AcceptanceFetcher = (path: string, init?: RequestInit) => Promise<unknown>;

/**
 * True only when the server says acceptance is required. An older server has
 * no such endpoint (HTTP 404, or a non-JSON not-found page), and a network
 * problem is transient: both return false and never throw, so the member is
 * not blocked from the app.
 */
export async function loadAcceptanceRequired(fetcher: AcceptanceFetcher): Promise<boolean> {
  try {
    const response = await fetcher(ACCEPTANCE_PATH);
    return parseAcceptanceStatus(response).required;
  } catch {
    return false;
  }
}

/** POSTs the confirmation. Resolves to a plain success flag, never throws. */
export async function saveAcceptance(fetcher: AcceptanceFetcher): Promise<boolean> {
  try {
    const response = await fetcher(ACCEPTANCE_PATH, {
      method: "POST",
      body: JSON.stringify({ confirmAdult: true, acceptTerms: true }),
    });
    return (
      typeof response === "object" &&
      response !== null &&
      (response as { accepted?: unknown }).accepted === true
    );
  } catch {
    return false;
  }
}
