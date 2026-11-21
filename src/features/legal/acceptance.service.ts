import { apiFetch } from "@/src/lib/api";
import { loadAcceptanceRequired, saveAcceptance } from "./acceptance";

// FP-254 (mobile): thin binding of the pure acceptance logic to apiFetch.
// The never-throws / 404-means-not-required behaviour lives in acceptance.ts
// so it can be tested without the Supabase client.

export function fetchAcceptanceRequired(): Promise<boolean> {
  return loadAcceptanceRequired(apiFetch);
}

export function submitAcceptance(): Promise<boolean> {
  return saveAcceptance(apiFetch);
}
