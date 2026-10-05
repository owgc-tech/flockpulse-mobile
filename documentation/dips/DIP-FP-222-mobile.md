### DIP — FP-222 (Mobile, part 2 of 2): Obvious Needs Attention and Recently Modified banners

### Not covered — deliberately excluded
- Any server work: web part 1 and adj-1 provide the fields and the endpoint.
- Push or local notifications, any web screen, any "mark as read" button, and a history of past modifications.
- Refusal details beyond task names on the card (no people names), and any signal for a task that lost its assignee beyond the "Tasks" label.

### Story Summary
Joseph wants the two event-card indicators to be unmistakable, and the card to say WHAT changed. Show full-width banner strips at the top of the event card and at the top of the event detail screen: a strong red "NEEDS ATTENTION" strip naming the refused tasks (owner and Admins only, decided by the server) and a strong amber "RECENTLY MODIFIED" strip listing what changed. Both can appear together. The Events tab badge also counts the events that need attention. Opening an event records that the viewer has seen it, and the card loses its Recently Modified strip when the user returns to the list.

### Repo Target
Mobile (Expo). Depends on web part 1 and adj-1 being deployed.

### Grounding Check
Verified this session by reading the code, not assumed (re-verify first):
- Theme: src/theme/colors.ts has accent, danger, success and warning in light and dark.
- The card: src/features/events/components/EventListItem.tsx. A Pressable container (padding 16, border radius 8), then an optional announcement marker, the name, the event type, the date, the location link, the online meeting link and a footer (status pill, RSVP pill or the "Please RSVP now." prompt). Cancelled events use a red-tinted container.
- The Events screen: app/(app)/(tabs)/index.tsx computes pendingRsvpCount with useMemo (about line 168) and syncs it with syncMyEventsBadge(pendingRsvpCount) in an effect (about line 337); the tab badge reads useMyEventsBadgeCount in app/(app)/(tabs)/_layout.tsx. The list refetches on mount, on pull to refresh, and through the FP-151 signal (src/features/events/eventListRefreshSignal.ts, a module-level signal consumed in a useFocusEffect); it does NOT refetch on every focus.
- The detail screen: app/(app)/events/[id].tsx loads with getEventById in a useFocusEffect and merges the fresh response into its state; the list passes the event in route params. The EventDetail type already carries version and owner_member_id (src/features/events/types.ts).
- apiFetch (src/lib/api.ts, about line 158) always parses a JSON envelope; the web view endpoint returns 200 with { data: { version } } after web adj-1. Verify against the deployed web before relying on it.
- Server fields on list and detail responses (after web part 1 and adj-1): needs_attention: boolean, is_modified: boolean, modified_fields: string[], needs_attention_tasks: string[]. needs_attention is true only for the event's owner and Admins; is_modified is false for a first-time viewer and for the person who made the change.
- lucide-react-native is already used (Megaphone). Verify the installed version has TriangleAlert (or AlertTriangle) and Pencil.

### Implementation Plan
1. Types: add the four fields to the list type and make the detail type carry them (mind the Omit cascade noted in FP-223). At the boundary where responses are read, treat a missing field as false or [] so an older server never breaks a screen.
2. Service: recordEventView(eventId, version?) in src/features/events/services/events.service.ts, a POST to /api/events/${eventId}/view with a JSON body { version } through apiFetch; add no auth or retry logic of its own.
3. Pure helpers in src/features/events/utils.ts: the Needs Attention summary line ("Food Assignment refused", "Food Assignment, Music refused", and for three or more "Food Assignment, Music +1 more refused"); the Recently Modified line ("Changed: Date & time, Location", and no line when there are no labels); and getEventsBadgeCount(events) = the existing pending RSVP and acknowledgement count rule (move it here without changing it) plus the number of events with needs_attention.
4. A reusable component src/features/events/components/EventIndicatorBanners.tsx with props for the flags, the task names, the labels, the event id and a variant ('card' or 'detail'). It renders Needs Attention first, then Recently Modified:
   - Needs Attention: background colors.danger, a warning-triangle icon, bold uppercase "NEEDS ATTENTION", then the summary line.
   - Recently Modified: background colors.warning, a pencil icon, bold uppercase "RECENTLY MODIFIED", then the Changed line when it exists.
   - Text colors: choose them so every combination (each strip, light and dark theme) reaches at least 4.5:1 contrast; add tokens such as onDanger and onWarning to src/theme/colors.ts instead of hard-coding colors, and state the measured ratios in the PR.
   - Never color alone: icon plus bold text; accessibilityRole and an accessibilityLabel that reads the full message ("Needs attention: Food Assignment refused", "Recently modified. Changed: Date and time, Location"); testIDs event-item-needs-attention-<id> and event-item-modified-<id> (and detail equivalents).
   - Card variant: full-width strips at the very top of the card, bleeding to the card's edges (the card container gets overflow hidden; the strips use negative horizontal margins and a negative top margin equal to the card padding; the top corners follow the card's radius); stacked strips touch each other; the normal card content follows with its usual spacing. Detail variant: the same strips at the top of the screen content with normal margins and rounded corners.
