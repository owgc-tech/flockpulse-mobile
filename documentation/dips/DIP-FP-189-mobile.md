# DIP-FP-189-mobile

## Story Summary

Adds a guest-count prompt to the RSVP flow, following the exact same two-step confirmation pattern already used for declining with a reason: tapping Yes or Tentative on a guests-allowed event reveals a small numeric input with Cancel/Submit, instead of submitting immediately. Events with guests not allowed (the default, every existing event) see zero change in behavior.

## Repo Target

Mobile (Expo/React Native), owgc-tech/flockpulse-mobile.

## Grounding Check

- Written against DIP-FP-189-web's documented contract — same field names, cross-checked. Confirm against web's actual merged PR before considering this done, same discipline as every round today.
- RsvpControls.tsx confirmed via direct read: handlePressYes/handlePressTentative currently call onSubmit immediately with no intermediate confirmation step — only handleSubmitNo has the existing two-step shape (showReasonForm state, a revealed form with Cancel/Submit, submit only on confirmation). The guest-count prompt mirrors this exact existing pattern rather than introducing a new one — when guests_allowed is false, Yes/Tentative continue to submit immediately, unchanged.
- submitRsvp's current signature confirmed via direct read (eventId, rsvpStatus, rsvpReason?) — extended with an optional guestCount parameter, matching the DIP-FP-189-web's guest_count field name exactly.

## Implementation Plan

1. types.ts: RsvpStatus-adjacent types gain guest_count?: number on the request side; MyEvent/EventDetail gain guests_allowed: boolean.
2. submitRsvp: new optional guestCount parameter, included in the request body only when provided (mirrors the existing rsvpReason's conditional-inclusion pattern for No).
3. RsvpControls.tsx: new prop guestsAllowed: boolean. When true, handlePressYes/handlePressTentative no longer call onSubmit immediately — instead set a new showGuestForm state (storing which status triggered it), revealing a numeric TextInput (keyboardType="number-pad") with Cancel/Submit, mirroring showReasonForm's exact structure. Submit calls onSubmit(status, undefined, guestCount). When guestsAllowed is false, behavior is completely unchanged from today.
4. Whatever screen renders RsvpControls passes event.guests_allowed as the new prop.

## Files to Create/Modify

- src/features/events/types.ts (modify — guest_count, guests_allowed)
- src/features/events/services/*.ts (modify — submitRsvp's new parameter)
- src/features/events/components/RsvpControls.tsx (modify — guest-count two-step flow)
- app/(app)/events/[id].tsx (modify — pass guests_allowed prop through)

## Migration Files

None.

## Branch Name

feature/FP-189-mobile-rsvp-guest-count

## Commit Message

FP-189-mobile: add guest-count prompt to RSVP, mirroring the existing decline-reason two-step pattern

## Pull Request Description

- Confirm every field/endpoint checked against web's actual merged PR, not just this DIP.
- Confirm an event with guests_allowed: false shows zero behavior change — no new prompt, no new field sent.
- Screenshot the guest-count form for both Yes and Tentative, and confirm Cancel correctly discards without submitting.

## Jira Linkage

- PDEEpicID: FP-15
- PDEStoryID: FP-189

## Stop Point

Save this DIP verbatim to documentation/dips/DIP-FP-189-mobile.md. Branch off current dev. Open a PR against dev and stop. Do not merge.

Include full diffs for every changed file, no elisions.
