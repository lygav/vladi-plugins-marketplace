---
title: Monitoring
description: How to track team progress through conversational skills and telemetry
---

# Monitoring

Squad Federation provides a **hybrid monitoring model**: conversational skills for quick status checks and optional OpenTelemetry dashboards for deep observability.

## Monitoring Through Skills

The **federation-orchestration skill** answers questions about team status, progress, and health.

### Check All Teams

> "How's my federation doing?"

The skill shows a dashboard:

```
📊 Squad Federation Dashboard

Team         State       Step              Progress  Updated
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ backend   failed      analyzing routes  65%       1m ago
🔄 frontend  scanning    auth module       45%       2m ago
✅ infra     complete    -                 100%      5m ago
```

**State indicators:**
- ❌ `failed` - Error occurred
- 🔄 Active states (initializing, scanning, distilling)
- ✅ `complete` - Finished successfully
- ⏸️ `paused` - Manually paused

### Check Specific Team

> "What's the frontend team doing?"

The skill shows detailed status:
```
Frontend Team Status:
  State: scanning
  Step: analyzing authentication module
  Progress: 45%
  Last update: 2 minutes ago
  Deliverable: ✅ Present
  Recent learnings: 2
```

### Check for Stalled Teams

> "Are any teams stuck?"

The skill warns if teams haven't updated in >10 minutes:
```
⚠️ Backend team: No update in 15m (possible stall)
```

Check the team's log:
```bash
tail -100 .worktrees/backend/run-output.log
```

### View Deliverables

> "Show me team deliverables"

```
📦 Deliverables:
  frontend: ✅ deliverable.md
  backend:  ❌ Missing
  infra:    ✅ OUTPUT.json
```

### View Recent Learnings

> "What have my teams learned?"

```
📚 Recent Learnings:
  frontend (3):
    - pattern: Parallel test execution reduces CI time
    - discovery: Auth context passed via props
    - convention: Name API routes with kebab-case
  
  backend (2):
    - pattern: Use dependency injection for database clients
    - gotcha: Don't import barrel files in tests
```

## Telemetry Dashboard (Optional)

If you enabled telemetry during federation setup, you have access to the OpenTelemetry Aspire dashboard.

### Accessing the Dashboard

The dashboard runs at `http://localhost:18888` (auto-started if you chose "Yes" during setup).

If it's not running, start it:

```bash
docker run -p 18888:18888 -p 4318:18889 \
  mcr.microsoft.com/dotnet/aspire-dashboard:latest
```

### What You See

**Traces:**
- Team lifecycle operations (onboard, launch, monitor)
- Placement operations (read, write, commit, push)
- Communication operations (readSignals, writeSignals)

**Metrics:**
- `squad.teams.active` - Active team count
- `squad.teams.failed` - Failed team count
- `squad.signals.sent` - Signal send rate
- `squad.learnings.created` - Learning creation rate

**Logs:**
- Team startup/shutdown events
- Signal send/receive events
- Learning capture events
- Error messages

### Team-Specific Telemetry

Each team gets an `.mcp.json` file with telemetry config:

```json
{
  "mcpServers": {
    "squad-otel": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-opentelemetry"],
      "env": {
        "OTEL_EXPORTER_OTLP_ENDPOINT": "http://localhost:4318",
        "OTEL_SERVICE_NAME": "squad-frontend"
      }
    }
  }
}
```

Teams emit telemetry via the OpenTelemetry MCP server during their sessions.

## Status File Format

Teams maintain `.squad/status.json` with current state:

```json
{
  "state": "scanning",
  "step": "analyzing authentication module",
  "updated_at": "2025-01-30T12:30:00Z",
  "agent_active": "lead",
  "progress_pct": 45,
  "error": null
}
```

**States:**
- `initializing` - Team starting up
- `scanning` - Analyzing codebase
- `distilling` - Processing findings
- `complete` - Finished successfully
- `failed` - Error occurred
- `paused` - Manually paused

Ask the orchestration skill to show detailed status for a specific team:
> "What's the frontend team status?"

The status file is also available at `.worktrees/frontend/.squad/signals/status.json`.

## Archetype-Specific Monitoring

Each archetype can provide custom monitoring logic beyond the basic status check.

### How It Works

Archetype plugins include monitors that emit domain-specific metrics:

