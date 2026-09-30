import { Linking, Platform } from "react-native";
import type { MyEvent, RsvpStatus } from "@/src/features/events/types";
import type { ThemeColors } from "@/src/theme/colors";

// DIP-FP-147: prefer whatever's actually installed/preferred on-device
// instead of always handing off to a Google Maps web URL, which on iOS
// triggers an App Store redirect if Google Maps isn't installed. iOS has no
// true default-app setting exposed to apps, so "prefer Google Maps if
// installed, else Apple Maps" is the closest approximation of user intent;
// Android's geo: scheme genuinely does resolve to the OS-level default.
// Async because the iOS installed-check (Linking.canOpenURL) is inherently
// async — requires "comgooglemaps" under ios.infoPlist.LSApplicationQueriesSchemes
// in app.json (iOS 9+ privacy restriction) or canOpenURL always returns
// false regardless of what's actually installed. That's a native config
// change, not shippable via eas update — needs an actual EAS Build.
export async function getMapUrl(event: MyEvent): Promise<string> {
  const query = encodeURIComponent(event.location_address);

  try {
    if (Platform.OS === "ios") {
      const canOpenGoogleMaps = await Linking.canOpenURL(`comgooglemaps://?q=${query}`);
      if (canOpenGoogleMaps) {
        return `comgooglemaps://?q=${query}`;
      }
      return `http://maps.apple.com/?q=${query}`;
    }

    if (Platform.OS === "android") {
      return `geo:0,0?q=${query}`;
    }
  } catch (err) {
    console.warn("Failed to resolve native maps URL:", err);
  }

  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

// DIP-FP-132-FP-133-FP-134: single source of truth for "is RSVP still
// open," shared by RsvpControls' prompt (via EventListItem/Event Detail)
// and the Event Detail screen's editable gate — replaces the old
// effective_status === "SCHEDULED"-only check with closure-cutoff
// awareness now that rsvp_closure_at is server-computed (PR #77).
export function isRsvpWindowOpen(event: Pick<MyEvent, "effective_status" | "rsvp_closure_at">): boolean {
  return event.effective_status === "SCHEDULED" && Date.now() < new Date(event.rsvp_closure_at).getTime();
}

// DIP-FP-143: shared Accept=green/Decline=red/Tentative=amber/No
// response=grey mapping for every mobile surface keyed off RsvpStatus
// (EventListItem, RsvpControls, self-report) — RosterList uses its own
// RosterResponseValue type and getResponseColors(), left as-is.
export function getRsvpStatusColor(colors: ThemeColors, status: RsvpStatus | null): string {
  switch (status) {
    case "YES":
      return colors.success;
    case "NO":
      return colors.danger;
    case "TENTATIVE":
      return colors.warning;
    default:
      return colors.textMuted;
  }
}

// FP-219-mobile: mirrors web's validateLocationAddress (event.types.ts) so the
// two clients reject the same input — a length cap plus a rejection of
// obviously-junk input (blank, or one character repeated throughout, e.g.
// "aaaaaaaa"). Shared by create.tsx and edit.tsx so the two screens can't
// drift. Not real address verification; server-side enforcement already
// covers both apps since they call the same routes.
export const LOCATION_ADDRESS_MAX_LENGTH = 200;

export function validateLocationAddress(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Location address is required";
  if (value.length > LOCATION_ADDRESS_MAX_LENGTH) {
    return `Location address must be ${LOCATION_ADDRESS_MAX_LENGTH} characters or fewer`;
  }
  if (/^([\s\S])\1*$/u.test(trimmed)) return "Enter a valid location address";
  return null;
}
