Story Summary
Add CodeQL code scanning, Dependabot, and branch protection to flockpulse-mobile. This repo is public, so CodeQL and secret scanning are free GitHub features — this DIP just enables them, no paid tier needed. Companion DIP DIP-FP-160-web.md covers the same scope for flockpulse-web as a separate PR in that repo.
Repo Target
Mobile (owgc-tech/flockpulse-mobile)
Grounding Check
Confirmed FP-160's Jira description live (Story, parent FP-5, status To Do). Rationale: branch protection requiring PR-based merges directly addresses the standing, previously-flagged risk of direct-to-dev commits recurring in this project's history. No schema/domain-rule concerns — this is pure repo tooling, not application code. Before implementing, check .github/workflows/ for any existing CI config in this repo and report what's found — do not assume a clean slate. Also check package.json for this repo's actual lint/typecheck scripts before writing the CI workflow — do not assume they match flockpulse-web's script names.
Implementation Plan

Check .github/workflows/ for existing CI config; report findings before proceeding.
Create .github/workflows/codeql.yml using github/codeql-action for JavaScript/TypeScript, triggered on PRs to dev/main and on a weekly schedule.
Create .github/workflows/ci.yml (Code Quality): npm ci, then this repo's actual lint and typecheck commands (confirm exact script names from package.json first), on every PR — this is the required status check branch protection will gate on.
Create .github/dependabot.yml: npm ecosystem, weekly schedule, both dev and main as target branches.
Enable secret scanning + push protection via repo settings (Settings → Code security and analysis) — free on public repos. Note in the PR description that this specific step still needs a human click in GitHub's UI; it isn't committable config.
Write documentation/security/BRANCH-PROTECTION-SETUP.md containing the exact gh api commands (or step-by-step UI instructions) to protect dev and main: require PR review before merge, require the Code Quality check to pass, disallow direct pushes/force-pushes. Do not execute these commands yourself — they're for Joseph to run after reviewing.
Confirm npx tsc --noEmit -p . (or this repo's equivalent typecheck command) runs cleanly before opening the PR.

Files to Create/Modify

.github/workflows/codeql.yml
.github/workflows/ci.yml
.github/dependabot.yml
documentation/security/BRANCH-PROTECTION-SETUP.md

Migration Files
None.
Branch Name
feature/FP-160-mobile-ci-security-tooling
Commit Message
FP-160: add CodeQL, Dependabot, and branch protection setup guide (mobile)
Pull Request Description
Map to FP-160's scope items for mobile specifically: Code Quality workflow (naming the actual lint/typecheck commands used), Dependabot config, secret scanning enablement noted as a manual UI step, branch protection commands documented but not executed.
Jira Linkage

PDEEpicID: FP-5
PDEStoryID: FP-160

Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-160-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not run the branch protection commands from step 6 — those are for Joseph to execute himself after review. Do not merge.
