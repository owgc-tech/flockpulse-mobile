DIP-FP-138-mobile (revised)
Story Summary
Replaces the "FlockPulse" text title on the mobile login screen with the square/stacked logo image (FlockPulseLogo2_AP5.png), preceded by a small "Powered by:" label left-aligned to the logo's left edge. Applying the "size it generously, don't undersell it" lesson from FP-136's web round, bounded by this screen's vertical constraints (different consideration than web's horizontal-only constraint).
Repo Target
Mobile (Expo/React Native) — owgc-tech/flockpulse-mobile.
Grounding Check

Confirmed live: app/(auth)/login.tsx renders <Text style={[styles.title, themed.title]}>FlockPulse</Text> directly above <LoginForm />, inside styles.content (flex: 1, justifyContent: 'center', paddingHorizontal: 24). This is the block being replaced.
Confirmed distinct from web, not a re-use: this DIP uses FlockPulseLogo2_AP5.png (square/stacked mark), not the FlockPulseLogo4_AP5.png used on web (FP-136) — different files, deliberately, per the original two-image clarification. Flagged explicitly to Joseph before implementation in case that assumption is wrong.
Confirmed live: no bundled local image is used in a screen yet (assets/ only holds app-icon/splash files referenced from app.json). First Image + require() usage in a screen component — standard Expo/RN pattern, no in-repo precedent to deviate from.
New requirement, changes the layout approach: "Powered by:" text directly above the logo, left-aligned to the logo's left edge — this means the logo block is no longer horizontally centered on screen (as the plain "FlockPulse" text was via textAlign: 'center'); it's now a left-aligned unit (text + logo sharing one left edge) sitting within content's existing paddingHorizontal: 24 inset.
Sizing judgment call, unchanged from the original grounding: square-ish logo in a narrow, vertically-constrained screen — "large, not undersold" still applies, but bounded by vertical space, not just horizontal. Adding the "Powered by:" label above it uses a bit more vertical space too, worth accounting for in sizing.
No local Expo Go/simulator preview available in this environment — same caveat as before. CC should size reasonably from real image dimensions + screen-width math and explicitly flag in the PR that Joseph needs to confirm the actual on-device look after publishing.
Confirmed live: app/(app)/_layout.tsx's "Unlock FlockPulse" re-lock screen uses a different, unrelated "FlockPulse" text pattern — still out of scope, not touched here.

Implementation Plan

Add the logo to assets/flockpulse-logo.png (locate the source file, inspect real dimensions, optimize if oversized — same discipline as the web round).
app/(auth)/login.tsx — replace the <Text> title with a left-aligned label + image block:

tsx   import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
   // ...
   <View style={styles.logoBlock}>
     <Text style={[styles.poweredBy, themed.poweredBy]}>Powered by:</Text>
     <Image
       source={require("@/assets/flockpulse-logo.png")}
       style={styles.logo}
       resizeMode="contain"
       accessibilityLabel="FlockPulse"
     />
   </View>

Styles:

logoBlock: { alignItems: 'flex-start', marginBottom: 32 } (replaces the old title's marginBottom, left-aligns both children to the same edge).
poweredBy: { fontSize: 13, marginBottom: 4 } — "small but readable," muted via a themed color (themed.poweredBy: { color: colors.textSecondary } following the existing themed-styles pattern in this file).
logo: { width: <reasoned value, ~55–65% of screen width or a fixed sensible number>, aspectRatio: <the real measured source ratio> } — measure the actual file, don't guess.
Remove the now-unused title/themed.title if nothing else references them (verify before deleting).


Reason through (can't visually confirm) that "Powered by:" + logo + form still fit comfortably without the keyboard forcing an awkward layout on a smaller device.

Files to Create/Modify

assets/flockpulse-logo.png (new)
app/(auth)/login.tsx (modify)

Migration Files
None.
Branch Name
feature/FP-138-mobile-login-logo
Commit Message
FP-138: replace FlockPulse text title with "Powered by:" + logo image on mobile login screen
Pull Request Description
Maps to FP-138's AC: text title replaced with the square logo image, preceded by a small "Powered by:" label sharing the logo's left edge, reasonably sized without crowding the form. Explicitly flag that final visual sizing needs Joseph's on-device confirmation — no simulator/browser preview was available in this environment.
Jira Linkage

PDEEpicID: FP-5
PDEStoryID: FP-138

Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-138-mobile.md, no appended notes after. Typecheck must pass cleanly. Open the PR against dev and stop — do not merge. After merge, run publish-dev-update.bat so Joseph can actually see it on-device. Full diffs required in the completion report.
