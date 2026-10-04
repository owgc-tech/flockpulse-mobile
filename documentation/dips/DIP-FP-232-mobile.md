### Not covered — deliberately excluded
- The wording of raw network errors such as "The internet connection appears to be offline": that is FP-226, to be done after this re-land.
- Any new behavior. This restores already-approved changes and nothing else.
- The web repo: scanned, nothing stranded.

### Story Summary
Three reviewed and approved mobile changes never reached dev because their PRs were merged into stacked parent branches: FP-206-mobile-adj-1 (eb6c788), FP-206-mobile-adj-2 (04eb0b3) and FP-217-mobile (8a60df2). Re-land them onto current dev, keeping their behavior, and keep FP-230's session recovery working.

### Repo Target
Mobile (Expo).

### Grounding Check
Verified with git this session, not assumed:
- dev's merge history has PRs 118, 119, 123, 124, 125 and 129 to 135, and none for 120, 121 or 126.
- git cherry -v dev shows eb6c788 (FP-206-mobile-adj-1: fix timeout message not showing, add retry to error states), 04eb0b3 (FP-206-mobile-adj-2: add Retry button to Board and Tasks tabs) and 8a60df2 (FP-217-mobile: defer notification-tap navigation until app gate is ready) as NOT applied. The first two are on origin/feature/FP-206-mobile-adj-1-timeout-message-and-retry; the third is on origin/feature/FP-217-mobile-defer-notification-nav-until-gate-ready.
- On dev now: src/lib/api.ts still checks err.name === "AbortError" (Expo's FetchError never sets .name, so the friendly timeout message cannot appear); the Events tab renders only the error text, with no Try Again; src/features/notifications/pendingNotificationSignal.ts does not exist.
- Since those branches were cut, dev changed in the same files: api.ts was restructured by FP-230 (apiFetch now delegates to request(), with single-flight 401 recovery), and the tabs were touched by FP-223 and FP-225. Expect conflicts.
- Re-verify the above yourself first, including that no other branch has unapplied commits (git cherry -v dev against every origin/feature, chore and fix branch). Known and intentional: origin/feature/FP-218-mobile-investigate-mfa-race is diagnostic-only and must NOT be merged.

### Implementation Plan
1. Create a new branch off the CURRENT dev.
2. git cherry-pick -x the three commits in this order: eb6c788, 04eb0b3, 8a60df2. Resolve conflicts so that BOTH sides' behavior survives: the approved commits' behavior and FP-230's (single-flight recovery, one retry, expiring state, forceLocalSignOut, login notice). Do not redesign or improve anything. Where a hunk cannot apply because the code moved, port it by hand to the equivalent place and say so in the PR.
3. api.ts: timeout detection must use controller.signal.aborted, inside the per-attempt fetch catch in the current request(), so retried attempts are covered too. The "unknown" refresh outcome from FP-230 must still raise the friendly timeout error.
4. Try Again on Events, Check-in and Confirm (adj-1), and Retry on Board and Tasks (adj-2), as in the approved commits, including Board's handleRetry dispatch across its three error paths.
5. FP-217: pendingNotificationSignal.ts; the root layout only parks the notification response; the (app) layout drains it only when gate.phase is "ready" (an immediate drain plus a subscriber for live taps).
6. Run tsc. Re-run your FP-230 script (all 40 checks) against the resulting code and report the result. Show git cherry -v output that proves the three commits are now applied.
7. Open the PR with gh pr create --base dev, and quote the base branch in your report. Do NOT stack this PR on any other branch.

### Files to Create/Modify
Exactly the files touched by the three source commits, adjusted for conflicts. Expected: src/lib/api.ts; the Events, Check-in, Confirm, Board and Tasks tab files; app/_layout.tsx; app/(app)/_layout.tsx; and the new pendingNotificationSignal.ts. List the final set in your report.

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-232-mobile-reland-206-217

### Commit Message
FP-232-mobile: re-land FP-206-adj-1/2 and FP-217 onto dev

### Pull Request Description
Maps to FP-232. Per source commit: its SHA, what it restores, and which files needed manual conflict resolution and how. Include the FP-230 script results, the tsc result, the git cherry proof, and what you could not test (anything needing a native build).

### Jira Linkage
- PDEEpicID: FP-31
- PDEStoryID: FP-232 (re-lands FP-206 adj-1 and adj-2, and FP-217)

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-232-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge. Joseph tests on a real native build (airplane mode on each tab shows Try Again and it works when back online; the FP-217 cold-launch notification-tap cycles), confirms the PR says "into dev", and merges manually.

Include full diffs for every file in your completion report per Section 5, rule 12, not a summary.
