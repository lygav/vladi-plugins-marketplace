---
name: "federation-orchestration"
description: "The user wants to manage an EXISTING federation — launch teams, monitor progress, send directives, sync skills, retire/pause/resume teams, or understand how the federation works. Only activates when federate.config.json already exists. Triggers on: launch team, monitor teams, send directive, sync skills, sweep learnings, how does federation work, federation architecture, manage my teams, retire team, pause team, resume team, decommission team, shut down team, suspend team, reactivate team."
version: "0.1.0"
---

## Prerequisites

**Before using this skill, check that `federate.config.json` exists in the project root.** If it does not exist, federation is not set up. Redirect the user to the federation-setup skill: *"Federation isn't configured yet. Let me run the setup wizard first."*

### Bootstrap (run first)

Before running any scripts, ensure the plugin environment is ready:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/bootstrap.mjs
```

## Purpose

Guide the orchestration of a federated squad system where a **meta-squad** coordinates multiple **domain squads**, each running independently in isolated git worktrees. This skill covers architecture, lifecycle management, and the scripts that power the system.

## Critical: Delegation Model

The meta-squad is a **leadership team**. When a user asks the meta-squad to get work done (e.g., *"get team tetris-game to start working on their game"*, *"tell the payments team to implement Stripe"*), the meta-squad MUST:

1. **Launch the domain team** as a federated team via `launch.ts` — they run in their own worktree as an independent squad
2. **Send directives** via the signal protocol to instruct the team
3. **Monitor progress** via status signals and OTel

The meta-squad MUST NOT:
- Do the work itself (no coding, no direct deliverables)
- Spawn squad agents directly to do the domain team's job
- Bypass the federation model by treating domain work as meta-squad tasks

**Rule:** Every request to "do work" gets delegated to the appropriate domain team. If that team doesn't exist yet, onboard it first. The meta-squad's output is instructions, feedback, and coordination — never the work product itself.

## Architecture Overview

The federation model has two layers:

1. **Meta-squad (coordinator)** — runs on the `main` branch. Owns the federation config, launches domain squads, monitors progress, and manages knowledge flows.
2. **Domain squads (experts)** — each runs on its own `scan/{domain}` branch in a dedicated git worktree. Domain squads are autonomous: they execute a playbook, produce outputs, and communicate via the signal protocol.

```
main (meta-squad)
├── scan/payments       ← worktree: ../worktrees/payments
├── scan/auth-service   ← worktree: ../worktrees/auth-service
├── scan/data-pipeline  ← worktree: ../worktrees/data-pipeline
└── scan/api-gateway    ← worktree: ../worktrees/api-gateway
```

Each domain worktree contains its own `.squad/` directory with agent charters, histories, skills, signals, and learnings. The meta-squad never directly modifies domain worktrees — all cross-boundary communication flows through the signal protocol (see the `inter-squad-signals` skill).

## Core Scripts

All scripts live at `${CLAUDE_PLUGIN_ROOT}/scripts/` and are invoked via `npx tsx`.

### onboard.ts — Create a New Domain Squad

Creates the full infrastructure for a new domain expert squad. **Archetype selection happens during the conversational onboarding flow** (see team-onboarding skill), not as a command-line parameter.

**IMPORTANT:** This script is designed for AUTONOMOUS execution — it accepts all parameters via CLI flags and runs without user interaction. Do NOT call this script directly from conversational flows. Instead, use the `team-onboarding` skill, which handles the conversational phase (mission, archetype discovery, transport selection) and then calls this script with fully resolved parameters.

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/onboard.ts \
  --name "payments" \
  --domain-id "payments" \
  --archetype "squad-archetype-deliverable" \
  --transport "worktree" \
  --description "Audit the payments API for security issues"
```

The **team-onboarding skill** handles the conversational part:
1. Asks: "What should this team work on?"
2. Asks guiding questions: "Will they write code or produce artifacts?"
3. Discovers and recommends an archetype based on the mission
4. Installs the archetype plugin if needed
5. Selects transport (worktree/directory)
6. Calls onboard.ts with the discovered parameters
7. Runs the archetype's setup skill for team-specific configuration

The **onboard.ts script** handles the mechanical part:
1. Creates the `squad/{name}` branch from the current HEAD (or `--base-branch`)
2. Sets up a persistent git worktree (or directory workspace based on transport)
3. Seeds the archetype's team/ directory into the workspace
4. Generates initial team configuration
5. Makes the initial commit on the team branch
6. Reports completion status

**Key design principle:** Archetype is a team property, chosen during onboarding. Each team can use a different archetype within the same federation.

