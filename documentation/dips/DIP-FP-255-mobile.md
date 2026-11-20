### DIP — FP-255 (Mobile): keep the login session in the secure keychain, without logging anyone out

### Not covered — deliberately excluded
- **The web half** (removal clears gender, marital status and the login link): `DIP-FP-255-web`. It is independent, so the two can run in parallel.
- **Other AsyncStorage data:** reminder settings and the "last checked" timestamps are not sensitive and stay in AsyncStorage.
- **The throwaway password-check client** (`verifyPassword`, FP-258 adj-1): it stores nothing, so it is unchanged.
- **Any native change:** `expo-secure-store` is already installed and in the `app.json` plugins, so this ships over the air. Confirm.

### Story Summary
The phone keeps the Supabase login session (access and refresh tokens) in **AsyncStorage**, which is not encrypted. Only the Face ID flag uses SecureStore (the iOS Keychain or Android Keystore). On a rooted or jailbroken phone, or through some backups, the session could be read.

This DIP gives the Supabase client a **SecureStore-backed storage adapter**, with chunking because SecureStore has a per-item size limit. The first time the app reads the session after the update, it **moves** the existing session from AsyncStorage into SecureStore, so nobody is logged out. Source: FP-248 data inventory, 2026-11-18.

### Repo Target
Mobile (`owgc-tech/flockpulse-mobile`), JavaScript only, shipped over the air. No server dependency.

### Grounding Check
**Verified by Atlas this session** (`origin/dev` at `793c10d`):
- **`package.json`:** `expo` 57, `expo-secure-store` `~57.0.1`, `@react-native-async-storage/async-storage` `^2.2.0`. **`app.json` plugins** include `expo-secure-store`.
- **`src/lib/supabase.ts`:** `createClient(url, anonKey, { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })`, with no `storageKey`, so the default `sb-<project-ref>-auth-token`. An AppState listener starts and stops auto-refresh.
- **`src/features/auth/services/biometricTrust.service.ts`:** already uses SecureStore. Its comment says SecureStore keys allow only letters, digits, `.`, `-` and `_`.
- **`src/features/auth/services/auth.service.ts` `forceLocalSignOut()`** (around lines 147–168): on a failed sign-out, it **wipes the session directly from AsyncStorage**, matching keys against `/^sb-.+-auth-token(-user|-code-verifier)?$/`. **This must also wipe the SecureStore copy after this change,** or a "forced" sign-out would leave the session in the keychain.
- **Other AsyncStorage users** (reminder settings, confirmation reminders): not the session. They stay as they are.

**Re-verify all of the above first.** Also:
1. Find every other place that reads or writes the session key or the AsyncStorage session directly. Grep for `auth-token`, `getAllKeys` and `multiRemove`.
2. Confirm the SecureStore size guidance for SDK 57: values larger than about 2048 bytes trigger a warning or failure. A Supabase session JSON is usually larger, so chunking is needed.
3. Confirm the default storage key's characters are valid SecureStore keys. If not, map them in the adapter.
4. Pick the `keychainAccessible` option: `AFTER_FIRST_UNLOCK` lets a backgrounded refresh read the session. Explain the choice in the PR.

**Rules check:**
- Nothing printed or logged contains tokens.
- If SecureStore fails, the app must not lose the user's session silently. Use a safe fallback (see step 2), and make sure the app never crashes on startup.
- No server change.

### Implementation Plan
1. **Bootstrap.** Save this DIP verbatim to `documentation/dips/DIP-FP-255-mobile.md`. Create `feature/FP-255-secure-session` off current `dev`. Report the four grounding answers.

