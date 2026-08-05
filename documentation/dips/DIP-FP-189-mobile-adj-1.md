# DIP-FP-189-mobile-adj-1

## Story Summary

Written against DIP-FP-189-web-adj-1's contract. Removes the guest-count
prompt from Tentative entirely (Yes-only now, reverting the earlier
Yes/Tentative design), adds "(not including yourself)" to the guest-count
label, shows "+[N]" next to an invitee's name in the roster list when they
have guests, and adds a new "Response Count" summary table between the
RSVP buttons and the Invitees list.

## Repo Target

Mobile (Expo/React Native), owgc-tech/flockpulse-mobile. Fresh branch off
current dev.

## Grounding Check

- Written against DIP-FP-189-web-adj-1's documented contract — confirm the
  real merged guest_count field on the roster response before implementing,
  same discipline as every round.
- Confirmed live: RosterEntry has no guest_count field today — this is
  genuinely new, not previously exposed and merely unused.
- The "Response Count" table's four numbers are computed entirely
  client-side by reducing over the already-fetched roster entries (once
  guest_count is added) — no new endpoint needed, since the roster already
  contains every invitee's response and (after this DIP) guest count.
- Once Tentative can no longer be assigned a guest_count (per the web
  fix), the roster's "+[N]" display naturally never fires for a Tentative
  entry going forward — this DIP implements the display generically (any
  response with a positive guest_count gets a suffix) rather than
  special-casing which response types can show it, since the entry-side
  restriction alone makes that unnecessary.
- "+[N]" and the Response Count table's per-column guest suffix are both
  only shown when the guest total is greater than zero — a bare count with
  no "+0" clutter otherwise.

## Implementation Plan

1. RsvpControls.tsx: handlePressTentative reverts to immediate submission
   (no guest-count form) — only handlePressYes triggers showGuestForm now.
   The guest-count input's label gains "(not including yourself)".
2. types.ts: RosterEntry gains guest_count: number | null.
3. RosterList.tsx: each entry's name gets a trailing " +[N]" when
   entry.guest_count is a positive number, omitted otherwise.
4. app/(app)/events/[id].tsx: new "Response Count" section between the
   RSVP buttons and the Invitees list — a 2-row, 4-column table (Accepted /
   Tentative / Declined / Not Responded headers; second row: each status's
   count, with a "+[guest total]" suffix on Accepted and Tentative only
   when that column's summed guest_count is positive). All four numbers
   derived client-side from the same roster array already powering the
   Invitees list below it.

## Files to Create/Modify

- src/features/events/components/RsvpControls.tsx (modify — Tentative reverts, label text)
- src/features/events/types.ts (modify — RosterEntry.guest_count)
- src/features/events/components/RosterList.tsx (modify — "+N" per invitee)
- app/(app)/events/[id].tsx (modify — new Response Count table)

## Migration Files

None.

## Branch Name

feature/FP-189-mobile-adj-1-guest-display-and-tentative-reversal

## Commit Message

FP-189-mobile-adj-1: Yes-only guest count, roster "+N" display, Response Count summary table

## Pull Request Description

- Confirm every field checked against web's actual merged PR, not just
  this DIP.
- Confirm tapping Tentative now submits immediately again, no guest prompt.
- Screenshot the Response Count table and a roster entry showing "+N".

## Jira Linkage

- PDEEpicID: FP-15
- PDEStoryID: FP-189

## Stop Point

Save this DIP verbatim to documentation/dips/DIP-FP-189-mobile-adj-1.md.
Branch off current dev. Open a new PR against dev and stop. Do not merge.

Include full diffs for every file in the completion report, no elisions.
