DIP-FP-147.md
Story Summary
Fixes the address-tap navigation link to respect what's actually installed/preferred on the device, rather than always falling back to a Google Maps web URL — which on iOS triggers an App Store redirect if Google Maps isn't installed (Joseph's original bug report). On iOS: try Google Maps' native app scheme first (approximating "the user's actual preference," since iOS has no true default-app setting exposed to apps), fall back to Apple Maps if it's not installed. On Android: use the geo: scheme, which genuinely does respect the OS-level default maps app.
Repo Target
Mobile (Expo/React Native) — owgc-tech/flockpulse-mobile.
Grounding Check
Confirmed live against dev:

getMapUrl(event) (src/features/events/utils.ts) is a synchronous function, currently the sole source of the address link's URL, called from exactly two places — app/(app)/events/[id].tsx and EventListItem.tsx — both via onPress={() => Linking.openURL(getMapUrl(event))}.
Critical finding, not anticipated by the original ticket: Linking.canOpenURL() — needed to detect whether Google Maps is installed — requires the target URL scheme to be pre-declared in iOS's Info.plist under LSApplicationQueriesSchemes (an iOS 9+ privacy restriction: apps can't probe for arbitrary installed apps without declaring intent upfront). This is not currently configured anywhere in app.json — confirmed via direct inspection, no infoPlist key exists under ios at all. Without this, canOpenURL('comgooglemaps://...') would always return false regardless of whether Google Maps is actually installed, silently defeating the whole feature — exactly the scenario Joseph described wanting to work (his personal iPhone, Google Maps installed) would never actually trigger.
This requires a native rebuild, not an OTA JS update. app.json's ios.infoPlist changes affect the compiled native binary (Info.plist), which Expo's OTA update mechanism (eas update, i.e. publish-dev-update.bat) cannot push — that mechanism only ships JS bundle changes. This fix needs an actual EAS Build and reinstall on test devices. Every other mobile fix this session shipped via the JS-only OTA path; this one is a genuine exception, worth flagging clearly so testing isn't attempted via the usual publish script alone.
getMapUrl must become async (Promise<string>), since the Google-Maps-installed check (canOpenURL) is inherently asynchronous — both call sites need their onPress handlers updated to await it.
Android's geo:0,0?q=... scheme doesn't need an equivalent manifest declaration — it's a standard OS-resolved implicit intent, not a specific-app package query subject to Android 11+ visibility restrictions, so no AndroidManifest/app.json Android-side change is needed for this to work. Flagged as an assumption to verify during real-device testing, not just taken fully for granted.
Platform.OS is already an established pattern in 6 other files — reused, not introduced. Linking.canOpenURL has never been used anywhere in this codebase before — a genuinely new pattern this DIP introduces, necessarily.

Implementation Plan

app.json: add "infoPlist": { "LSApplicationQueriesSchemes": ["comgooglemaps"] } under the existing ios block.
utils.ts: change getMapUrl(event: MyEvent) to async function getMapUrl(event: MyEvent): Promise<string>:

If event.location_url is set, return it immediately, unchanged.
Else build the encoded query from event.location_address.
iOS: check await Linking.canOpenURL('comgooglemaps://?q=' + query). If true, return that URL. Else, return 'http://maps.apple.com/?q=' + query (Apple Maps, always available as a system app — no check needed).
Android: return 'geo:0,0?q=' + query directly — no check needed, the OS resolves this to whatever's actually set as default.
Fallback (only reached in a genuinely exceptional case, e.g. canOpenURL itself throwing): today's Google Maps web URL, unchanged as the last resort.


app/(app)/events/[id].tsx and EventListItem.tsx: update the onPress handlers to async () => Linking.openURL(await getMapUrl(event)), since getMapUrl is now async.

Files to Create/Modify

app.json
src/features/events/utils.ts
app/(app)/events/[id].tsx
src/features/events/components/EventListItem.tsx

Migration Files
Not applicable.
Branch Name
feature/FP-147-native-maps-navigation
Commit Message
FP-147: prefer installed Google Maps, fall back to Apple Maps, instead of Google Maps web
Pull Request Description
Maps to acceptance criteria:

"iOS: prefer Google Maps if installed, else Apple Maps, never the web fallback as the common path" → canOpenURL check against comgooglemaps://, requires the new LSApplicationQueriesSchemes entry to actually work.
"Android: respect the OS-level default maps app" → geo: scheme.
"No behavior change when location_url is already set" → unchanged first branch.
Flagged prominently: this PR requires a native rebuild (EAS Build) to test — LSApplicationQueriesSchemes cannot be delivered via eas update/the usual publish script. Merging this PR alone will not make the fix testable; a new build is required afterward.

Jira Linkage

PDEEpicID: FP-11 (EPIC-3 — Event Lifecycle Management)
PDEStoryID: FP-147

Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-147.md, frozen after save. Open PR against dev, do not merge. No migration, no remote step. Flag clearly in the PR description that this needs an EAS Build, not just a merge + publish-dev-update.bat, before Joseph can test it on a device.
Include full diffs for every file in the completion report.
