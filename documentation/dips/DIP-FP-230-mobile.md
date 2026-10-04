### Not covered — deliberately excluded
- The root cause of the original expiry: this DIP makes any rejected session recoverable; the cause stays under investigation in FP-230.
- The fresh-install first-launch problem: FP-231 (needs a new native build).
- The "fetch request canceled" error: FP-226, a separate bug.
- Any web or server change: the server already returns the right code.

### Story Summary
Fixes FP-230. When the server rejects the app's login token, the mobile app currently shows an error on every tab and never recovers or returns to the login screen. Add recovery: on a rejected token, force one session refresh and retry the request once; if the session is truly dead, sign the user out and show the login screen with a clear message. Network trouble must never sign anyone out.

### Repo Target
Mobile (Expo). No backend change.

### Grounding Check
Verified live against dev this session, not assumed:
- The server (flockpulse-web src/lib/auth/middleware.ts, withAuth) returns HTTP 401 with code INVALID_TOKEN in three cases, told apart only by message text: "Invalid or expired token", "Token missing tenant_id claim", and "No active member record for this user" (the account was removed or deactivated). A missing Authorization header returns 401 AUTH_REQUIRED. Do not parse message text: treat all three INVALID_TOKEN cases the same way.
- Mobile apiFetch (src/lib/api.ts): getSession() wrapped in withTimeout, then fetch with an AbortController timeout, then throws ApiError(code, message, status) built from the {error} envelope. Nothing handles a rejected token. The only AUTH_REQUIRED path is "no local session".
- The auth gate (app/(app)/_layout.tsx) sends the user to login only when useSession has no session. useSession listens to onAuthStateChange; on SIGNED_OUT it clears the trusted-device flag (FP-92/93) and sets session to null.
- src/features/auth/services/auth.service.ts signOut() throws on error. VERIFY in the installed @supabase/auth-js (read the source in node_modules, do not rely on memory) what signOut does when its server call fails with a network error: the local session may NOT be removed in that case.
- src/lib/supabase.ts already starts and stops auto-refresh with app foreground and background.
- Existing patterns to reuse: module-level signal files (eventListRefreshSignal.ts, pendingNotificationSignal.ts) and FP-206's friendly timeout message with a Try Again button.
- Concurrency: every tab calls apiFetch at the same time when the app opens, so one dead session produces several simultaneous 401s. Refresh tokens rotate, so parallel refreshes can invalidate each other. Recovery must be single-flight.

### Implementation Plan
1. In apiFetch, after the error envelope is parsed: if status is 401 and code is INVALID_TOKEN and this call has not already been retried, run recoverSession(). If it reports "refreshed", retry the same request ONCE with the new access token. If the retry is again INVALID_TOKEN, or recoverSession() reports "dead", run expireSession().
2. recoverSession() (new, src/features/auth/services/sessionRecovery.service.ts), single-flight (one shared in-flight promise for all concurrent callers): call supabase.auth.refreshSession() wrapped in the same withTimeout, and classify the outcome:
   - "refreshed": a new session came back.
   - "dead": a definitive auth failure, meaning an AuthApiError with status 400, 401, 403, 404 or 422 (for example refresh_token_not_found, refresh_token_already_used, session_not_found, user_not_found). Use the exported helpers isAuthApiError and isAuthRetryableFetchError if the installed version has them; confirm the exact shapes in node_modules.
   - "unknown": a timeout, a network failure or a 5xx. Do NOT sign the user out. Surface the failure through the existing friendly network/timeout error so the Try Again button appears.
3. expireSession() (same file), single-flight and idempotent: set a one-time notice (a small signal module, same pattern as the existing signal files), then guarantee the local session is removed even if the server-side sign-out call fails, so the gate redirects to login. The existing SIGNED_OUT listener in useSession clears the trusted-device flag; confirm it still runs on this path and that nothing is cleared twice.
4. Login screen (app/(auth)/login.tsx): show the notice once, then clear it: "Your session has ended. Please sign in again." One generic wording covers expired, revoked and deactivated accounts.
5. Loop protection: at most one refresh and one retry per request; once expireSession() has started, other in-flight 401s must not start another refresh or sign-out, and no raw token error should flash on the tabs behind the redirect.
6. Unchanged: AUTH_REQUIRED (no local session), 403 errors such as FORBIDDEN_ROLE, every non-401 error, and the web app.

### Files to Create/Modify
- src/lib/api.ts (modify)
- src/features/auth/services/sessionRecovery.service.ts (new)
- src/features/auth/sessionExpiredNotice.ts (new, signal module)
- app/(auth)/login.tsx (modify: show the notice once)
- src/features/auth/services/auth.service.ts (modify only if the force-local-clear needs a helper there)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-230-mobile-session-recovery

### Commit Message
FP-230-mobile: recover from rejected sessions or return to login

### Pull Request Description
Maps to FP-230's acceptance criteria. Include evidence that each of these was exercised with mocked supabase and fetch (a standalone script is fine if the repo has no test runner):
1. 401 INVALID_TOKEN, refresh succeeds, retry returns 200: the user sees nothing.
2. Refresh fails definitively: signed out, notice set, login shown.
3. Refresh succeeds but the retry is INVALID_TOKEN again: signed out.
4. Refresh times out or fails on the network: NOT signed out; the Try Again path is used.
5. Five simultaneous 401s: exactly one refresh call and at most one sign-out.
6. Non-INVALID_TOKEN 401s, 403s and the AUTH_REQUIRED path behave exactly as before.
7. The local session is cleared even when the server-side sign-out call fails, and the trusted-device flag is cleared.
State what the installed auth-js version actually does on sign-out failure, and list the manual real-device steps for Joseph: (a) delete a throwaway test member's auth user in the Supabase dashboard while signed in on the phone, then reopen the app; (b) deactivate a test member on the web Members page while signed in on the phone, then pull to refresh; (c) airplane mode must NOT sign the user out. Expected for (a) and (b): the login screen with the notice. Say clearly what you could not test.

### Jira Linkage
- PDEEpicID: FP-31
- PDEStoryID: FP-230

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-230-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge. Joseph tests on a real native build and merges manually.

Include full diffs for every file in your completion report per Section 5, rule 12, not a summary.
