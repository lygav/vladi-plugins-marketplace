---
title: Your First Federation
description: Step-by-step guide to creating and running your first federated team
---

# Your First Federation

This guide walks you through creating a minimal federation with one team, launching a headless session, and monitoring progress.

## Step 1: Initialize the Federation

Create a `federate.config.json` in your project root:

```bash
cat > federate.config.json << 'EOF'
{
  "description": "My first federation",
  "telemetry": {
    "enabled": true
  },
  "communicationType": "file-signal"
}
EOF
```

This enables file-based team communication and telemetry.

## Step 2: Onboard Your First Team

Use the `onboard.ts` script to create a team:

```bash
npx tsx path/to/squad-federation-core/scripts/onboard.ts \
  --name "frontend" \
  --domain-id "frontend-001" \
  --archetype "squad-archetype-coding" \
  --description "Builds and tests frontend components"
```

**What this does:**
1. Creates a git branch `squad/frontend` and worktree at `.worktrees/frontend/`
2. Seeds the team directory with archetype skills and configuration
3. Bootstraps `.squad/` structure for signals and learnings
4. Registers the team in `.squad/teams.json`
5. Runs `squad init` to cast the team agent

**Output:** You'll see confirmation that the team workspace was created.

## Step 3: Check the Team Registry

Verify the team was registered:

```bash
cat .squad/teams.json | jq
```

You should see an entry for `frontend` with its archetype, location, and metadata.

## Step 4: Inspect the Team Workspace

Navigate to the team worktree:

```bash
cd .worktrees/frontend
ls -la .squad/
```

You'll see:
- `status.json` - Team state (initially `"state": "initializing"`)
- `signals/inbox/` and `signals/outbox/` - Empty signal directories
- `learnings/log.jsonl` - Empty learning log
- Skills seeded from the archetype

## Step 5: Launch the Team

Start a headless session for the team:

```bash
npx tsx path/to/squad-federation-core/scripts/launch.ts --team frontend
```

**What happens:**
- Reads the team from the registry
- Creates a `TeamContext` with placement and communication adapters
- Detects run type (first-run, refresh, or reset)
- Writes OTel MCP config if telemetry is enabled
- Spawns: `copilot --yolo --no-ask-user --autopilot` with the team prompt

The team will:
1. Check its inbox for directives
2. Read `DOMAIN_CONTEXT.md` to understand its mission
3. Begin scanning the repository
4. Update `status.json` as it progresses
5. Write learnings to `log.jsonl`

## Step 6: Monitor Progress

In another terminal, watch the dashboard:

```bash
npx tsx path/to/squad-federation-core/scripts/monitor.ts --watch --interval 10
```

You'll see:
- Team state (scanning → distilling → complete)
- Progress percentage
- Active agent
- Recent learnings

**Example output:**
```
📊 Squad Federation Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━

Team         State       Step              Progress  Updated
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 frontend  scanning    analyzing routes  45%       2m ago
```

## Step 7: Send a Directive (Optional)

Communicate with the team via signals:

```bash
npx tsx path/to/squad-federation-core/scripts/monitor.ts \
  --send frontend \
  --directive "Focus on the authentication module first"
```

This writes a signal to `.worktrees/frontend/.squad/signals/inbox/`. The team will read it on its next status check.

## Step 8: Review Results

Once the team completes (state: `complete`):

1. **Check deliverables:**
   ```bash
   cat .worktrees/frontend/deliverable.md
   ```

2. **Review learnings:**
   ```bash
   cat .worktrees/frontend/.squad/learnings/log.jsonl | jq
   ```

3. **Inspect outbox signals:**
   ```bash
   ls -la .worktrees/frontend/.squad/signals/outbox/
   ```

## What's Next?

- **Onboard more teams** - Create backend, testing, infra teams
- **Run parallel sessions** - `launch.ts --all` to start all teams
- **Sweep learnings** - `sweep-learnings.ts` to find patterns across teams
- **Graduate knowledge** - `graduate-learning.ts` to promote learnings to skills
- **Sync skills** - `sync-skills.ts` to propagate updated skills to all teams

## Common Workflows

### Reset a Team

If a team gets stuck or you want to restart:

```bash
npx tsx path/to/squad-federation-core/scripts/launch.ts --team frontend --reset
```

This clears `status.json`, acknowledges inbox signals, and runs the cleanup hook.

### Launch All Teams in Parallel

```bash
npx tsx path/to/squad-federation-core/scripts/launch.ts --all
```

Each team runs in its own headless session.

### Watch Multiple Teams

The monitor dashboard shows all teams simultaneously:

```bash
npx tsx path/to/squad-federation-core/scripts/monitor.ts --watch --interval 20
```

## Troubleshooting

### Team stuck in "initializing"

Check the team's `run-output.log`:

```bash
tail -100 .worktrees/frontend/run-output.log
```

### No status updates

Ensure the team's headless session is still running:

```bash
ps aux | grep copilot
```

If it's not running, check for errors in the log.

### Signal not received

Verify the signal was written:

```bash
ls -la .worktrees/frontend/.squad/signals/inbox/
```

Teams check inbox when they update status (every few minutes depending on workload).

## Next Steps

- [Learn about team onboarding options](/guides/team-onboarding)
- [Explore communication transports](/guides/communication-transports)
- [Set up monitoring with OTel](/guides/monitoring)
