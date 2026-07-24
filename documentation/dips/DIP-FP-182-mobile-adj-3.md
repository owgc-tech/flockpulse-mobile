DIP-FP-182-mobile-adj-3

Story Summary
Three cosmetic/UX refinements to the still-unmerged Dashboard tab (PR #74). First, the RSVP card's big headline stat becomes tappable, cycling through five views in order: Accepted, Responded (accepted+declined+tentative combined), Declined, Tentative, Did Not Respond, then back to Accepted. Second, each card's title moves onto a solid header bar colored with that card's own full-strength status color (opaque red/amber/green, not pale) instead of plain colored text, white lettering on the bar. Third, the two dropdowns' "Event Type" field label is replaced by a single "Events" section heading sitting above both selectors, and the feedback list gets restyled: star rating shown as repeated star characters instead of a number, feedback text italicized and quoted, the whole entry indented right.

Repo Target
Mobile (Expo/React Native), owgc-tech/flockpulse-mobile. Continues on the existing branch feature/FP-182-mobile-dashboard-tab (PR #74, still open, not yet merged) — push as additional commits on that same branch.

Grounding Check
- RSVP cycling: unchanged from the prior draft of this DIP — no backend change needed, percentages computed client-side from the four existing raw counts, cycle order Accepted → Responded → Declined → Tentative → Did Not Respond → Accepted, headline color stays fixed to the card's existing rsvpColor throughout the cycle, resets to Accepted whenever the selected event changes.
- Header bar color: confirmed by reading the code directly that attendanceColor/rsvpColor/ratingColor are already the full-strength (non-alpha) danger/warning/success values used elsewhere in this same file to build the pale card-tint background (via a "1a" alpha suffix) — the header bar reuses these same variables directly as its own background, no new color logic. White title text stays readable against any of the three at full strength.
- "Events" heading, flagged as an interpretation since the exact wording was ambiguous: implementing as one shared heading replacing "Event Type" entirely, sitting above both dropdowns, with the second dropdown's own "Event" label also removed (keeping it would read as a redundant "Events" then "Event" stacked directly on top of each other). DropdownField's label rendering becomes conditional (skipped entirely when the label prop is empty), mirroring the same empty-label pattern already used in the tab bar for the icon-only case.
- Feedback indent, flagged as an interpretation: "3 spaces indented to the right" implemented as a visual left-padding on the whole feedback entry (stars line + quoted text line together as one indented block), not three literal space characters prepended to the text — a fixed padding value reads consistently regardless of font, where literal spaces in a proportional font wouldn't indent predictably.
- Star display: entry.star_rating is always an integer 1–5 or null (DB-constrained on the web side, confirmed earlier in this engagement) — "★".repeat(star_rating) is safe with no bounds-checking needed beyond the existing null check already in place.

Implementation Plan
1. Card header bar: cardHeaderBar style's backgroundColor changes from a literal black to the card's own color variable, passed in per-card (attendanceColor for the Attendance card, rsvpColor for RSVP, ratingColor for Rating & Feedback) rather than hardcoded. Title text stays white, same as before.
2. DropdownField: label prop rendering becomes conditional — only render the label Text when label is non-empty, matching the tab bar's existing empty-label convention.
3. Above both DropdownFields, add a single new heading Text reading "Events", styled consistently with existing section-heading conventions in this file. Change the Event Type DropdownField's label to "" and the Event DropdownField's label to "" as well, relying on each field's placeholder/value text and their fixed top-to-bottom order (type, then event) to stay self-explanatory without individual labels.
4. Feedback row: replace {entry.star_rating}★ with {"★".repeat(entry.star_rating)}. Wrap the feedback text in literal double-quote characters: {`"${entry.feedback}"`}. Add fontStyle: "italic" to the feedbackText style. Add a left padding/margin (e.g. paddingLeft: 24, roughly three character-widths at this font size) to feedbackRow so the whole stars+text block sits indented as one unit.

Files to Create/Modify
- app/(app)/(tabs)/dashboard/index.tsx (modify — card header bar color source, dropdown/label restructuring, feedback row styling; RSVP cycling logic unchanged from the prior draft)

Migration Files
None.

Branch Name
Continue on the existing feature/FP-182-mobile-dashboard-tab (no new branch).

Commit Message
FP-182-mobile-adj-3: tappable cycling RSVP stat, status-colored header bars, Events heading, styled feedback list

Pull Request Description
- Confirm the RSVP tap cycle order and event-change reset, same as the prior draft.
- Screenshot all three cards showing each one's header bar in its own full-strength status color (red/amber/green) rather than black.
- Screenshot the "Events" heading above both dropdowns with their individual labels removed, and confirm it doesn't read as bare/confusing without them.
- Screenshot the feedback list showing star-glyph ratings, italicized quoted text, and the right-indent.

Jira Linkage
- PDEEpicID: FP-36
- PDEStoryID: FP-182

Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-182-mobile-adj-3.md. Push as additional commits on the existing feature/FP-182-mobile-dashboard-tab branch (PR #74) — do not open a new PR. Stop once pushed; the user will re-review before merging.

Include full diffs for every changed file, no elisions.
