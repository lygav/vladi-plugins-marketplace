---
name: "federation-orchestration"
description: "The user wants to manage an EXISTING federation — launch teams, monitor progress, send directives, sync skills, or understand how the federation works. Only activates when federate.config.json already exists. Triggers on: launch team, monitor teams, send directive, sync skills, sweep learnings, how does federation work, federation architecture, manage my teams."
version: "0.1.0"
---

## Purpose

Guide the orchestration of a federated squad system where a **meta-squad** coordinates multiple **domain squads**, each running independently in isolated git worktrees. This skill covers architecture, lifecycle management, and the scripts that power the system.

## Architecture Overview

The federation model has two layers:

1. **Meta-squad (coordinator)** — runs on the `main` branch. Owns the federation config, launches domain squads, monitors progress, aggregates results, and manages knowledge flows.
2. **Domain squads (experts)** — each runs on its own `scan/{domain}` branch in a dedicated git worktree. Domain squads are autonomous: they execute a playbook, produce a deliverable, and communicate via the signal protocol.

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

Creates the full infrastructure for a new domain expert squad.

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/onboard.ts \
  --name "payments" \
  --domain-id "pay-001" \
  --team-size 5 \
  --roles "lead,data-engineer,data-engineer,sre,research-analyst" \
  --agents "Agent Alpha,Agent Beta,Agent Gamma,Agent Delta,Agent Epsilon"
```

What it does:
1. Creates the `scan/{name}` branch from the current HEAD
2. Sets up a persistent git worktree at `../worktrees/{name}`
3. Seeds template files into the worktree
4. Generates `squad.config.ts` using the Squad SDK builders
5. Runs `squad build` to produce `.squad/` artifacts (charters, histories, skills)
6. Cleans meta-squad files out of the domain branch (prevents cross-contamination)
7. Makes the initial commit on the domain branch

Use `--base-branch` to specify a different starting point (defaults to current branch).

### launch.ts — Start Domain Squad Sessions

Launches headless Copilot sessions in domain worktrees.

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/launch.ts --team payments
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/launch.ts --all
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/launch.ts --team payments --step distillation
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/launch.ts --team payments --reset
```

Modes:
- **First scan** (no flags): starts from the beginning of the playbook. Initializes signals, sets state to `initializing`.
- **Step targeting** (`--step <name>`): resumes or jumps to a specific playbook step. Useful when a domain squad stalled or needs to redo a phase.
- **Reset** (`--reset`): wipes the deliverable and signals, restarts from scratch. Use when a domain's data is stale or fundamentally wrong.
- **All** (`--all`): launches every onboarded domain in parallel. Each gets its own detached session.

The launch script reads `federate.config.json` from the repo root for settings: deliverable filename, MCP stack, playbook steps, telemetry toggle. It also checks schema freshness — if the deliverable schema on main has changed since the domain's last run, it flags it in the launch prompt.

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
- Branch naming is strict: `scan/{domain-name}`. The prefix is configurable via `branchPrefix` in `federate.config.json`.
- Worktrees persist across sessions. `git worktree list` shows all active worktrees.
- To remove a domain: `git worktree remove ../worktrees/{domain}` then `git branch -D scan/{domain}`.

## Branch Naming Convention

```
scan/{domain-name}
```

Examples: `scan/payments`, `scan/auth-service`, `scan/data-pipeline`.

The `scan/` prefix is the default and is configurable. All federation scripts use this prefix to discover domain branches. Keep domain names lowercase, hyphenated, and descriptive.

## Task Lifecycle

A domain squad progresses through configurable playbook steps. Each team follows its archetype's playbook. See the archetype's skill for lifecycle steps and completion criteria.

Steps are fully configurable via `federate.config.json`. The domain squad's Copilot session receives a prompt for the current step, executes it, updates status, and advances.

## When to Use Each Script

| Goal | Script | Example |
|------|--------|---------|
| Add a new domain to the federation | `onboard.ts` | First time setting up "payments" domain |
| Start or restart a domain's work | `launch.ts` | Kick off scanning after onboarding |
| Check on all domains | `monitor.ts` | See which domains are done, stalled, or failed |
| Steer a running domain | `monitor.ts --send` | Tell a domain to skip a repository |
| Collect finished work | archetype-specific | Aggregation is archetype-specific. Deliverable archetypes provide aggregate tooling. |
| Resume a specific phase | `launch.ts --step` | Re-run validation after fixing a data issue |
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
  "deliverable": "deliverable.json",
  "deliverableSchema": "schemas/deliverable.schema.json",
  "mcpStack": ["filesystem", "otel"],
  "playbookSkill": "domain-playbook",
  "steps": ["discovery", "analysis", "deep-dives", "validation", "documentation", "distillation"],
  "branchPrefix": "scan/",
  "telemetry": { "enabled": true }
}
```

If the file does not exist, defaults are used. Environment variables (`FEDERATE_DELIVERABLE`, `FEDERATE_BRANCH_PREFIX`, `FEDERATE_IMPORT_HOOK`) can override specific fields.

## Orchestration Checklist

When orchestrating a federation run end-to-end:

1. Ensure `federate.config.json` exists and is configured (or use the `federation-setup` skill)
2. Onboard each domain: run `onboard.ts` per domain
3. Launch all domains: run `launch.ts --all`
4. Monitor progress: run `monitor.ts --watch`
5. Send directives as needed: run `monitor.ts --send {domain} --directive "..."`
6. Wait for domains to reach `complete` state
7. Aggregate (if applicable): aggregation is archetype-specific. Deliverable archetypes provide aggregate tooling.
8. Sweep learnings: run `sweep-learnings.ts` to find cross-domain patterns
9. Graduate learnings: run `graduate-learning.ts` for reusable knowledge

## Refresh vs Reset

When a domain needs to re-run, choose the right mode:

**Refresh** (`launch.ts --step {step}`): picks up from a specific step. Preserves all earlier work — signals, learnings, partial deliverables. Use when:
- A step failed and you fixed the root cause
- The meta-squad sent a directive that changes later steps
- Schema changed on main and you need to re-distill

**Reset** (`launch.ts --reset`): wipes the deliverable, clears signals, and restarts from scratch. Use when:
- The domain's data sources fundamentally changed
- A bad directive corrupted the analysis
- The worktree is in an unknown state and you need a clean start

Never reset when a refresh would suffice — resets discard learnings and signal history.

## Error Handling

- If a domain enters `failed` state, check its status.json `error` field for details.
- Use `launch.ts --step {last-good-step}` to retry from a known good state.
- Use `launch.ts --reset` only as a last resort — it discards all domain progress.
- If a worktree is corrupted, remove and re-onboard: `git worktree remove` → `onboard.ts`.
- Stale domains (no status update for >30 minutes during a scan) likely indicate a hung session. Kill the process and re-launch with `--step`.
- If the aggregation step reports a missing deliverable for a domain that shows `complete`, the deliverable filename may be misconfigured. Check `federate.config.json` matches what the domain actually wrote.
