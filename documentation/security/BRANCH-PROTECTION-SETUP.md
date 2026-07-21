# Branch Protection Setup — flockpulse-mobile

This repo's CI is defined in `.github/workflows/ci.yml` ("Code Quality") and
`.github/workflows/codeql.yml` ("CodeQL"). Neither of these enforces
anything on its own — a workflow only blocks a merge once it's named as a
**required status check** on a protected branch, which has to be configured
separately (branch protection settings are not stored as repo files, so they
can't ship as a commit).

This doc is instructions only. Nothing here has been run — these commands
are for Joseph to execute after reviewing.

The required status check produced by `ci.yml` is the job name, **`Typecheck`**
(from the `Code Quality` workflow). Confirm the exact name in the repo's
**Settings → Branches** check picker after the workflow has run at least once
on a PR — GitHub only offers checks that have reported at least one run.

## Option A — GitHub UI

For each of `dev` and `main`:

1. Go to **Settings → Branches** in `owgc-tech/flockpulse-mobile`.
2. Under **Branch protection rules**, click **Add rule** (or edit the
   existing rule) for the branch.
3. Enable:
   - **Require a pull request before merging**
     - Require approvals: at least 1
   - **Require status checks to pass before merging**
     - Search for and select `Typecheck`
     - Require branches to be up to date before merging
   - **Do not allow bypassing the above settings** (or restrict who can
     bypass, if admins should retain an escape hatch)
   - **Block force pushes**
   - **Restrict deletions**
4. Save changes.

## Option B — `gh api` commands

Requires `gh auth login` with admin access on the repo.

```bash
REPO="owgc-tech/flockpulse-mobile"

for BRANCH in dev main; do
  gh api \
    --method PUT \
    -H "Accept: application/vnd.github+json" \
    "repos/${REPO}/branches/${BRANCH}/protection" \
    -f "required_status_checks[strict]=true" \
    -f "required_status_checks[contexts][]=Typecheck" \
    -f "enforce_admins=true" \
    -f "required_pull_request_reviews[required_approving_review_count]=1" \
    -f "required_pull_request_reviews[dismiss_stale_reviews]=true" \
    -F "restrictions=null" \
    -f "allow_force_pushes=false" \
    -f "allow_deletions=false"
done
```

Notes:
- `enforce_admins=true` means even repo admins must go through the PR/status
  check flow. Set to `false` (or drop the flag and adjust the rule
  afterwards) if Joseph wants an admin override path.
- If the `Typecheck` context isn't recognized yet, run a PR through
  `Code Quality` first so GitHub has a check run to reference, then re-run
  the command.
- `restrictions=null` means no push restrictions beyond the checks above;
  set it to a list of allowed actors/teams instead if pushes to the branch
  should be limited to specific people.

## Secret scanning + push protection

Free on public repos, but toggled in the UI, not via branch protection API:

1. **Settings → Code security and analysis**
2. Enable **Secret scanning**
3. Enable **Push protection**

This step is not covered by the commands above — it's a one-time UI toggle.