5. EventListItem renders the banners from the event's flags. The card's press behavior is unchanged: the whole card, strips included, still opens the event. A cancelled event must stay readable.
6. Events screen: use getEventsBadgeCount(events) for the badge, in the same effect with the same dependency pattern, so the Events tab badge counts pending RSVPs and acknowledgements plus the events needing attention.
7. Detail screen: render the banners from the flags in the detail response and keep them visible for the whole visit, even after the view is recorded. After a successful getEventById, call recordEventView(params.id, fresh.version) once per load, fire-and-forget: errors are logged with console.warn and never shown to the user. After it succeeds, tell the list through a small module-level signal (same pattern as eventListRefreshSignal.ts) so that when the user returns to the Events tab that event's card no longer shows Recently Modified and its labels are gone, WITHOUT a network call and WITHOUT a pull to refresh. Viewing never changes Needs Attention.
8. A standalone script with a mocked apiFetch covering: the summary and Changed lines for 1, 2 and 3 or more items and for no labels; the badge count rule (pending RSVP, acknowledgement, needs attention, announcements); the boundary normalizer for a server that omits the new fields; and the exact shape of the recordEventView request.
9. Change nothing else: the RSVP flow, Tasks tab, other screens and the existing badge behavior stay as they are.

### Files to Create/Modify
- src/features/events/types.ts, src/features/events/utils.ts, src/features/events/services/events.service.ts (modify)
- src/features/events/components/EventIndicatorBanners.tsx (new) and EventListItem.tsx (modify)
- A new small signal file next to eventListRefreshSignal.ts
- app/(app)/(tabs)/index.tsx and app/(app)/events/[id].tsx (modify)
- src/theme/colors.ts (add the on-color tokens)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-222-mobile-event-indicators

### Commit Message
FP-222-mobile: Needs Attention and Recently Modified banners on event cards and detail

### Pull Request Description
Maps to FP-222's mobile criteria: obvious Needs Attention and Recently Modified indicators that can appear together, what changed and which task, the Events tab badge count, and recording of the last-viewed version. Include tsc, the script results, the measured contrast ratios, and what you could not test. Manual device steps for Joseph (two accounts are needed, for example the primary phone as owner and the designated phone as a member):
1. A member refuses a task on an event you own: your Events tab shows the red strip with the task name and the tab badge goes up by one. The member then commits instead: after a pull to refresh the strip is gone and the badge drops.
2. The member opens the event once. You then change its time and location on the web: the member's Events tab, after a pull to refresh, shows the amber strip "Changed: Date & time, Location". Tapping the card shows the strip on the detail screen; going back, the card no longer shows it, with no refresh.
3. Both strips together: they stack, red on top. Your own edit never flags for you.
4. Dark mode and the largest text size: both strips stay readable and aligned to the card edges.
5. Airplane mode while opening an event: no error appears.

### Jira Linkage
- PDEEpicID: FP-31
- PDEStoryID: FP-222 (part 2 of 2)

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-222-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Branch off current dev and open the PR with gh pr create --base dev; quote the base in your report and do NOT stack it on any other branch. Do not merge. Joseph tests on a real native build and merges manually.

Include full diffs for every file in your completion report per Section 5, rule 12, not a summary.
