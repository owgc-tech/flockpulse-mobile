### DIP 2 of 2 — Mobile

### Story Summary
Removes the `location_url` override field entirely from mobile's own, fully separate implementation — its own input field and state in both event create and edit screens, its own maps-URL resolution logic, and its own type definitions. `getMapUrl()` loses its `location_url` branch entirely and always falls through to the existing platform-aware address-based resolution (Google Maps app-installed check on iOS, `geo:` scheme on Android, web fallback) that FP-147 already built. **Depends on FP-184-web being merged first** — do not start until confirmed, since mobile reads `location_url` from the same API responses FP-184-web's RPC changes affect.

### Repo Target
Mobile (Expo) — UI, type, and maps-resolution logic only; no backend/API involvement (mobile consumes the same web API, already updated by FP-184-web).

### Grounding Check
Confirmed live against `owgc-tech/flockpulse-mobile` `dev`:
- **A real, previously-unflagged finding**: `getMapUrl()` (`src/features/events/utils.ts:16-18`) returns `event.location_url` completely unvalidated — no protocol check at all, unlike web's `getMapsUrl()` which already had FP-183's interim `http(s)://` validation. Mobile has been carrying the same CodeQL-class exposure this whole time, just never separately flagged. This DIP closes it structurally (the branch is deleted, not patched), same outcome as web, no separate interim fix needed given FP-184's removal happens regardless.
- Confirmed exactly the 5 files the ticket listed: `app/(app)/events/create.tsx` (state at line 352, submission payload at 510, input at 786), `app/(app)/events/[id]/edit.tsx` (state at 378, payload at 580, input at 817), `src/features/events/utils.ts` (`getMapUrl()`), `src/features/events/types.ts` (5 separate type references — `MyEvent`, `CreateEventInput`, `EventDetail`, `UpdateEventInput`, and one more — confirm each at implementation time rather than assume identical shape), `src/features/notifications/types.ts` (1 reference).
- `getMapUrl()`'s own extensive existing comment (referencing FP-147's platform-aware maps resolution) explains exactly what the fallback chain does once the `location_url` branch is removed — nothing about that chain needs to change, only the branch ahead of it.
- No RSVP/attendance/tenant-isolation invariant touched — this is a UI/type/resolution-logic removal only.

### Implementation Plan
1. **`src/features/events/utils.ts`**: remove the `if (event.location_url) { return event.location_url; }` branch from `getMapUrl()` entirely — the function starts directly with the platform-aware fallback chain (iOS Google-Maps-installed check → Apple Maps → Android `geo:` → web fallback), unchanged otherwise.
2. **`src/features/events/types.ts`**: remove `location_url`/`locationUrl` from every type currently carrying it — confirm each of the 5 occurrences individually (some may be request types, some response types; don't assume they're interchangeable).
3. **`src/features/notifications/types.ts`**: remove the single `location_url` field.
4. **`app/(app)/events/create.tsx`**: remove the `locationUrl` state, its conditional inclusion in the submission payload, and the input field.
5. **`app/(app)/events/[id]/edit.tsx`**: remove the `locationUrl` state (including its `initialEvent.location_url` prefill), its submission-payload reference, and the input field.

### Files to Create/Modify
- `src/features/events/utils.ts` (modify)
- `src/features/events/types.ts` (modify)
- `src/features/notifications/types.ts` (modify)
- `app/(app)/events/create.tsx` (modify)
- `app/(app)/events/[id]/edit.tsx` (modify)

### Migration Files (if applicable)
None — no schema access from mobile.

### Branch Name
feature/FP-184-mobile-remove-location-url

### Commit Message
FP-184-mobile: remove location_url override field entirely

### Pull Request Description
Maps to FP-184's mobile acceptance criteria: `locationUrl` input/state removed from both create and edit screens, `getMapUrl()`'s unvalidated `location_url` branch removed entirely (closing an exposure that mirrors FP-183's web-side CodeQL finding but was never separately flagged or patched — noted in the Grounding Check above), all 6 type references removed. Confirm in the PR that FP-184-web was actually merged and live before this was tested, per the dependency noted above.

### Jira Linkage
- PDEEpicID: FP-11
- PDEStoryID: FP-184

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-184-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it on a real native build, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