2. **Adapter** `src/lib/secureSessionStorage.ts`. It implements Supabase's storage interface: async `getItem`, `setItem` and `removeItem`.
   - **Chunked writes:** split the value into pieces of at most about 1800 characters. Write `<key>.0 … <key>.(n-1)` plus a count `<key>.n`. Delete any leftover chunks from a longer previous value. Map the key to valid characters if needed.
   - **`getItem(key)`:**
     - read the count and the chunks, and join them;
     - if a chunk is missing, treat it as no session, clean up the partial chunks, and return null;
     - **migration:** if SecureStore has nothing, read `AsyncStorage.getItem(key)`. If it is found, write it to SecureStore. Only after that write succeeds, remove it from AsyncStorage. Return it.
   - **`setItem`:** write to SecureStore, then remove any AsyncStorage copy of the same key.
   - **`removeItem`:** delete every chunk and the count, and remove the AsyncStorage copy.
   - **If SecureStore is unavailable or throws:** fall back to AsyncStorage for that call, so the user is not logged out or stuck. Never throw out of `getItem` at startup.
   - Use the same `keychainAccessible` setting for every call.
   - Keep the pure parts (chunk split and join, key mapping) in exported functions so they can be tested.

3. **`src/lib/supabase.ts`:** replace `storage: AsyncStorage` with the new adapter. Change nothing else.

4. **`forceLocalSignOut()`:** after the AsyncStorage wipe, also remove the session from SecureStore. Use the adapter's `removeItem` for each matching base key (`sb-<ref>-auth-token`, `-user`, `-code-verifier`). Keep the rest of the function unchanged.

5. **Test script** `scripts/test-fp255-secure-session.ts`, run with `npx tsx`, with in-memory mocks of SecureStore and AsyncStorage:
   - split and join round-trip for 0, 1, 1800, 1801 and 10 000 characters;
   - migration: a value only in AsyncStorage is returned, copied to SecureStore and removed from AsyncStorage. A second `getItem` reads it from SecureStore only;
   - if the SecureStore write fails during migration, the AsyncStorage copy is **kept**;
   - `setItem` with a shorter value deletes the leftover chunks;
   - `removeItem` deletes everything, both stores;
   - a missing middle chunk gives null and cleans up;
   - if SecureStore throws on read, the adapter falls back and does not throw;
   - `forceLocalSignOut`'s wipe reaches the SecureStore chunks (grep or mock).

6. **Checks.** Run `npx tsc --noEmit`, the new script and the existing scripts. State plainly that nothing was checked on a device. `git diff dev --stat` lists only the expected files.

7. **Commit, push, and open the PR** with `gh pr create --base dev`.

### Files to Create/Modify
- **Create:**
  - `documentation/dips/DIP-FP-255-mobile.md` (verbatim, then frozen);
  - `src/lib/secureSessionStorage.ts`;
  - `scripts/test-fp255-secure-session.ts`.
- **Modify:**
  - `src/lib/supabase.ts` (the `storage` line only);
  - `src/features/auth/services/auth.service.ts` (`forceLocalSignOut` only).
- **Must stay untouched:** `verifyPassword`, `biometricTrust.service.ts`, `app/(app)/_layout.tsx`, the reminder services, `app.json`, `eas.json`.

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-255-secure-session

### Commit Message
FP-255: keep the login session in the secure keychain and move existing sessions there

### Pull Request Description
Plain GitHub markdown. Include:
- how the move from AsyncStorage works, and why nobody is logged out;
- the chunk size and `keychainAccessible` choices;
- the fallback behavior;
- the `forceLocalSignOut` change;
- the script output;
- deviations from this DIP.

**Not tested:** any device, iOS or Android keychain behavior, phone backups.

**Steps for Joseph:**
1. Merge into `dev`.
2. Run `deploy-ios.bat "FP-255 secure session"` and `deploy-android.bat "FP-255 secure session"`.
3. On **each** test phone, **without logging out first**: check the update ID, then force-quit and reopen twice.
   - Expected: **you stay signed in.** This proves the move worked.
4. Kill the app and reopen it. You should still be signed in.
5. Leave the phone for a while (or overnight), then open the app: still signed in, and data loads (refresh works).
6. Log out, then log back in. Both should work.
7. If you use Face ID or fingerprint unlock: it still works after reopening.
8. If **any** phone is unexpectedly logged out after the update, tell Atlas before logging in again.

### Jira Linkage
- PDEEpicID: FP-170
- PDEStoryID: FP-255

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-255-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Branch off current dev and open the PR with gh pr create --base dev; quote the base in your report and do NOT stack it on any other branch. Do not apply any migration to a remote database and do not merge: Joseph applies migrations after review, tests, and merges manually.

Include full diffs for every file in your completion report per Section 5, rule 13, not a summary.
