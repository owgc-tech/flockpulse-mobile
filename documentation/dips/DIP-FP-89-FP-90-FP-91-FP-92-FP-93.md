DIP-FP-89-FP-90-FP-91-FP-92-FP-93
Story Summary
This DIP bootstraps the `flockpulse-mobile` repo from empty and implements the complete mobile authentication foundation: baseline login (FP-89), TOTP MFA enrollment (FP-90), MFA verification at login on untrusted devices (FP-91), biometric unlock for trusted devices (FP-92), and the password-reset/MFA interaction (FP-93). These five stories are combined because they form one continuous, structurally inseparable auth flow — FP-91 depends on FP-90's enrolled factor, FP-92 depends on FP-91 establishing a trusted session, and FP-93 touches the same session/trust mechanism FP-92 introduces. Splitting them would mean re-touching the same login screen and session state four separate times.
This is also the first work in the mobile repo, so Phase 0 covers project scaffolding — nothing else in mobile is reachable without this.
Repo Target
Mobile (Expo + React Native + TypeScript) — `owgc-tech/flockpulse-mobile`. Confirmed empty (no commits, no branches) as of this session. Branch convention mirrors web: `main` stays empty, all work targets `dev`.
No web-repo companion DIP is needed — see Grounding Check.
Grounding Check

* No new backend/migration required. Verified live against current Supabase Auth documentation:
   * `supabase.auth.mfa.enroll({ factorType: 'totp' })` → returns factor ID + QR code (SVG) + secret/URI. `supabase.auth.mfa.challenge()` + `.verify()` (or the combined `.challengeAndVerify()`) upgrades the session from `aal1` to `aal2`. TOTP MFA is free and enabled by default on all Supabase projects — Supabase manages factors internally (its own `auth.mfa_factors` table); we do not create or migrate anything for this.
   * This resolves FP-90's own "verification needed" flag — the API is confirmed, not assumed.
   * FP-93's session invalidation is native Supabase Auth behavior, not custom code: a session terminates when the user changes their password or performs a security-sensitive action, per Supabase's session docs. One caveat to carry into implementation and testing: this revokes the refresh token so it can't be used elsewhere, but an already-issued access token remains valid until it expires. The "must fully re-verify immediately after reset" guarantee depends on the project's access-token expiry being short — this is a Supabase Dashboard config value to confirm, not something this DIP writes code for. Flagging rather than assuming it's already set appropriately.
