### DIP — FP-240 (Mobile): Show the RSVP roster to every role

### Not covered — deliberately excluded
- Any server work: web FP-240 makes the roster endpoint available to every role that can open the event, redacts other people's decline reasons, and hides removed members.
- Reports, web screens, the announcement acknowledgement roster, and the person's own RSVP section: unchanged.

### Story Summary
Decision by Joseph (FP-240, 2026-10-05): everyone who can open an event sees everybody's RSVP on the mobile Event Detail. Today the detail screen shows the roster only when the role is not Member (showRoster = role !== undefined && role !== "MEMBER"), so Members see only their own RSVP. Show the roster to every role. The server decides what each person may see (full list, decline reasons only for Admins, the decliner's leader and the person themself, removed members absent), so the phone only has to display what it receives.

### Repo Target
Mobile (Expo). Depends on web FP-240 being deployed.

### Grounding Check
Verified this session by reading the code, not assumed (re-verify first):
- app/(app)/events/[id].tsx: showRoster = role !== undefined && role !== "MEMBER" (about line 207) decides whether the roster section renders (about lines 613 to 623: AnnouncementRosterSection for announcements, RosterSection otherwise); the person's own RsvpSection is always shown for attendees.
- src/features/events/components/RosterList.tsx: shows the response label and color, a guest suffix for a positive guest_count, and the reason line only when response is DECLINED and rsvp_reason is non-empty.
- getEventRoster in the mobile events service reads GET /api/events/:id/roster; after web FP-240 a Member receives data instead of a 403 and the server nulls other people's reasons.
- The existing defensive pattern waits for the role before deciding what to render.
- Verify against the DEPLOYED web before finishing: the roster endpoint must answer a Member with the full roster for an event they are invited to (state in the PR how you verified, and say plainly if you could not).

### Implementation Plan
1. Extract the visibility decision into one small pure function (for example shouldShowRoster(role) in src/features/events/utils.ts) that returns true for every known role, keeping the "do not decide until the role is known" behavior (undefined role returns false), and use it in the detail screen instead of the inline comparison.
2. Make no change to RosterList's display rules: it already shows a reason only when the server sends one.
3. Make sure a failed or forbidden roster load shows the existing friendly error state with Try Again and never crashes or exposes raw text.
4. Standalone script covering shouldShowRoster for MEMBER, LEADER, ADMIN and an undefined role, and that RosterList's reason rule shows a reason only when the entry has one.
5. Change nothing else.

### Files to Create/Modify
- app/(app)/events/[id].tsx and src/features/events/utils.ts (modify)
- A small script, for example scripts/test-fp240-mobile.ts (new)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-240-mobile-roster-for-all

### Commit Message
FP-240-mobile: show the RSVP roster to every role

### Pull Request Description
Maps to FP-240's mobile criteria. Include tsc, the script results, how you verified the deployed endpoint, and what you could not test. Manual device steps for Joseph:
1. On a plain Member's phone, open an event you are invited to: the roster section appears with everyone's response and guest count, and no one else's decline reason (only your own, if you declined).
2. On a Leader's phone: the full roster, and decline reasons only for the people assigned to that leader.
3. On an Admin's phone: the full roster and every reason.
4. A removed member never appears in the list.
5. Airplane mode: the roster shows the friendly error with Try Again.

### Jira Linkage
- PDEEpicID: FP-15
- PDEStoryID: FP-240

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-240-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Branch off current dev and open the PR with gh pr create --base dev; quote the base in your report and do NOT stack it on any other branch. Do not merge. Joseph tests on a real native build and merges manually.

Include full diffs for every file in your completion report per Section 5, rule 12, not a summary.
