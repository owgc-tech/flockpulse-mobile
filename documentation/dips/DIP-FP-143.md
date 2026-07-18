DIP-FP-143.md
Story Summary
RSVP color-coding is inconsistent both across (web vs. mobile — already fine on web) and within the mobile app itself. Grounding found four mobile surfaces displaying RSVP status, not the two the ticket named: RosterList.tsx (the admin/leader roster — Joseph's "Event Detail screen"), EventListItem.tsx (My Events list — Joseph's second example), plus two more found during grounding that show the same inconsistency: RsvpControls.tsx's "Current response" control (shown on the member's own Event Detail screen) and self-report.tsx's "Your RSVP: ..." label. All four get the same fix — a shared color mapping (Accept=green, Decline=red, Tentative=amber, No response=grey), with "Please RSVP now" specifically bold and using the theme's normal text color, not grey, per Joseph's explicit instruction.
Repo Target
Mobile (Expo/React Native) — owgc-tech/flockpulse-mobile.
Grounding Check
Confirmed live against dev:

src/theme/colors.ts has success (green), danger (red), and accent (blue) tokens, following a consistent light/dark shade-pairing convention (light uses the Tailwind "-600" shade, dark uses "-500", e.g. success: '#16a34a'/'#22c55e') — but no amber/warning token exists at all. This DIP adds one (warning: '#d97706' light / '#f59e0b' dark — Tailwind amber-600/amber-500, matching the exact shade-pairing convention already established by success/danger).
RosterList.tsx's getResponseColors() is already correctly wired for three of the four states (ACCEPTED: colors.success, DECLINED: colors.danger, NOT_RESPONDED: colors.textMuted) — but TENTATIVE currently uses colors.accent (blue), a leftover from FP-127 before amber existed as an option. This is the one line that needs to change here.
EventListItem.tsx (My Events list): RSVP_LABELS' three strings ("You're going"/"You declined"/"You might attend") all currently render through the same flat themed.rsvpText style — no color differentiation between them at all. Separately, "Please RSVP now." currently uses themed.rsvpPromptText → colors.accent (blue), not bold black.
RsvpControls.tsx: the "Current response: ..." label (editable state) and the read-only label (RSVP window closed) both render through a single flat themed.currentLabel/themed.readOnlyText style regardless of the actual status — same inconsistency. currentStatus (the real RsvpStatus | null) is already passed into this component unconditionally by its caller ([id].tsx: currentStatus={event.rsvp_status}, not conditioned on editable), so both the editable and read-only branches can compute the correct color directly from currentStatus without needing new props or fragile string-matching against label text.
self-report.tsx: "Your RSVP: ..." (rsvpLabel()) has the identical flat-color issue — a fourth surface, not named in the original ticket, found during grounding.
"Bold Black" interpretation: the theme has no literal always-black token (dark mode's primary text color is near-white, by design — a hardcoded #000 would be invisible on a dark background). This DIP interprets "bold Black" as the theme's own primary text color (colors.text), bolded — black in light mode, matching Joseph's description exactly; in dark mode it becomes the theme's equivalent high-contrast foreground (near-white), which is the only sensible cross-theme reading of "the normal, most prominent text color, just bold." Flagging this interpretation explicitly in case Joseph meant something more literal.
Shared implementation: EventListItem.tsx, RsvpControls.tsx, and self-report.tsx all key off the same RsvpStatus type ('YES' | 'NO' | 'TENTATIVE', absence meaning no response) — one new shared helper, getRsvpStatusColor(colors, status), added to src/features/events/utils.ts (already the home of getMapUrl/isRsvpWindowOpen), covers all three. RosterList.tsx uses a separate, pre-existing type (RosterResponseValue) with its own already-mostly-correct getResponseColors() — not unified into the new shared helper, just has its one wrong line fixed in place, consistent with this codebase's existing tolerance for this kind of minor type duplication (e.g. Role/MemberRole on the web side).

Implementation Plan

src/theme/colors.ts: add warning: '#d97706' (light) / '#f59e0b' (dark).
src/features/events/utils.ts: add getRsvpStatusColor(colors: ThemeColors, status: RsvpStatus | null): string — YES → colors.success, NO → colors.danger, TENTATIVE → colors.warning, null → colors.textMuted.
RosterList.tsx: change TENTATIVE: { color: colors.accent } to TENTATIVE: { color: colors.warning } in getResponseColors(). No other changes to this file.
EventListItem.tsx: use getRsvpStatusColor(colors, event.rsvp_status) for the RSVP_LABELS text color instead of the flat themed.rsvpText. Change the "Please RSVP now." prompt to use colors.text (bolded) instead of colors.accent — add a fontWeight: '700' to its style.
RsvpControls.tsx: apply getRsvpStatusColor(colors, currentStatus) to both the editable "Current response: ..." text and the read-only label text, replacing their flat themed.currentLabel/themed.readOnlyText colors. "You have not RSVPed" (no status yet, editable state) is a distinct pre-response message, not part of the 4-state scheme — leave at its current neutral color, not forced into the grey/no-response treatment, since it's contextually different from "Please RSVP now"'s call-to-action framing.
self-report.tsx: apply getRsvpStatusColor(colors, event.rsvp_status) to the "Your RSVP: ..." text, replacing its flat themed.rsvp color.

Files to Create/Modify

src/theme/colors.ts
src/features/events/utils.ts
src/features/events/components/RosterList.tsx
src/features/events/components/EventListItem.tsx
src/features/events/components/RsvpControls.tsx
app/(app)/events/[id]/self-report.tsx

Migration Files
Not applicable — mobile-only, no backend.
Branch Name
feature/FP-143-rsvp-color-consistency
Commit Message
FP-143: consistent RSVP color-coding across all mobile RSVP displays
Pull Request Description
Maps to acceptance criteria:

"Accept=Green, Decline=Red, Tentative=Amber, No response=Grey" → new colors.warning token + shared getRsvpStatusColor(), applied consistently.
"Event Detail screen" (roster) → RosterList.tsx's one-line Tentative fix.
"My Events list: You're going=Green, You declined=Red, You might attend=Amber, Please RSVP now=bold Black" → EventListItem.tsx.
Two additional surfaces found during grounding, not in the original ticket, fixed for full "within the app" consistency: RsvpControls.tsx's current-response display and self-report.tsx's "Your RSVP" label.
No change to RSVP submission logic or data — display-only.

Jira Linkage

PDEEpicID: FP-15 (EPIC-4 — RSVP Management)
PDEStoryID: FP-143

Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-143.md, frozen after save. Open PR against dev, do not merge. No migration, no remote step.
Include full diffs for every file in the completion report.