**Coding archetype:**
- Files changed count
- Test count
- PR readiness checks

**Deliverable archetype:**
- Deliverable completeness
- Schema validation status
- Output file size

**Consultant archetype:**
- Questions answered
- Domains indexed
- Insights provided

These metrics flow to the telemetry dashboard if enabled.

## Heartbeat (Unattended Monitoring)

The **heartbeat** provides fully unattended monitoring by spawning periodic Copilot sessions that check team status, relay signals, and post summaries automatically.

### Starting the Heartbeat

Say to the orchestration skill:

> "Start heartbeat"

The heartbeat begins running in the background. It spawns a fresh meta-squad session at the configured interval (default: every 5 minutes). Each session:

1. Reads all team status files and signal outboxes
2. Summarizes what each team is doing
3. Highlights errors, alerts, or stuck teams
4. Posts the summary to your Teams channel (if configured)
5. Relays pending questions from teams

Sessions have a 120-second timeout to keep things lightweight.

### Checking Heartbeat Status

> "Is the heartbeat running?"

or

> "Heartbeat status"

The skill reports whether the heartbeat process is active and when it last ran.

### Stopping the Heartbeat

> "Stop heartbeat"

The heartbeat process shuts down cleanly.

### Configuring the Interval

The default interval is 300 seconds (5 minutes). To change it, update `federate.config.json`:

```json
{
  "heartbeat": {
    "enabled": true,
    "intervalSeconds": 120
  }
}
```

Or enable heartbeat during [federation setup](/vladi-plugins-marketplace/guides/federation-setup) when the skill asks.

### When to Use Heartbeat

The heartbeat is useful when:

- You want continuous monitoring without keeping a Copilot session open
- Teams are running long autonomous tasks and you want periodic summaries
- You have Teams notifications configured and want regular status posts

For ad-hoc checks, the conversational monitoring described above is faster and more interactive.

## Teams Notifications

When `teamsConfig` is set in `federate.config.json`, the meta-squad posts status summaries to a Microsoft Teams channel automatically. This works through the **skill layer** — Copilot sessions have native access to the Teams MCP tools.

### What Gets Posted

- **Heartbeat summaries** — periodic status updates for all teams
- **Directive relays** — confirmation when directives are sent to teams
- **Alert notifications** — team failures, stalls, or critical errors

### Posting Directives from Teams

You can post messages tagged with `#directive` in the configured Teams channel. The meta-squad heartbeat polls for these and acts on them:

```
#directive tell frontend to skip legacy utils
#directive pause backend
#directive restart infra
```

### Configuration

Add `teamsConfig` to `federate.config.json`:

```json
{
  "teamsConfig": {
    "teamId": "your-teams-team-guid",
    "channelId": "19:your-channel-id@thread.tacv2"
  }
}
```

The meta-squad uses the `PostChannelMessage` MCP tool to post and `ListChannelMessages` to poll. No additional setup is needed — these tools are available natively in Copilot sessions.

### When to Use

- You want status updates without keeping a terminal open
- Multiple stakeholders need visibility into federation progress
- You want to send directives from Teams instead of the terminal

For setup details, see the [configuration reference](/vladi-plugins-marketplace/reference/configuration#teamsconfig).

## Troubleshooting

### Team Not Appearing in Dashboard

Ask the orchestration skill:
> "Why isn't the frontend team showing?"

The skill will check the team registry and help diagnose the issue.

If the team is missing, re-run onboarding:
> "Onboard a team for frontend"

### Team Shows "Stalled"

Ask the orchestration skill to check the team:
> "Why is the frontend team stalled?"

The skill will check the session status and error logs.

To restart:
> "Restart the frontend team"

### Telemetry Not Appearing

Ask the orchestration skill to check telemetry:
> "Is telemetry working for my teams?"

The skill will verify the dashboard is running and teams are exporting telemetry.

If telemetry wasn't enabled, you can enable it by running federation setup again and choosing telemetry, then restarting teams.

## Next Steps

- [Send directives to guide teams](/vladi-plugins-marketplace/getting-started/first-federation#step-5-send-a-directive-optional)
- [Learn about knowledge lifecycle](/vladi-plugins-marketplace/guides/knowledge-lifecycle)
- [Understand communication protocols](/vladi-plugins-marketplace/guides/communication-transports)
