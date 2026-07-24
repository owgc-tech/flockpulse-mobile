DIP-FP-182-mobile-adj-4

Story Summary
Corrects a gap from adj-3's review: the RSVP card's tappable headline currently shows raw counts ("5 accepted"), which is redundant with the counts already shown in the bar rows directly below it — the DIP for adj-3 specified percentages, and this was missed in review. Fixes it to show percentages ("25% responded"), changes the default/first view from Accepted to Responded, and reorders the cycle to Responded → Accepted → Declined → Tentative → Not Responded. Also, a new request: the star glyphs above each feedback entry get colored to match their corresponding bar's color in the Rating card's legend (5★ green, 4★ lighter green, 3★ amber, 2★ lighter red, 1★ red), rather than the plain default text color they use today.

Repo Target
Mobile (Expo/React Native), owgc-tech/flockpulse-mobile. Continues on the existing branch feature/FP-182-mobile-dashboard-tab (PR #74, still open, not yet merged) — push as additional commits on that same branch.

Grounding Check
- Confirmed by re-reading rsvpHeadline() directly: it currently returns "${count} ${label}" for all five views — raw counts, not percentages, despite adj-3's own DIP text explicitly specifying percentage display. This was missed in the last review; correcting now rather than treating it as a new ask.
- Percent = Math.round(value / total * 100) for each of the five views, where total is the sum of all four raw RSVP counts (yes+no+tentative+no_response) — same derivation already used for rsvpMax's denominator concept, just not yet applied to the headline. Guarded against total === 0 the same way attendancePercent's null case already is (shows "—" rather than dividing by zero).
- New cycle order and default, per Joseph's exact wording this time: Responded (default/first) → Accepted → Declined → Tentative → Not Responded → back to Responded. This replaces adj-3's Accepted-first order entirely, not an addition to it.
- Star color reuses starBarColor(colors, star) — the exact same function already driving the Rating card's five bar colors — applied to the feedback list's star-glyph Text color too, so the mapping is guaranteed identical between the bars above and the stars next to each feedback entry, not a second hardcoded color list that could drift out of sync with the first.

Implementation Plan
1. rsvpHeadline(view, rsvp): change to compute a percent for each view (value / total * 100, rounded, "—" if total is 0) and return "{percent}% {label}" instead of "{count} {label}".
2. RSVP_CYCLE reordered to ["RESPONDED", "ACCEPTED", "DECLINED", "TENTATIVE", "NO_RESPONSE"], and the rsvpCycleIndex initial useState value implicitly defaults to index 0, which is now Responded — no separate "default" logic needed beyond the reorder itself.
3. Feedback row's star Text gains a color style: color: entry.star_rating !== null ? starBarColor(colors, entry.star_rating) : themed default, matching the same function call already used for the Rating card's bar rows above.

Files to Create/Modify
- app/(app)/(tabs)/dashboard/index.tsx (modify — rsvpHeadline, RSVP_CYCLE order, feedback star color only)

Migration Files
None.

Branch Name
Continue on the existing feature/FP-182-mobile-dashboard-tab (no new branch).

Commit Message
FP-182-mobile-adj-4: RSVP headline shows percentages (Responded default), feedback stars colored to match rating bars

Pull Request Description
- Confirm the RSVP headline now shows percentages matching Joseph's example numbers exactly (25% responded, 0% accepted, 25% declined, 0% tentative, 50% not responded) and that Responded is what's shown by default before any tap.
- Confirm the cycle order is Responded → Accepted → Declined → Tentative → Not Responded → back to Responded.
- Screenshot the feedback list showing each entry's stars colored to match its rating tier (green for 5★, red for 1★, etc.), confirming visually it lines up with the bar colors directly above.

Jira Linkage
- PDEEpicID: FP-36
- PDEStoryID: FP-182

Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-182-mobile-adj-4.md. Push as additional commits on the existing feature/FP-182-mobile-dashboard-tab branch (PR #74) — do not open a new PR. Stop once pushed; the user will re-review before merging.

Include full diffs for every changed file, no elisions.
