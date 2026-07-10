import type { MyEvent } from "@/src/features/events/types";

// ASSUMPTION (not specified in any story): when an event has no
// location_url, fall back to a Google Maps universal-link search query
// built from location_address. This hands off to whichever maps app is
// installed (or a browser otherwise) on both iOS and Android — a
// reasonable cross-platform default, not something the ACs call for.
export function getMapUrl(event: MyEvent): string {
  if (event.location_url) {
    return event.location_url;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location_address)}`;
}