**When to use directly:**
- Scripted/automated team creation with all parameters known upfront
- CI/CD pipelines
- Batch team provisioning

**When to use via skill:**
- Interactive onboarding where user needs to choose archetype and transport
- First-time team creation where guidance is needed
- Any conversational context → use `team-onboarding` skill instead

### launch.ts — Start Domain Squad Sessions

Launches headless Copilot sessions in domain worktrees.

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/launch.ts --team payments
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/launch.ts --all
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/launch.ts --team payments --step distillation
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/launch.ts --team payments --reset
```

Modes:
- **First scan** (no flags): starts from the beginning of the playbook. Initializes signals, sets state to `preparing`.
- **Step targeting** (`--step <name>`): resumes or jumps to a specific playbook step. Useful when a domain squad stalled or needs to redo a phase.
- **Reset** (`--reset`): wipes outputs and signals, restarts from scratch. Use when a domain's data is stale or fundamentally wrong.
- **All** (`--all`): launches every onboarded domain in parallel. Each gets its own detached session.

The launch script reads `federate.config.json` from the repo root for settings: playbook skill, telemetry toggle. MCP servers are inherited from project `.mcp.json`. Archetype plugins may add additional configuration checks based on their requirements.

### monitor.ts — Observe Domain Progress

Dashboard and directive sender for the meta-squad.

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/monitor.ts
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/monitor.ts --watch --interval 30
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/monitor.ts --send payments --directive "Skip legacy-utils repo"
```

Monitor reads each domain's `.squad/signals/status.json` and renders a summary table with state emojis, current step, progress percentage, and staleness (minutes since last update). Watch mode re-polls at the configured interval.

The `--send` flag writes a directive message to a domain's inbox. This is how the meta-squad steers domain squads without stopping them.

## Worktree Mechanics

Git worktrees are the isolation mechanism. Each domain gets a separate working directory with its own branch checked out.

Key rules:
- Worktrees live at `../worktrees/{domain}` relative to the repo root (one level up, in a `worktrees` directory). This keeps them outside the main repo tree.
- Never `cd` into a worktree and run git commands that affect the main repo. Each worktree has independent staging.
- Branch naming follows the pattern: `squad/{team-name}` (e.g., `squad/team-alpha`).
- Worktrees persist across sessions. `git worktree list` shows all active worktrees.
- To remove a domain: `git worktree remove ../worktrees/{domain}` then `git branch -D scan/{domain}`.

## Branch Naming Convention

```
scan/{domain-name}
```

Examples: `scan/payments`, `scan/auth-service`, `scan/data-pipeline`.

The `scan/` prefix is the default and is configurable. All federation scripts use this prefix to discover domain branches. Keep domain names lowercase, hyphenated, and descriptive.

## Task Lifecycle

