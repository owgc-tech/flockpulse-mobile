DIP-FP-150.md
Story Summary
Brings Event Detail's RSVP wording in line with FP-149's My Events list — both surfaces currently show conversational phrasing ("Going"/"You might attend"/"Not going") while the list already says "Accepted"/"Tentative"/"Declined". This is wording-only; color-coding (FP-143) is already correct on both surfaces and untouched here.
Repo Target
Mobile (Expo/React Native) — owgc-tech/flockpulse-mobile.
Grounding Check
Confirmed live against dev:

RsvpControls.tsx's current-response text (line ~93-96): `Current response: ${currentStatus === "YES" ? "Going" : currentStatus === "TENTATIVE" ? "You might attend" : "Not going"}`.
[id].tsx's readOnlyRsvpLabel(): "You responded: Going" / "You responded: Not going" (with optional  — {reason} suffix) / "You responded: Might attend".
Decision on the flagged open question: the existing "Current response: " / "You responded: " sentence prefixes stay exactly as-is — Joseph's request was specifically about the status word itself, not the surrounding sentence structure, and "Current response: Accepted" / "You responded: Tentative" both read naturally with no further change needed.
Both are pure string literal changes — no logic, no color, no structural changes.
Domain rules: no conflict — display-only.

Implementation Plan

RsvpControls.tsx: change the ternary to currentStatus === "YES" ? "Accepted" : currentStatus === "TENTATIVE" ? "Tentative" : "Declined".
[id].tsx: update readOnlyRsvpLabel()'s three branches to "You responded: Accepted" / "You responded: Declined" (keeping the  — {reason} suffix logic unchanged) / "You responded: Tentative".

Files to Create/Modify

src/features/events/components/RsvpControls.tsx
app/(app)/events/[id].tsx

Migration Files
Not applicable.
Branch Name
feature/FP-150-event-detail-rsvp-wording
Commit Message
FP-150: Event Detail RSVP wording matches My Events list (Accepted/Tentative/Declined)
Pull Request Description
Maps to acceptance criteria:

RsvpControls.tsx's current-response text now says Accepted/Tentative/Declined, matching FP-149.
readOnlyRsvpLabel()'s three branches updated identically, reason suffix behavior unchanged.
No color or logic changes — confirmed both files' surrounding code untouched.

Jira Linkage

PDEEpicID: FP-15 (EPIC-4 — RSVP Management)
PDEStoryID: FP-150

Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-150.md, frozen after save. Open PR against dev, do not merge. No migration, no remote step.
Include full diffs for both files in the completion report.
