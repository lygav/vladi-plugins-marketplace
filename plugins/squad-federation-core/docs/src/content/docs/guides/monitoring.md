---
title: Monitoring
description: Dashboard, telemetry, and team health tracking
---

# Monitoring

Squad Federation provides a **hybrid monitoring model**: a centralized dashboard for meta-squad oversight and archetype-specific monitors for deep team analysis.

## Dashboard (Meta-Squad View)

The `monitor.ts` script provides real-time status of all teams.

### Running the Dashboard

**One-time check:**
```bash
npx tsx scripts/monitor.ts
```

**Continuous monitoring:**
```bash
npx tsx scripts/monitor.ts --watch --interval 30
```

Updates every 30 seconds.

### Dashboard Output

```
📊 Squad Federation Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━

Team         State       Step              Progress  Updated
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ backend   failed      analyzing routes  65%       1m ago
🔄 frontend  scanning    auth module       45%       2m ago
✅ infra     complete    -                 100%      5m ago
⏸️  testing  paused      -                 80%       12m ago
```

**State emojis:**
- ❌ `failed` - Error occurred
- 🔄 `initializing` - Just started
- 🔄 `scanning` - Analyzing codebase
- 🔄 `distilling` - Processing findings
- ⏸️ `paused` - Manually paused
- ✅ `complete` - Finished successfully

### Sorting

Teams are sorted by state priority:
1. Failed (needs attention)
2. Initializing/Scanning/Distilling (active)
3. Paused
4. Complete

### Stalled Detection

Dashboard warns if a team hasn't updated status in >10 minutes:

```
⚠️  frontend: No update in 15m (possible stall)
```

Check the team's `run-output.log` for issues.

### Deliverable & Learning Checks

Dashboard shows:
- ✅ Deliverable exists
- 📚 Recent learnings (last 5 entries)

Example:
```
📦 Deliverables:
  frontend: ✅ deliverable.md
  backend:  ❌ Missing

📚 Recent Learnings:
  frontend (2):
    - pattern: Parallel test execution reduces CI time
    - discovery: Auth context passed via props
```

## Sending Directives

Use the dashboard to send signals:

```bash
npx tsx scripts/monitor.ts --send frontend --directive "Focus on login flow first"
```

This writes a signal to the team's inbox.

## Archetype-Specific Monitors

Each archetype can provide a custom monitor for deeper analysis.

### How Archetype Monitors Work

Archetype plugins can include:

```
plugins/squad-archetype-coding/
└── team/
    └── monitors/
        └── coding-monitor.ts
```

**Monitor base class:**
```typescript
abstract class MonitorBase {
  abstract monitor(teamId: string): Promise<MonitorResult>
  
  emitMetrics(name: string, value: number, attributes: object): void
  emitEvent(name: string, attributes: object): void
  logInfo/Warn/Error(message: string): void
}
```

### Example: Coding Monitor

```typescript
class CodingMonitor extends MonitorBase {
  async monitor(teamId: string): Promise<MonitorResult> {
    const status = await this.readStatus(teamId);
    const files = await this.listChangedFiles(teamId);
    const tests = await this.countTests(files);
    
    this.emitMetrics('code.files_changed', files.length, { domain: teamId });
    this.emitMetrics('code.test_count', tests, { domain: teamId });
    
    if (tests < files.length * 0.5) {
      this.logWarn('Test coverage may be low');
      return {
        health: 'warning',
        message: 'Consider adding more tests'
      };
    }
    
    return { health: 'healthy', message: 'On track' };
  }
}
```

### Running Archetype Monitors

(Not directly exposed via CLI in v0.5.0 - monitors are called internally during team runs)

Future: `npx tsx scripts/monitor.ts --team frontend --deep`

## OpenTelemetry Integration

Squad Federation instruments team operations with OTel spans, metrics, and events.

### Enabling Telemetry

In `federate.config.json`:

```json
{
  "telemetry": {
    "enabled": true
  }
}
```

Set the endpoint:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_SERVICE_NAME=squad-federation
```

### Telemetry Data

**Spans:**
- Team lifecycle operations (onboard, launch, monitor)
- Placement operations (read, write, commit, push)
- Communication operations (readSignals, writeSignals)

**Metrics:**
- `squad.teams.active` - Active team count
- `squad.teams.failed` - Failed team count
- `squad.signals.sent` - Signal send rate
- `squad.learnings.created` - Learning creation rate

**Events:**
- `team.onboarded` - Team created
- `team.launched` - Session started
- `team.completed` - Task finished
- `learning.graduated` - Learning promoted to skill

**Attributes:**
- `squad.domain` - Team name
- `domain.id` - Team ID
- `archetype.id` - Archetype name
- `placement.type` - Placement strategy
- `communication.type` - Communication protocol

### Viewing Telemetry

#### Aspire Dashboard (Recommended)

Enable in config:

```json
{
  "telemetry": {
    "enabled": true,
    "aspire": true
  }
}
```

Run the dashboard:

```bash
docker run -p 18888:18888 -p 4318:18889 \
  mcr.microsoft.com/dotnet/aspire-dashboard:latest
```

Access at `http://localhost:18888`.

#### Jaeger (Alternative)

Run Jaeger:

```bash
docker run -p 16686:16686 -p 4318:4318 \
  jaegertracing/all-in-one:latest
```

Access at `http://localhost:16686`.

### Team-Specific OTel Config

Each team gets an `.mcp.json` file when launched (if telemetry enabled):

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

This allows team agents to emit telemetry via MCP.

## Status File Format

Each team maintains `.squad/status.json`:

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

**Fields:**
- `step` - Current sub-task
- `agent_active` - Active agent name
- `progress_pct` - Estimated completion (0-100)
- `error` - Error message if failed

### Reading Status Programmatically

```typescript
const status = await communication.readStatus(teamId);
console.log(`Team ${teamId} is ${status.state} at ${status.progress_pct}%`);
```

## Troubleshooting

### Team not appearing in dashboard

Check registry:
```bash
cat .squad/teams.json | jq '.teams[] | select(.domain == "frontend")'
```

If missing, team wasn't registered. Re-run onboarding.

### Stale status (no updates)

Check team session:
```bash
ps aux | grep copilot | grep frontend
```

If not running, team crashed. Check `run-output.log`:
```bash
tail -100 .worktrees/frontend/run-output.log
```

### Telemetry not appearing

Verify endpoint:
```bash
echo $OTEL_EXPORTER_OTLP_ENDPOINT
```

Test connection:
```bash
curl http://localhost:4318/v1/traces
```

Check team `.mcp.json` was created:
```bash
cat .worktrees/frontend/.mcp.json
```

## Next Steps

- [Understand the signal protocol](/reference/signal-protocol)
- [Manage knowledge lifecycle](/guides/knowledge-lifecycle)
- [Configure telemetry](/reference/configuration)
