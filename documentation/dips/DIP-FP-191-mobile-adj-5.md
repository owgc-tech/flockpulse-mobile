DIP 2 of 2 — Mobile
Story Summary

Once FP-191-web-adj-4 is merged and live, mobile's Announcement event detail screen should show real acknowledgement status instead of RSVP-shaped "no response" for everyone. This adds a new roster fetch/display path for Announcements: the section title becomes "Recipients" (vs. "Invitees" for real events), the summary table shows Acknowledged/Not Responded (vs. Accepted/Tentative/Declined/Not Responded), and every targeted member is listed with their status. Depends on FP-191-web-adj-4 being merged and deployed to dev first — do not start until that endpoint is live and confirmed.

Repo Target

Mobile (Expo) — the second half of a two-repo fix; see FP-191-web-adj-4 for the backend endpoint this consumes.

Grounding Check

Confirmed live against owgc-tech/flockpulse-mobile dev:

app/(app)/events/[id].tsx already computes isAnnouncement (line 361) and already branches on it at the section immediately above the roster (AnnouncementSection vs. RsvpSection, lines 496–505) — this DIP follows that exact same conditional-component pattern for the roster section itself, rather than threading an isAnnouncement prop into the existing RosterSection.
RosterSection (same file, ~line 643) and RosterList (src/features/events/components/RosterList.tsx) are both typed tightly around RosterEntry's RSVP-specific fields (response, rsvp_reason, guest_count) — these are meaningless for acknowledgement data, so new sibling components are the right call, not a shared/union-typed retrofit of the existing ones. Existing RosterSection/RosterList/ResponseCountTable are untouched by this DIP.
src/features/announcements/services/announcements.service.ts already exists with AnnouncementAcknowledgement and acknowledgeAnnouncement() — the new type and fetch function belong here, alongside the existing Announcement-specific code, not in events/types.ts.
Color tokens colors.success / colors.textMuted are already used by RosterList for ACCEPTED/NOT_RESPONDED — reused as-is for Acknowledged/Not responded yet, no new tokens needed.
showRoster (role !== 'MEMBER') is unaffected — reused unchanged for the Announcement branch too.
No RSVP/attendance invariant touched — this only changes what Admin/Leader sees for Announcements, using the new acknowledgement-scoped endpoint.
Implementation Plan
src/features/announcements/services/announcements.service.ts
Add AnnouncementRosterEntry interface, matching web's AnnouncementRosterEntry exactly: { member_id: string; first_name: string; last_name: string; acknowledged_at: string | null }.
Add getAnnouncementRoster(eventId: string): Promise<AnnouncementRosterEntry[]> calling GET /api/announcements/${eventId}/roster via apiFetch.
New file: src/features/events/components/AnnouncementRosterList.tsx
Mirrors RosterList.tsx's structure exactly (same row layout, same testID convention roster-entry-${member_id}), but typed on AnnouncementRosterEntry: name, then "Acknowledged" (colors.success) or "Not responded yet" (colors.textMuted) — no guest-count suffix, no reason line (neither concept applies to Announcements).
Empty state: same copy as RosterList's ("No one has been invited to this event yet.").
app/(app)/events/[id].tsx
Add AnnouncementRosterSection (new function in this file, alongside the existing RosterSection): same useCallback/useEffect load pattern, calling getAnnouncementRoster(eventId) instead of getEventRoster(eventId), rendering a new AcknowledgementCountTable (two columns only — Acknowledged / Not Responded, computed by reducing over acknowledged_at !== null, no guest logic) above a <Text>Recipients</Text> heading and <AnnouncementRosterList entries={roster} />.
At the roster-section call site (~line 507–512), branch on the already-computed isAnnouncement: render AnnouncementRosterSection when true, existing RosterSection (unchanged) when false — same ternary pattern already used one section above it for AnnouncementSection/RsvpSection.
Files to Create/Modify
src/features/announcements/services/announcements.service.ts (modify)
src/features/events/components/AnnouncementRosterList.tsx (new)
app/(app)/events/[id].tsx (modify)
Migration Files (if applicable)

None.

Branch Name

feature/FP-191-mobile-adj-5-announcement-acknowledgement-roster

Commit Message

FP-191-mobile-adj-5: show acknowledgement status in Announcement event detail roster

Pull Request Description

For Announcement-type events, the event detail screen's roster section now reads from the new /api/announcements/:eventId/roster endpoint (FP-191-web-adj-4) instead of the RSVP roster. Section title changes to "Recipients" for Announcements (unchanged "Invitees" for real events), summary table shows Acknowledged/Not Responded, and every targeted member is listed with their real acknowledgement status instead of a blanket "No response yet." No changes to the existing RSVP-based roster path for non-Announcement events.

Jira Linkage
PDEEpicID: FP-188
PDEStoryID: FP-191
Stop Point

Save this DIP verbatim to documentation/dips/DIP-FP-191-mobile-adj-5.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it against the deployed dev environment, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
