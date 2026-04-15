---
name: coding-setup
description: "Configure a coding archetype team — set up PR workflow, branch strategy, and playbook steps. Triggers on: configure coding team, coding setup, set up coding team, configure PR workflow."
version: 0.1.0
---

# Coding Setup Wizard

You are configuring a **coding archetype** team. This skill runs after team onboarding has selected the coding archetype and completed the mechanical workspace setup. Core federation config (description, MCP stack, telemetry) is in `federate.config.json` — don't touch it. Your job is to collect archetype-specific settings and write them to the team's `.squad/archetype-config.json`.

## Triggers

- "configure coding team"
- "coding setup"
- "set up coding team"
- "configure PR workflow"
- "coding archetype config"

## When This Runs

This skill is a **handoff target** from the **team-onboarding skill**. The onboarding flow:

1. Asks about the team's mission
2. Discovers and selects the coding archetype
3. Installs the archetype plugin if needed
4. Runs onboard.ts to create the workspace and seed archetype templates
5. Hands off to this skill for archetype-specific configuration questions

You can also be invoked directly if a user wants to reconfigure an existing coding team.

## Prerequisites

Before asking questions, verify:

```bash
test -f federate.config.json
```

If missing:

> "No federation config found. Run the federation setup first — say **'set up federation'** to start."

Check for an existing archetype config:

```bash
test -f .squad/archetype-config.json
```

If it exists, load it and show the current settings:

> "I found existing coding settings:
> - **PR target branch**: `main`
> - **Steps**: design → implement → test → pr
> - **Code conventions**: none
> - **Test requirements**: yes, `npm test`
>
> Want to update these or start fresh?"

If starting fresh or no config exists, proceed with the questions below.

---

## Step 1: PR Target Branch

Ask:

> "What branch should teams target when opening pull requests?
>
> Default: `main`"

Accept any valid git branch name. If the user says "default" or skips, use `main`.

Validate:
- Must be a valid git ref name (no spaces, no `..`, no trailing `.lock`, etc.).
- Check if the branch exists in the current repo:

```bash
git rev-parse --verify refs/heads/<branch> 2>/dev/null
```

If it doesn't exist, warn: "Branch `<name>` doesn't exist in this repo yet. That's fine if you plan to create it later — just confirming."

Store as `prTargetBranch`.

## Step 2: Playbook Steps

Ask:

> "What workflow steps should teams follow when implementing their tasks?
>
> Default workflow:
> 1. **design** — Understand requirements, plan the approach
> 2. **implement** — Write clean, well-structured code
> 3. **test** — Write and run automated tests
> 4. **pr** — Open a pull request with a clear description
>
> You can:
> - **Accept the defaults** (just say 'yes' or 'default')
> - **Add steps** (e.g., 'add a code-review step before PR')
> - **Remove steps** (e.g., 'skip the design step for hotfixes')
> - **Reorder steps** (e.g., 'test before implement for TDD')
> - **Provide a completely custom list**"

Parse the user's response:
- "yes", "default", "looks good", "fine" → use defaults
- Modifications → apply them to the default list
- Custom list → use as-is, but confirm if it doesn't end with a delivery step: "Your workflow doesn't end with a PR or delivery step. Teams need a way to ship their work — want to add one?"

Store as `playbookSteps` — an ordered array of step objects.

Each step object has:
```json
{
  "name": "design",
  "description": "Understand requirements, plan the approach"
}
```

If the user provides custom steps without descriptions, generate brief descriptions based on the step name. Show them for confirmation.

## Step 3: Code Conventions

Ask:

> "Are there coding standards or linting configs that teams should follow?
>
> This helps teams match your project's style from the start. You can provide:
> - **Path to a config file** (e.g., `.eslintrc.json`, `pyproject.toml`, `.editorconfig`)
> - **Path to a style guide document** (e.g., `docs/CODING_STANDARDS.md`)
> - **skip** — teams will infer conventions from the existing codebase
>
> You can provide multiple paths, separated by commas."

If the user provides paths:
- For each path, check if the file exists. Warn about missing ones but don't block.
- Store as `codeConventions` — an array of paths.

If the user skips:
- Set `codeConventions` to `[]`.
- Note: "Teams will look for common convention files (`.editorconfig`, linter configs, etc.) automatically and follow existing patterns in the codebase."

