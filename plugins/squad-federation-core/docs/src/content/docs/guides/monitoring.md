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

**Research archetype:**
- Documents analyzed
- Patterns discovered
- Insights logged

These metrics flow to the telemetry dashboard if enabled.

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
