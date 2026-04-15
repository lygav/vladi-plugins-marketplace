---
title: Team Lifecycle
description: Guide to onboarding, running, pausing, and retiring federated teams
---

# Team Lifecycle

Every federated team follows a lifecycle from creation through active work to eventual retirement:

```
onboard → active → [pause ⇄ resume] → retire
```

## Status Reference

| Status | Can Launch | Workspace | Learnings | Transitions To |
|--------|-----------|-----------|-----------|---------------|
| active | Yes | Exists | Accumulating | paused, retired |
| paused | No | Preserved | Frozen | active (resume) |
| retired | No | Removed (worktree) | Graduated to main | _(terminal)_ |

## Onboard

Create a new team and register it in the federation:

```bash
npx tsx scripts/onboard.ts --name backend-api --archetype coding
```

The team starts in **active** status. See the [team onboarding guide](/vladi-plugins-marketplace/guides/team-onboarding) for the full interactive workflow.

## Launch (active only)

Start headless Copilot sessions for active teams. Paused and retired teams are automatically skipped:

```bash
npx tsx scripts/launch.ts --team backend-api
npx tsx scripts/launch.ts --all  # skips paused/retired
```

## Pause

Temporarily suspend a team. The workspace, learnings, and signals are preserved:

```bash
npx tsx scripts/offboard.ts --team backend-api --mode pause
```

**Via Copilot skill:** "Pause the backend-api team"

Use pause when:
- A team is blocked and waiting for external input
- You want to reduce resource usage temporarily
- Work needs to be deprioritized but not abandoned

## Resume

Reactivate a paused team, returning it to **active** status:

```bash
npx tsx scripts/offboard.ts --team backend-api --mode resume
```

**Via Copilot skill:** "Resume the backend-api team"

## Retire

Permanently decommission a team. This:
1. **Graduates learnings** — ungraduated entries from the team's `log.jsonl` are appended to the main `.squad/learnings/log.jsonl` with a `graduatedAt` timestamp
2. **Archives signals** — inbox and outbox signals are copied to `.squad/archived-signals/`
3. **Removes the worktree** (for worktree-based teams)
4. **Sets status to retired** — the team cannot be relaunched

```bash
npx tsx scripts/offboard.ts --team backend-api --mode retire
npx tsx scripts/offboard.ts --team backend-api --mode retire --force  # skip confirmation
```

**Via Copilot skill:** "Retire the backend-api team"

### Non-interactive mode (for CI/skills)

```bash
npx tsx scripts/offboard.ts --team backend-api --mode retire --non-interactive --output-format json
```

Returns structured JSON:
```json
{
  "success": true,
  "team": "backend-api",
  "mode": "retire",
  "message": "Team \"backend-api\" retired successfully",
  "details": {
    "learningsGraduated": 5,
    "learningsSkipped": 2,
    "graduatedIds": ["learn-1", "learn-2", "..."],
    "signalsArchived": 3,
    "statusUpdated": true,
    "worktreeRemoved": true
  }
}
```

## Knowledge Graduation

When a team is retired, its learning log entries are graduated to the federation's main log:

- **Ungraduated entries** are appended to `.squad/learnings/log.jsonl` at the repo root
- Each graduated entry gets `graduated: true`, `graduated_to: "main"`, and a `graduatedAt` timestamp
- **Already graduated entries** are skipped (no duplicates)
- Other learning files (`.json`, `.md`) are copied to the main learnings directory

This ensures knowledge isn't lost when teams are decommissioned.

## Guard Rails

The offboard script enforces these rules:
- Cannot **retire** a team that is already retired
- Cannot **pause** a team that is not active (e.g., already paused or retired)
- Cannot **resume** a team that is not paused
- Retired is a **terminal state** — no further transitions allowed