## Step 4: Test Requirements

Ask:

> "Should teams run tests before opening pull requests?
>
> Options:
> - **yes** — teams must run tests and all must pass before opening a PR
> - **no** — teams open PRs without running tests (CI will catch issues)
>
> If yes, what command should teams use to run tests?
> (e.g., `npm test`, `pytest`, `go test ./...`, `make test`)"

If yes:
- Store `testRequired: true` and `testCommand` as the provided command.
- If no command provided, try to auto-detect:

```bash
# Check for common test configurations
test -f package.json && grep -q '"test"' package.json && echo "npm test"
test -f Makefile && grep -q '^test:' Makefile && echo "make test"
test -f pyproject.toml && echo "pytest"
test -f Cargo.toml && echo "cargo test"
test -f go.mod && echo "go test ./..."
```

If auto-detected, confirm: "I found `npm test` in your package.json. Use that?"

If nothing detected and no command given: "I couldn't auto-detect a test command. What should teams run?"

If no:
- Store `testRequired: false` and `testCommand: null`.
- Note: "Teams will still write tests as part of their workflow, but won't gate PRs on test results."

## Step 5: Summary and Confirm

Show the complete configuration:

> "Here's your coding archetype configuration:
>
> | Setting | Value |
> |---------|-------|
> | **PR target branch** | `main` |
> | **Playbook steps** | design → implement → test → pr |
> | **Code conventions** | `.eslintrc.json`, `docs/CODING_STANDARDS.md` |
> | **Test required** | yes, `npm test` |
>
> This will be written to `.squad/archetype-config.json` in each team's worktree.
>
> **Confirm?** (yes / edit [setting name] / start over)"

Handle responses:
- "yes", "confirm", "looks good" → write the config
- "edit X" → go back to that specific step
- "start over" → restart from Step 1

---

## Write Config

Create `.squad/archetype-config.json`:

```json
{
  "archetype": "coding",
  "version": "0.1.0",
  "prTargetBranch": "main",
  "playbookSteps": [
    { "name": "design", "description": "Understand requirements, plan the approach" },
    { "name": "implement", "description": "Write clean, well-structured code" },
    { "name": "test", "description": "Write and run automated tests" },
    { "name": "pr", "description": "Open a pull request with a clear description" }
  ],
  "codeConventions": [],
  "testRequired": true,
  "testCommand": "npm test",
  "configuredAt": "<ISO-8601>"
}
```

Ensure `.squad/` directory exists first:

```bash
mkdir -p .squad
```

After writing, confirm:

> "Coding archetype configured. Teams onboarded with this archetype will use these settings.
>
> **Next steps:**
> - Say **'spin up a team for X'** to onboard your first coding team
> - The team's workflow will follow the steps you defined
> - If you provided convention files, make sure they exist before the first team runs
> - To change these settings later, say **'configure coding team'** again"

---

## What This Skill Does NOT Do

- **Core federation config** — that's `federation-setup`
- **Team casting or composition** — Squad handles that
- **PR review coordination** — that's the `pr-review-coordination` skill
- **Running the playbook** — that's the `coding-playbook` skill
- **Task assignment** — that's the `task-assignment` skill
- **Onboarding teams** — that's the team-onboarding skill

If the user asks about these during setup, redirect:

- "How many developers per team?" → "Squad's casting decides when you onboard. Just say 'spin up a team for X'."
- "How do PR reviews work?" → "Check the pr-review-coordination skill after setup."
- "Can I change the workflow later?" → "Yes — edit `.squad/archetype-config.json` or run this setup again."

---

## Error Handling

- **Permission denied writing config**: Check directory permissions. Suggest `mkdir -p .squad` if the directory doesn't exist.
- **Invalid JSON in existing config**: Warn the user, offer to back up the broken file and start fresh.
- **Branch validation fails**: Git not initialized, or `.git` not found. Warn but don't block — the user may be setting up before `git init`.
- **Test command doesn't work**: Don't validate by running it — just store it. Teams will discover failures at runtime.
- **User provides conflicting settings**: Ask for clarification. Don't guess.
- **Ctrl+C / abort**: No partial config is written. The user can restart cleanly.
