### DIP — FP-219-mobile-adj-1

### Story Summary
Follow-up to the just-merged basic address validation (PR #130). Confirms — and fixes if needed — that both event screens correctly display whatever error message the server actually returns on save failure, not just their own client-side validation messages. This matters specifically because FP-219-web-adj-1 adds real server-side address verification (Geocodio) that PR #130's screens need to surface correctly when it rejects an address.

### Repo Target
Mobile (Expo) — two screens.

### Grounding Check
Confirm at implementation time: on both `create.tsx` and `[id]/edit.tsx`, does the existing save-failure error handling already display the server's actual response message (e.g. via a shared `apiFetch`/`ApiError` pattern), or does it only ever show its own hardcoded client-side messages? Don't assume either way — check the real current code.

### Implementation Plan
1. If server error messages are already correctly surfaced: confirm this explicitly in the PR, with no code change needed.
2. If not: wire the existing error-display UI on both screens to show the actual message from a failed save response, same as any other server-side validation error already handled elsewhere in this app.

### Files to Create/Modify
- `app/(app)/events/create.tsx` (modify, if needed)
- `app/(app)/events/[id]/edit.tsx` (modify, if needed)

### Branch Name
feature/FP-219-mobile-adj-1-surface-server-errors

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-219-mobile-adj-1.md. Open the PR against dev and stop. Do not merge.