* Cross-tenant referential safety, atomicity, canonical error codes (Section 5, rules 4/5/6): not applicable — no new tables, no multi-table writes, and errors surfaced here are Supabase Auth's own `AuthApiError` shapes, not our custom API layer's canonical codes. App-level messaging wraps these generically (e.g., FP-89's "don't reveal whether email or password was wrong") rather than mapping to `FORBIDDEN_SCOPE`/etc., since this bypasses our `/api/...` routes entirely.
* Tenant/member context: mobile authenticates against the same Supabase Auth user records and JWTs already established by the web Foundation work (STORY-1.1 / FP-13). No new resolution logic — the JWT's `tenant_id`/`member_id` claims are read the same way, just from a different client.
* Assumption flagged, not silently made: this DIP scaffolds with Expo Router (file-based routing, current default for new Expo projects) rather than plain React Navigation, since no prior mobile convention exists to follow. Say now if you want React Navigation instead — easy to change before any code exists, expensive after.
Implementation Plan
Phase 0 — Bootstrap (must complete and be committed before any story work)

1. `npx create-expo-app@latest . --template blank-typescript` inside the empty repo.
2. Add Expo Router (`expo-router`) and its required peer deps (`react-native-safe-area-context`, `react-native-screens`, `expo-constants`, `expo-status-bar`, `expo-linking`).
3. Add auth-flow deps: `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill` (required shim for `supabase-js` under React Native), `expo-secure-store`, `expo-local-authentication`.
4. Establish `main` (kept empty per convention) and `dev` branches. All feature branches for this and future mobile DIPs cut from `dev`.
5. `.env.example` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` — the `EXPO_PUBLIC_` prefix is required for Expo to expose these to the client bundle; do not use unprefixed names, they won't be readable at runtime.
6. `src/lib/supabase.ts` — Supabase client initialized with `AsyncStorage` as the session storage adapter (standard pattern for Supabase + Expo), `autoRefreshToken: true`, and an `AppState` listener to pause/resume auto-refresh on background/foreground.
Phase 1 — FP-89: Mobile Login Screen 7. `app/(auth)/login.tsx` — email/password form calling `supabase.auth.signInWithPassword()`. 8. Failure path returns one generic error message regardless of whether the email or password was wrong (Supabase's own error doesn't distinguish by default, so no extra work needed to satisfy this AC — confirm error message copy doesn't leak the distinction). 9. On success, check `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` — if `nextLevel` is `aal2` and `currentLevel` is `aal1`, route to MFA verify (Phase 3) instead of the app shell.
Phase 2 — FP-90: MFA Enrollment (TOTP) 10. `app/(auth)/mfa-enroll.tsx` — offered post-login for members without a verified factor (`supabase.auth.mfa.listFactors()` returns none). 11. Calls `mfa.enroll({ factorType: 'totp' })`, renders returned QR (SVG as data URL) plus the manual-entry secret as fallback. 12. Verification step: `mfa.challenge()` then `mfa.verify()` (or `challengeAndVerify()`) with the user-entered code. On success the factor is active and session is `aal2`.
Phase 3 — FP-91: MFA Verification at Login 13. `app/(auth)/mfa-verify.tsx` — shown when `nextLevel === 'aal2'` and a factor already exists. Calls `mfa.challengeAndVerify()` with the entered code. Session isn't established at `aal2` (and app shell isn't reachable) until this succeeds. 14. On success, mark the device as "trusted" (Phase 4) and route to the app shell.
Phase 4 — FP-92: Biometric Unlock for Trusted Devices 15. `src/features/auth/services/biometricTrust.service.ts` — on first successful `aal2` login, check `expo-local-authentication`'s `hasHardwareAsync()`/`isEnrolledAsync()`; if available, store a `biometric_trusted:{userId}` flag via `expo-secure-store` (Keychain/Keystore-backed, not AsyncStorage — this flag gates convenience, so it gets the stronger store). 16. On subsequent app opens: if the flag exists, prompt `LocalAuthentication.authenticateAsync()` instead of the full login form. On success, resume the existing Supabase session (already persisted/auto-refreshed via AsyncStorage) without re-prompting for MFA. 17. Guard condition, per FP-92's own AC: if the underlying Supabase session is invalid/expired/revoked (refresh fails), do not fall back to biometric alone — clear the trusted flag and force full password + MFA.
Phase 5 — FP-93: Password Reset Interaction with MFA 18. Reuse the existing "forgot password" email flow unchanged (`supabase.auth.resetPasswordForEmail()` — this is a web-repo-issued email today; confirm the reset link's redirect target includes a mobile deep link or continues to route through web, since no mobile-specific reset UI is in scope here per FP-93's AC). 19. Subscribe to `supabase.auth.onAuthStateChange()` for a `SIGNED_OUT` event coming from elsewhere (e.g., password changed on another device/web) — on receipt, clear the local `biometric_trusted` flag so the next open forces full password + TOTP, never biometric-only. 20. Document the access-token-expiry dependency (Grounding Check item above) directly in code comments so it isn't lost.
Phase 6 — Local verification (before commit, not a substitute for `npm run build`-equivalent) 21. Run `npx tsc --noEmit` (Expo/RN has no `next build`-style type check, so this is the closest equivalent — flag explicitly in the PR whether it passed cleanly). 22. Smoke-test the full chain via `expo start` + Expo Go: fresh login → enroll → verify → biometric-gated reopen → password reset elsewhere → forced re-verification.
Files to Create/Modify

```
app.json / app.config.ts
package.json, tsconfig.json, babel.config.js, .env.example
app/_layout.tsx
app/(auth)/login.tsx
app/(auth)/mfa-enroll.tsx
app/(auth)/mfa-verify.tsx
app/(app)/_layout.tsx                 (protected route group)
src/lib/supabase.ts
src/features/auth/hooks/useSession.ts
src/features/auth/services/auth.service.ts
src/features/auth/services/biometricTrust.service.ts
src/features/auth/components/LoginForm.tsx
src/features/auth/components/MfaEnrollForm.tsx
src/features/auth/components/MfaVerifyForm.tsx
src/features/auth/types.ts
documentation/dips/DIP-FP-89-FP-90-FP-91-FP-92-FP-93.md   (this file, saved verbatim, first action)
```

Migration Files (if applicable)
None. No new tables, columns, or triggers — confirmed in Grounding Check.
Branch Name
`feature/FP-89-90-91-92-93-mobile-auth-foundation`
Commit Message
`FP-89-FP-90-FP-91-FP-92-FP-93: bootstrap mobile app and implement login/MFA/biometric auth flow`
Pull Request Description
Map explicitly to each story's AC:

* FP-89: email/password form; session established only on success; generic error message on failure (no email-vs-password disclosure).
* FP-90: enrollment flow generates TOTP secret/QR via Supabase Auth MFA; member confirms via valid code from their authenticator app.
* FP-91: session not established at `aal2` until password + valid TOTP succeed; device marked trusted afterward.
* FP-92: native biometric APIs only, no biometric data leaves device; new/expired/revoked session always forces full MFA, never biometric-only fallback.
* FP-93: existing forgot-password email flow unchanged; trusted-device session invalidated on password reset (native Supabase behavior, documented); next login requires full password + TOTP before biometric convenience resumes.
Jira Linkage

* PDEEpicID: FP-5 (EPIC-1 — Tenant & Access Control)
* PDEStoryID: FP-89, FP-90, FP-91, FP-92, FP-93
Stop Point
Save this DIP verbatim to `documentation/dips/DIP-FP-89-FP-90-FP-91-FP-92-FP-93.md` and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against `dev` and stop. Do not merge. Test via `expo start` + Expo Go against the branch, then merge manually once confirmed. No Vercel-style deployed preview exists for this repo; local Expo Go testing is the equivalent gate.
Include full diffs for every file in the completion report per Section 5, rule 12 — not a summary.
