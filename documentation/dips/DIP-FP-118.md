# DIP-FP-118

### Story Summary

Adds a persistent Community Banner (logo, community name, "Powered by FlockPulse") to the top of every screen in the mobile app's authenticated shell, and removes native header title text app-wide since it's now redundant with the banner plus each screen's own body content. My Events' month-picker dropdown relocates from the native header into the screen body to make room. No backend work — this reuses `GET /api/tenant/settings`, already built for FP-104 (web).

### Repo Target

Mobile (Expo) — `owgc-tech/flockpulse-mobile`. No web changes.

### Grounding Check

* Confirmed live: `GET /api/tenant/settings` already returns `name`, `logo_url`, `tagline` (added for FP-104's web-only Admin Nav Shell). Mobile has no tenant service at all yet — this is genuinely new mobile consumption of an existing endpoint, not new backend scope.
* Confirmed FP-104's established branding convention applies identically here: logo/tagline render conditionally (nothing shown if unset, no FlockPulse-branded placeholder standing in), community name falls back to `"Community"` if unset. `"Powered by FlockPulse"` is a separate, static, always-shown line — not the same thing as `tenants.tagline` (a tenant-configurable field this story doesn't otherwise surface on mobile).
* Confirmed Event Detail's header title is set dynamically to `event.name` (in `[id].tsx`'s own `<Stack.Screen>` override), which duplicates the event name already shown in the body — the specific case that surfaced this story. Confirmed the other four pushed screens' titles (`Self-Report`, `Edit Event`, `New Event`, `Edit Profile`) don't literally duplicate body text, but per the user's explicit direction, the same simplification applies uniformly rather than case-by-case.
* Real technical constraint, not a nice-to-have: on the two tab screens, `Tabs.Screen`'s `title` option is the source for both the native header text and the bottom tab bar's label (via React Navigation's fallback behavior). Blanking `title` outright would silently wipe the bottom tab bar's own labels too. Must set `tabBarLabel` explicitly alongside a blanked `headerTitle` to avoid this regression.
* No Section 4 invariant rules touched (no RSVP/attendance/tenancy data logic); no migrations; no cross-tenant or atomicity concerns — this is UI-only, reading already-tenant-scoped data from an existing endpoint.

### Implementation Plan

1. New `src/features/tenant/services/tenant.service.ts` — `fetchTenantSettings()` wrapping `GET /api/tenant/settings`, returning `{ name, logo_url, tagline }` (all nullable except `name`, which the endpoint always returns).
2. New `src/features/tenant/components/CommunityBanner.tsx` — fetches once on mount (simple `useEffect`, no complex caching needed — this data changes rarely, unlike the role-sync issue from earlier). Renders:
   * `Image` with `source={{ uri: logo_url }}` only if `logo_url` is set; nothing in its place otherwise.
   * Community name: `name ?? "Community"`.
   * `"Powered by FlockPulse"`, small/muted, always shown (no conditional prop needed — simpler than an earlier draft of this story, since scope is now "everywhere").
3. `app/(app)/_layout.tsx` — render `<CommunityBanner />` once, above the existing `<Stack>` (wrap the current `ready`-phase return value in a `View` containing the banner + the `Stack`). This is what makes it show on every screen without touching any individual screen's own header setup. Remove the static `title` values from every `Stack.Screen` here (`events/[id]`, `events/[id]/self-report`, `events/[id]/edit`, `events/create`, `profile/edit`).
4. Remove the inline dynamic title overrides in each of those five screens' own `<Stack.Screen options={{ title: ... }} />` calls (`[id].tsx`'s `title: event.name`, and the static titles in `self-report.tsx`, `edit.tsx`, `create.tsx`, `profile/edit.tsx`) — these currently override the parent default and must be cleared too, or the parent-level removal alone won't take effect.
5. `app/(app)/(tabs)/_layout.tsx` — for both `Tabs.Screen` entries, replace `title` with `tabBarLabel` (`"My Events"` / `"Confirmations"`) plus an explicit `headerTitle: () => null` — preserves bottom tab bar text, blanks only the native header title.
6. `app/(app)/(tabs)/index.tsx` — remove the month-dropdown `Pressable` and its supporting `View` from `headerLeft`; move the same component (and its existing `Modal`/picker state, unchanged) into the screen body, as a small row directly above the `SectionList`.

### Files to Create/Modify

```
src/features/tenant/services/tenant.service.ts          (new)
src/features/tenant/components/CommunityBanner.tsx       (new)
app/(app)/_layout.tsx                                    (modified)
app/(app)/(tabs)/_layout.tsx                             (modified)
app/(app)/(tabs)/index.tsx                               (modified)
app/(app)/events/[id].tsx                                (modified — remove inline title)
app/(app)/events/[id]/self-report.tsx                    (modified — remove inline title)
app/(app)/events/[id]/edit.tsx                           (modified — remove inline title)
app/(app)/events/create.tsx                              (modified — remove inline title)
app/(app)/profile/edit.tsx                               (modified — remove inline title)
```

### Migration Files

None.

### Branch Name

`feature/FP-118-mobile-community-banner`

### Commit Message

`FP-118: add persistent Community Banner, remove redundant screen titles, relocate month dropdown`

### Pull Request Description

Maps to FP-118's three ACs: Community Banner visible on every `(app)`-group screen (logo conditional, name with fallback, static "Powered by FlockPulse"); all native header titles removed app-wide with back buttons/Avatar unaffected and bottom tab bar labels explicitly preserved via `tabBarLabel`; My Events' month dropdown relocated from header into body with identical picker behavior.

### Jira Linkage

* PDEEpicID: FP-5
* PDEStoryID: FP-118

### Stop Point

Save this DIP verbatim to `documentation/dips/DIP-FP-118.md` — no executor notes appended afterward; those go in the PR description only. Open the PR against `dev` and stop. Don't merge — I review, you merge, then test on-device via Expo Go.
