DIP-FP-182-mobile-adj-2

Story Summary
Reworks the tab bar for the still-unmerged Dashboard tab (PR #74): the five tabs are reordered to Events, Check-In, Board, Confirm, Tasks — Board centered, per Joseph's explicit layout choice. All five labels are shortened to reduce crowding, and My Events reverts to being the landing page after login — Joseph explicitly decided landing-page priority isn't worth a conflict with wanting Board centered. Second, and much larger and unchanged from the prior draft: the Attendance, RSVP, and Rating & Feedback cards are redesigned to use their unused right-hand space for a horizontal bar per category, with each category's label and count on the left color-coded to match its bar. The Rating card's bars are driven by the new five-star breakdown from DIP-FP-182-web-adj-2.

Repo Target
Mobile (Expo/React Native), owgc-tech/flockpulse-mobile. Continues on the existing branch feature/FP-182-mobile-dashboard-tab (PR #74, still open, not yet merged) — push as additional commits on that same branch.

Grounding Check
- Tab order is purely a matter of Tabs.Screen declaration order in _layout.tsx — reordering doesn't touch AnimatedTabBar's rendering logic at all, since it renders whatever order the navigator hands it.
- initialRouteName reverts to "index" (My Events) — removing the DIP-FP-182-mobile-adj-1 override entirely, per Joseph's explicit "I don't mind My Events being the landing page" resolution of the position-vs-landing tension.
- Label shortening evidenced by the original screenshot itself: "Confirmations" was already rendering as "Confirmatio…" (truncated) even before Board existed as a labeled tab, confirming the bar was already tight at 4 labels. Shortening all five should meaningfully help; icon/font sizing is deliberately left unchanged this round per Joseph's direction, to be revisited only if still crowded after real device testing.
- "Check-In" chosen for Self-Report over alternatives (e.g. "Attend") as the clearer, more standard term and the better parallel to "Confirm" — flagged as a recommendation Joseph approved implicitly by using it in his own ordering request.
- Bar-chart approach, color scheme, scaling convention, and the web dependency are unchanged from the prior draft of this DIP — see below, repeated for completeness since this replaces that draft in full.

Implementation Plan
1. _layout.tsx: reorder the five Tabs.Screen declarations to index (Events) → self-report/index (Check-In) → dashboard/index (Board) → confirmations/index (Confirm) → my-tasks/index (Tasks). Update each screen's tabBarLabel to the shortened word. Remove the initialRouteName="dashboard/index" override entirely (reverts to expo-router's default, which is the first-declared screen — index/My Events).
2. src/features/dashboard/types.ts: add breakdown: { star: number; count: number }[] to DashboardRatingStats, matching the new web field exactly.
3. dashboard/index.tsx — new shared BarRow component: one row = a label+count Text (colored) on the left, a horizontal bar (View, colored, width = count/maxCountInThisCard * 100%, against a low-opacity track background so a 0-width bar is still visually anchored) on the right. Used by all three cards.
4. Attendance card: three BarRow entries (Attended, Did Not Attend, Did Not Self-Report). Attended=success, Did Not Attend=danger, Did Not Self-Report=warning. Max = the largest of the three counts. Existing big "0%" headline stat and "Expected: N" line stay as-is above the rows.
5. RSVP card: four BarRow entries (Accepted, Declined, Tentative, Did Not Respond). Accepted=success, Declined=danger, Tentative=warning, Did Not Respond=textMuted. Max = the largest of the four counts. Existing "N accepted" headline stays.
6. Rating & Feedback card: five BarRow entries, one per star value 5 down to 1, using the new breakdown field. 5★=success, 4★=success at reduced opacity, 3★=warning, 2★=danger at reduced opacity, 1★=danger — an alpha-blended green-to-red gradient from the existing three semantic colors, not new raw hex values. Max = the largest count among the five; a zero-count star still renders its full row (label, "0", empty bar) so the full 1–5 scale stays visible. Existing "5.0" average headline and rating_count line stay above the rows; the text feedback list (star rating + text, no name, unchanged from the current build) moves below the five bar rows.

Files to Create/Modify
- app/(app)/(tabs)/_layout.tsx (modify — Tabs.Screen order, tabBarLabel text, initialRouteName removed)
- src/features/dashboard/types.ts (modify — add breakdown field)
- app/(app)/(tabs)/dashboard/index.tsx (modify — new BarRow component, all three cards restructured)

Migration Files
None.

Branch Name
Continue on the existing feature/FP-182-mobile-dashboard-tab (no new branch).

Commit Message
FP-182-mobile-adj-2: reorder tab bar to Events/Check-In/Board/Confirm/Tasks, shorten all labels, redesign Attendance/RSVP/Rating cards with color-coded bar graphs

Pull Request Description
- Confirm the tab order visually matches Events, Check-In, Board, Confirm, Tasks, and that the app lands on My Events after login.
- Confirm whether "Confirmations" still truncates now that every label is shorter — if it or any other label still clips, that's worth flagging back rather than assuming this fully solved it.
- Screenshot all three redesigned cards, including a case with a genuine zero-count category.
- Confirm this was tested against DIP-FP-182-web-adj-2's real breakdown field, not a guessed shape.

Jira Linkage
- PDEEpicID: FP-36
- PDEStoryID: FP-182

Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-182-mobile-adj-2.md. Push as additional commits on the existing feature/FP-182-mobile-dashboard-tab branch (PR #74) — do not open a new PR. Stop once pushed; the user will re-review before merging.

Include full diffs for every changed file, no elisions.
