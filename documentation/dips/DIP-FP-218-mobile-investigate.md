### DIP — FP-218 (Mobile) — Investigation Phase

### Story Summary
Investigates (does not yet fix) the "factor already exists" MFA enrollment error. The leading hypothesis — `mfa-enroll.tsx`'s screen mounting twice in quick succession right after a fresh login, causing two concurrent copies of its list-cleanup-enroll sequence to race each other — needs real confirmation before any fix is designed, since this is a genuine hypothesis developed from code trace, not something confirmed on a device.

### Repo Target
Mobile (Expo) — one file, temporary diagnostic instrumentation only.

### Grounding Check
Confirmed live against `owgc-tech/flockpulse-mobile` `dev`:
- `mfa-enroll.tsx`'s enrollment effect has an empty dependency array (`[]`) — confirmed it only runs once per mount, ruling out a re-render-triggers-it-again explanation. The remaining plausible cause is the *component itself* mounting more than once, not the effect re-firing within one mount.
- **Testing this requires a dev-client build, not TestFlight** — real testers hit this on production builds, where `console.log` output isn't visible anywhere. Confirming or ruling out the double-mount theory needs to happen on a dev-client build connected to Metro, where the logs are actually watchable in real time, reproducing a fresh login → MFA enrollment flow repeatedly.

### Implementation Plan
1. In `mfa-enroll.tsx`'s enrollment `useEffect`, add temporary, clearly-marked diagnostic logging (e.g. `console.log('[FP-218-investigate] mount start', mountId)` using a unique ID generated once per mount — timestamp + random suffix is sufficient) at: the very start of the effect, immediately before `listAllTotpFactors()`, immediately before `enrollTotpFactor()`, and on both success and failure of `enrollTotpFactor()`.
2. Mark every added line clearly (e.g. an `FP-218-investigate` prefix) so they're trivially greppable and impossible to confuse with permanent logging, since all of this needs to be removed before this ever ships to real users.
3. Do not touch the actual cleanup/enrollment logic itself in this DIP — this is instrumentation only, no behavior change.

### Files to Create/Modify
- `app/(auth)/mfa-enroll.tsx` (modify — temporary instrumentation, to be reverted after investigation)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-218-mobile-investigate-mfa-race

### Commit Message
FP-218-mobile: add diagnostic logging to investigate MFA enrollment race

### Pull Request Description
Investigation-only — no behavior change. Adds temporary, clearly-marked logging to `mfa-enroll.tsx` to confirm or rule out whether this screen mounts twice in quick succession after a fresh login, causing the enrollment sequence to race itself. **Do not merge this into `dev` at all, even temporarily** — this branch exists purely for Joseph to build a dev-client from and reproduce the issue while watching Metro's logs. Report back with what the logs actually show across several repeated attempts, not a single try.

### Jira Linkage
- PDEEpicID: FP-31
- PDEStoryID: FP-218

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-218-mobile-investigate.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop — but flag clearly in the PR that this is diagnostic-only and should not be merged under any circumstances, only used to build a test dev-client from. Report findings back rather than proceeding to implement a fix in this same DIP.
