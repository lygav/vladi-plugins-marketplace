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

You can read this file directly:
```bash
cat .worktrees/frontend/.squad/signals/status.json | jq
```

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

Through Copilot:
> "Why isn't the frontend team showing?"

Or check registry manually:
```bash
cat .squad/teams.json | jq '.teams[] | select(.domain == "frontend")'
```

If missing, re-run onboarding:
> "Onboard a team for frontend"

### Team Shows "Stalled"

Check if the session is running:
```bash
ps aux | grep copilot | grep frontend
```

If not running, view the error log:
```bash
tail -100 .worktrees/frontend/run-output.log
```

Restart the team:
> "Restart the frontend team"

### Telemetry Not Appearing

**Check endpoint:**
```bash
echo $OTEL_EXPORTER_OTLP_ENDPOINT
```

**Test connection:**
```bash
curl http://localhost:4318/v1/traces
```

**Verify dashboard running:**
```bash
docker ps | grep aspire-dashboard
```

**Check team MCP config:**
```bash
cat .worktrees/frontend/.mcp.json
```

If missing, telemetry wasn't enabled during launch. Re-launch with telemetry:
> "Launch the frontend team"

## Script Reference

While the skills handle monitoring conversationally, you can run the script directly:

**One-time dashboard check:**
```bash
npx tsx path/to/squad-federation-core/scripts/monitor.ts
```

**Continuous monitoring:**
```bash
npx tsx path/to/squad-federation-core/scripts/monitor.ts --watch --interval 30
```

**Send directive:**
```bash
npx tsx path/to/squad-federation-core/scripts/monitor.ts \
  --send frontend \
  --directive "Focus on login flow first"
```

## Next Steps

- [Send directives to guide teams](/vladi-plugins-marketplace/guides/federation-setup#step-5-send-a-directive-optional)
- [Learn about knowledge lifecycle](/vladi-plugins-marketplace/guides/knowledge-lifecycle)
- [Understand communication protocols](/vladi-plugins-marketplace/guides/communication-transports)