A domain squad progresses through playbook steps defined by its archetype. The specific steps, their order, and completion criteria are managed by the archetype plugin (see your archetype's playbook skill for details).

The domain squad's Copilot session receives a prompt for the current step, executes it, updates status via the signal protocol, and advances.

## When to Use Each Script

| Goal | Script | Example |
|------|--------|---------|
| Add a new domain to the federation | `onboard.ts` | First time setting up "payments" domain |
| Start or restart a domain's work | `launch.ts` | Kick off work after onboarding |
| Check on all domains | `monitor.ts` | See which domains are done, stalled, or failed |
| Steer a running domain | `monitor.ts --send` | Tell a domain to skip a repository |
| Collect finished work | See archetype skill | Output collection is archetype-specific — check your archetype's playbook skill |
| Resume a specific phase | `launch.ts --step` | Re-run a step after fixing an issue |
| Start fresh | `launch.ts --reset` | Domain data is outdated, start over |

## Signal Protocol Overview

Domain squads and the meta-squad communicate through files, not shared memory:

- **status.json** — domain writes its current state (step, progress, errors)
- **inbox/** — meta-squad writes directives here; domain reads and acknowledges
- **outbox/** — domain writes reports, questions, and alerts here; meta-squad reads

All signal files live under `.squad/signals/` in each domain worktree. See the `inter-squad-signals` skill for the full protocol specification.

## Federation Config

The `federate.config.json` file at the repo root controls federation behavior:

```json
{
  "description": "Inventory all Azure services across the organization",
  "telemetry": { "enabled": true }
}
```

Additional archetype-specific configuration may be present depending on which archetype plugin is installed. If the file does not exist, defaults are used. Environment variables (`FEDERATE_BRANCH_PREFIX`, `FEDERATE_PLAYBOOK_SKILL`) can override specific fields.

## Orchestration Checklist

When orchestrating a federation run end-to-end:

1. Ensure `federate.config.json` exists and is configured (or use the `federation-setup` skill)
2. Onboard each domain: run `onboard.ts` per domain
3. Launch all domains: run `launch.ts --all`
4. Monitor progress: run `monitor.ts --watch`
5. Send directives as needed: run `monitor.ts --send {domain} --directive "..."`
6. Wait for domains to reach `complete` state
7. Collect outputs (if applicable): see your archetype's playbook skill for output collection steps
8. Sweep learnings: run `sweep-learnings.ts` to find cross-domain patterns
9. Graduate learnings: run `graduate-learning.ts` for reusable knowledge

## Refresh vs Reset

When a domain needs to re-run, choose the right mode:

**Refresh** (`launch.ts --step {step}`): picks up from a specific step. Preserves all earlier work — signals, learnings, partial outputs. Use when:
- A step failed and you fixed the root cause
- The meta-squad sent a directive that changes later steps
- You need to re-run a specific phase

**Reset** (`launch.ts --reset`): wipes outputs, clears signals, and restarts from scratch. Use when:
- The domain's data sources fundamentally changed
- A bad directive corrupted the analysis
- The worktree is in an unknown state and you need a clean start

Never reset when a refresh would suffice — resets discard learnings and signal history.

## Error Handling

- If a domain enters `failed` state, check its status.json `error` field for details.
- Use `launch.ts --step {last-good-step}` to retry from a known good state.
- Use `launch.ts --reset` only as a last resort — it discards all domain progress.
- If a worktree is corrupted, remove and re-onboard: `git worktree remove` → `onboard.ts`.
- Stale domains (no status update for >30 minutes during a run) likely indicate a hung session. Kill the process and re-launch with `--step`.
- If output collection reports missing files, check the archetype's expected output configuration matches what the domain actually wrote.

## Team Lifecycle Management

### Retire a Team

Retiring permanently deactivates a team: graduates its learnings to the main log, archives signals, and removes the worktree (if applicable). This is irreversible.

When the user says **"retire the payments team"**, **"decommission payments"**, **"shut down the payments squad"**:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/bootstrap.mjs && npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/offboard.ts --team payments --mode retire --non-interactive --output-format json
```

Parse the JSON output and present:
- How many learnings were graduated to the main log
- How many signals were archived
- Whether the worktree was removed
- Final status confirmation

### Pause a Team

Pausing temporarily suspends a team. The workspace is preserved so work can resume later. Only active teams can be paused.

When the user says **"pause team alpha"**, **"suspend the alpha team"**, **"put alpha on hold"**:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/bootstrap.mjs && npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/offboard.ts --team alpha --mode pause --non-interactive --output-format json
```

Parse the JSON output and confirm the pause timestamp.

### Resume a Team

Resuming reactivates a paused team, returning it to active status. Only paused teams can be resumed.

When the user says **"resume team alpha"**, **"reactivate alpha"**, **"unpause the alpha team"**:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/bootstrap.mjs && npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/offboard.ts --team alpha --mode resume --non-interactive --output-format json
```

Parse the JSON output and confirm the team is active again.

### Force Mode

If the user says **"force retire"** or needs to bypass warnings:

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/offboard.ts --team payments --mode retire --force --non-interactive --output-format json
```

The `--force` flag skips confirmation prompts and warning checks.

## Heartbeat Management

The heartbeat is a background process that periodically spawns fresh copilot sessions to check team status, read signals, and post summaries. It's useful for long-running operations where the user steps away.

### Start heartbeat

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/bootstrap.mjs && npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/meta-heartbeat.ts
```

With a custom interval (in seconds):

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/meta-heartbeat.ts --interval 60
```

### Stop heartbeat

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/meta-heartbeat.ts --stop
```

### Check heartbeat status

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/meta-heartbeat.ts --status
```

### Single heartbeat run (testing)

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/meta-heartbeat.ts --once
```

### How it works

1. Discovers the copilot launch command from `COPILOT_LOADER_PID`
2. Every interval (default: 300s), spawns a fresh copilot session with a status-check prompt
3. The session reads team outboxes, status files, and posts summaries
4. If `teamsConfig` is set, the session posts to the configured Teams channel
5. Sessions have a timeout (120s) — if one hangs, it's killed automatically
6. Writes PID to `.squad/heartbeat.pid` for clean start/stop
7. Logs to console and `.squad/heartbeat.log`

When the user says "start heartbeat", "stop heartbeat", or "heartbeat status", run the corresponding command above.
