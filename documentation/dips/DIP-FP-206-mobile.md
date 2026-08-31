### Story Summary
Adds a request timeout to `apiFetch()` — the single shared function every network call in this app goes through — so a hung request fails gracefully with a clear, actionable error instead of leaving the user staring at an infinite loading state with no recourse. Prompted by a tester report on Check-in/Confirm specifically, but this is a systemic fix affecting every screen, not scoped to those two.

### Repo Target
Mobile (Expo) — single shared file.

### Grounding Check
Confirmed live against `owgc-mobile` `dev`:
- `apiFetch()` (`src/lib/api.ts`) is confirmed to be the single, shared function every API call in the app routes through — no per-screen fetch logic exists outside it.
- No `AbortController`, no timeout logic, anywhere in this file — confirmed via direct search, not assumed.
- `confirmations/index.tsx`'s `load()` function has structurally correct `try/catch/finally` — `isLoading` is guaranteed to resolve either way. This rules out a JS logic bug on the screen side; the gap is specifically the absent network-layer timeout underneath it.
- `ApiError`'s existing shape (`code`, `message`) is already displayed as-is by every screen's existing error UI — a new `TIMEOUT` error code fits this without requiring any new UI.

### Implementation Plan
1. **`src/lib/api.ts`**: wrap the `fetch()` call with an `AbortController`, `setTimeout(() => controller.abort(), <timeout_ms>)` clearing the timer on completion either way. Pass `signal: controller.signal` into the fetch call's options.
2. Catch the resulting abort (`err.name === 'AbortError'`) specifically, and throw `new ApiError("TIMEOUT", "This is taking longer than expected. Check your connection and try again.", 0)` (or similarly clear wording) instead of letting the raw abort exception propagate.
3. Confirm at implementation time whether `supabase.auth.getSession()` (awaited before the fetch itself begins) also needs its own timeout protection, or whether the Supabase SDK already bounds it reliably — don't assume either way without checking.

### Files to Create/Modify
- `src/lib/api.ts` (modify)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-206-mobile-api-fetch-timeout

### Commit Message
FP-206-mobile: add request timeout to apiFetch, prevent indefinite hangs

### Pull Request Description
Maps to FP-206's acceptance criteria: `apiFetch()` now times out a hung request and throws a clear `TIMEOUT` error, shown by each screen's already-existing error UI — no new UI needed. Report the chosen timeout value and whether `getSession()` needed the same protection. Confirm in the PR: this can't be fully verified without simulating a hung/dead connection on a real device (e.g., toggling airplane mode mid-request) — flag if that wasn't tested and note it as a real gap in verification, not just typechecked.

### Jira Linkage
- PDEEpicID: FP-31
- PDEStoryID: FP-206

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-206-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it on a real native build, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
