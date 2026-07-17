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

// DIP-FP-132-FP-133-FP-134: single source of truth for "is RSVP still
// open," shared by RsvpControls' prompt (via EventListItem/Event Detail)
// and the Event Detail screen's editable gate — replaces the old
// effective_status === "SCHEDULED"-only check with closure-cutoff
// awareness now that rsvp_closure_at is server-computed (PR #77).
export function isRsvpWindowOpen(event: Pick<MyEvent, "effective_status" | "rsvp_closure_at">): boolean {
  return event.effective_status === "SCHEDULED" && Date.now() < new Date(event.rsvp_closure_at).getTime();
}
