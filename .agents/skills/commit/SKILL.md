---
name: commit
description: Create or reword BasisDB commits and validate them with the repository's commitlint rules before committing or pushing.
---

# Commit

Read `commitlint.config.js` before choosing a scope. Its `scope-enum` rule is
the source of truth. Do not invent a scope or widen the rule for one message.
Use a scope even though CI currently treats an empty scope as a warning.

Use a Conventional Commit subject under 72 characters, for example:

    fix(node): preserve proposal identity
    docs(core): simplify the readme
    chore(ci): pin the audit tool

Inspect `git status -sb`, `git diff`, and `git diff --staged`. Stage explicit
files or hunks for one coherent change. Preserve unrelated working changes.

Install the validator locally when it is missing:

    npm install --prefix "$(git rev-parse --show-toplevel)" --no-save --package-lock=false @commitlint/cli @commitlint/config-conventional

Validate the exact message before committing:

    printf '%s\n' 'fix(node): preserve proposal identity' | .agents/skills/commit/scripts/check.sh

Run the relevant tests, commit, then check that the staged area is empty.
Before an authorized push, validate every commit in the PR range:

    .agents/skills/commit/scripts/check.sh --from origin/main --to HEAD

Use the PR's actual base if it differs from `main`. Repair an invalid message
on the affected commit; adding a later commit does not fix the range. Preserve
the changes and rerun the validator after rewording. This skill does not grant
permission to push.
