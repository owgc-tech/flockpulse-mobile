# DIP-FP-120-mobile (rewritten, shapes confirmed)

## Story Summary
Mobile side of FP-120: event create/edit gets an optional "Online Meeting" section (Zoom account dropdown or freeform other-platform link), and Event Detail shows the resolved join link as a one-tap link — same pattern already used for physical location. Conflict errors surface the conflicting event's name, date/time, and booker, worded consistently with web's own reworded message. Depends on `DIP-FP-120-web` (merged) and its follow-up wording adjustment (also merged).

## Repo Target
Mobile (Expo) — `owgc-tech/flockpulse-mobile`.

## Grounding Check

* Confirmed live (recent sessions): `create.tsx` and `edit.tsx` already have an established modal-list-picker pattern (`FormationTalkPicker`) — a Zoom-account picker should follow this same visual/interaction convention, not invent a new one.
* Confirmed the existing tappable-location-link pattern in `events/[id].tsx` (`Linking.openURL` via a `Pressable`) — reuse this exact mechanism for the online-meeting link.
* Confirmed live response shape of `GET /api/meeting-resources` (pulled directly from `listMeetingResources()` in web's merged `events/service.ts`): an array of `{ id: string; name: string; join_url: string }`. `apiFetch()` already unwraps the `{ data: ... }` envelope, so the mobile type is just that array shape directly.
* Confirmed live shape of the `MEETING_RESOURCE_CONFLICT` error (pulled directly from web's merged API routes, both `POST /api/events` and `PATCH /api/events/[id]`):

```
  {
    error: {
      code: "MEETING_RESOURCE_CONFLICT",
      message: string,              // raw server message — DO NOT display this directly, see below
      conflict: {
        eventId: string;
        eventName: string;
        startDatetime: string;
        endDatetime: string;
        bookedByName: string;
      } | null                      // null only for the rare race-condition fallback path
    }
  }
```

Important — confirmed by checking the actual merged server code: the server's own `message` field still contains the old wording ("This account is already booked for...") — only web's frontend rebuilds its own display string from the structured `conflict` fields. Mobile must do the same: when `conflict` is non-null, build the message client-side from those fields using the exact wording below, don't display `message` directly. When `conflict` is `null` (the rare fallback), display `message` as-is — in that case it correctly reads "This account was just booked by someone else — please try again."

* Self-report and confirmation are explicitly untouched by this story — no changes to `self-report.tsx`, `confirmations/index.tsx`, `self-report/index.tsx`, or the attendance/confirmation flow at all.

## Implementation Plan

1. New service call — `listMeetingResources()` wrapping `GET /api/meeting-resources`, typed per the confirmed shape above.
2. `create.tsx` and `edit.tsx` — add an "Online Meeting" section below the existing location fields (unchanged, still required): a picker mirroring `FormationTalkPicker`'s modal-list pattern, listing tracked Zoom accounts, plus a toggle/fields for freeform "Other platform" name + link. Wire the three new fields (`onlineMeetingResourceId`, `onlineMeetingUrl`, `onlineMeetingPlatformLabel`) into the existing `createEvent`/`updateEvent` service calls.
3. Handle the `MEETING_RESOURCE_CONFLICT` error response as follows, in both screens' submit-error handling:

```ts
   if (err instanceof ApiError && err.code === "MEETING_RESOURCE_CONFLICT" && err.conflict) {
     const c = err.conflict;
     setError(
       `Zoom account selected is already booked for "${c.eventName}" on ` +
       `${new Date(c.startDatetime).toLocaleString()} by ${c.bookedByName}.`
     );
   } else {
     setError(err instanceof Error ? err.message : "Failed to save event.");
   }
```

(Confirm `ApiError`'s shape actually carries the `conflict` field through from the response body — check `src/lib/api.ts`'s `ApiError` class live; extend it if it currently only carries `code`/`message`.)

4. `events/[id].tsx` — display the resolved online-meeting link (if set) as a tappable link near the existing location section, labeled with the resource name or freeform platform label, using the existing `Linking.openURL` pattern.
5. `events/types.ts` — extend the relevant event types with the three new optional fields (`online_meeting_resource_id`, `online_meeting_url`, `online_meeting_platform_label`).

## Files to Create/Modify

```
src/features/events/services/events.service.ts   (modified, or new meeting-resources service file)
src/features/events/types.ts                      (modified)
src/lib/api.ts                                     (modified, only if ApiError needs the conflict field added)
app/(app)/events/create.tsx                        (modified)
app/(app)/events/[id]/edit.tsx                     (modified)
app/(app)/events/[id].tsx                          (modified)
```

## Migration Files
None (web-side only).

## Branch Name
`feature/FP-120-mobile-online-meeting-support`

## Commit Message
`FP-120-mobile: add online meeting fields to event create/edit and detail screens, with matching conflict error wording`

## Pull Request Description
Maps to FP-120's mobile-side ACs: Online Meeting section on create/edit (Zoom dropdown or freeform other-platform link, additive to required physical location); Event Detail shows the resolved join link as a one-tap link; a Zoom account conflict shows the conflicting event's name, time, and booker inline, worded consistently with web's reworded message. No changes to self-report or confirmation.

## Jira Linkage

* PDEEpicID: FP-11
* PDEStoryID: FP-120

## Stop Point
Save this DIP verbatim to `documentation/dips/DIP-FP-120-mobile.md`. Open the PR against `dev` and stop — do not merge.
