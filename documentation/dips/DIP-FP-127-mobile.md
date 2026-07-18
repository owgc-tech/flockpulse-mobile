DIP-FP-127-mobile.md
Story Summary
Mobile half of FP-127: every RSVP surface in the Expo app needs to recognize and render the new TENTATIVE value once it exists in the API (companion web DIP, DIP-FP-127-FP-128-web.md, merged to dev — PR #82). This covers the RSVP submission control, the event list/detail read-only labels, the self-report screen's RSVP display, and the roster list's response label/color. RSVP remains pre-event intent only — nothing here touches self-report submission or attendance.
Repo Target
Mobile (Expo/React Native) — owgc-tech/flockpulse-mobile.
Grounding Check
Confirmed live against dev branch:

RsvpStatus (src/features/events/types.ts): currently "YES" | "NO". Needs "TENTATIVE" added — this type backs MyEvent.rsvp_status, RsvpResponse.rsvp_status, and RsvpControlsProps.currentStatus.
RsvpControls.tsx: two-button layout (Yes / Can't make it → reason form). No third button exists. Needs a Tentative button that submits directly (no reason form), matching Yes's handlePressYes shape, not No's reason-collecting shape.
RosterResponseValue (types.ts): currently "ACCEPTED" | "DECLINED" | "NOT_RESPONDED" — matches web's RosterEntry.response exactly, per the type's own comment. The web DIP widened RosterEntry.response to include 'TENTATIVE' (confirmed merged in PR #82), so this type must widen identically or the mobile roster will fail to type-check against the real API response.
RosterList.tsx: RESPONSE_LABELS and getResponseColors() are both Record<RosterResponseValue, ...> — exhaustive records, so TypeScript itself forces both to be extended once the type widens. Per the story's suggestion and the component's own comment about deriving from theme tokens rather than hardcoding a second hex pair: use colors.accent for Tentative, consistent with success/danger already being used for Accepted/Declined.
EventListItem.tsx: RSVP_LABELS: Record<RsvpStatus, string> — same exhaustive-record pattern, needs a TENTATIVE entry.
app/(app)/events/[id].tsx readOnlyRsvpLabel(): currently if/if/fallback (not an exhaustive record — a plain function), needs an explicit TENTATIVE branch or it silently falls through to the generic "RSVP closed"/"Not yet responded" fallback, losing the member's actual response.
app/(app)/events/[id]/self-report.tsx rsvpLabel(): same shape, same fix needed.
Reason form: not applicable to Tentative — confirmed in the web DIP's grounding that only NO requires a reason server-side; mobile's Tentative button follows Yes's direct-submit path, not No's reason-form path.

Implementation Plan

Types (src/features/events/types.ts): widen RsvpStatus to "YES" | "NO" | "TENTATIVE"; widen RosterResponseValue to "ACCEPTED" | "DECLINED" | "NOT_RESPONDED" | "TENTATIVE".
RsvpControls.tsx: add a third button ("Maybe" — flag for Joseph to confirm/rename at review), calling onSubmit("TENTATIVE") directly, no reason form. Add a "TENTATIVE" case to the currentStatus label text ("You might attend"). Add a themed button color — reuse colors.accent (not a new hardcoded color), consistent with the RosterList pattern.
RosterList.tsx: add TENTATIVE: "Tentative" to RESPONSE_LABELS; add TENTATIVE: { color: colors.accent } to getResponseColors().
EventListItem.tsx: add TENTATIVE: "You might attend" to RSVP_LABELS.
app/(app)/events/[id].tsx: add explicit if (event.rsvp_status === "TENTATIVE") return "You responded: Might attend"; branch in readOnlyRsvpLabel().
app/(app)/events/[id]/self-report.tsx: add explicit if (event.rsvp_status === "TENTATIVE") return "Your RSVP: Might attend"; branch in rsvpLabel().
No changes to reminders.service.ts or rsvpNudgeReminders.service.ts — confirmed correct as-is in the web DIP's grounding check (Tentative falls through identically to Yes for both reminder and nudge logic).

Files to Create/Modify

src/features/events/types.ts
src/features/events/components/RsvpControls.tsx
src/features/events/components/RosterList.tsx
src/features/events/components/EventListItem.tsx
app/(app)/events/[id].tsx
app/(app)/events/[id]/self-report.tsx

Migration Files
Not applicable — mobile repo has no backend/migrations.
Branch Name
feature/FP-127-mobile-rsvp-tentative
Commit Message
FP-127: add Tentative RSVP option across mobile UI
Pull Request Description
Maps to FP-127 acceptance criteria (mobile-facing subset):

"Member can select Tentative when RSVPing, no reason required" → new third button in RsvpControls, direct-submit path.
"Round-trips correctly, editable while open, read-only after" → currentStatus label + read-only label branches in [id].tsx and self-report.tsx.
"Leaders/Admins see Tentative in roster with distinct, legible color in both themes" → RosterList label + colors.accent-derived color (theme-reactive, not hardcoded).
"Existing Yes/No behavior unchanged" → no existing branches modified, only extended; No's reason-form path untouched.

Jira Linkage

PDEEpicID: FP-15 (EPIC-4 — RSVP Management)
PDEStoryID: FP-127

Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-127-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — Joseph will check out the branch, test via npx expo start + Expo Go against the merged-and-remotely-applied web backend, and merge manually.
Include full diffs for every file in the completion report — not a summary.
