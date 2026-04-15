---
title: Communication Transports
description: How teams communicate via file signals
---

# Communication Transports

Squad Federation teams communicate via **signals** — structured messages for directives, questions, reports, and alerts. Communication always uses file signals — the only supported transport.

## File Signals

**What it is:**
- Signals stored as JSON files in `.squad/signals/`
- Teams poll their inbox and write to outbox
- Acknowledgments via `.ack` files
- Fast, local, works offline

**Best for:**
- Local development and git workflows
- Debugging signal flow directly
- Offline capability
- No external dependencies
- Clean audit trail via git history

## Teams Notifications (Optional)

If you want meta-squad updates in Microsoft Teams, configure `teamsConfig` in `federate.config.json`. This is a **notification channel** — the meta-squad skill layer posts summaries and polls for `#directive` messages from you. It does not replace file signals as the team communication transport.

```json
{
  "teamsConfig": {
    "teamId": "abc-123-def-456",
    "channelId": "xyz-789-uvw-012"
  }
}
```

## How File Signals Work

### Signal Storage

Signals are JSON files with timestamped names:

**Inbox:** `.squad/signals/inbox/{timestamp}-{type}-{subject-slug}.json`
**Outbox:** `.squad/signals/outbox/{timestamp}-{type}-{subject-slug}.json`

**Example:**
```
.squad/signals/inbox/1706611200000-directive-focus-on-auth.json
```

### Signal Structure

```json
{
  "id": "sig-1706611200000-abc123",
  "timestamp": "2025-01-30T12:00:00Z",
  "from": "meta-squad",
  "to": "frontend",
  "type": "directive",
  "subject": "Focus on authentication module",
  "body": "Prioritize auth components. Skip legacy utils for now.",
  "protocol": "file-signal-v1"
}
```

### Four Signal Types

**1. directive** - Action for a team to take
> "Focus on authentication module first"

**2. question** - Information request
> "What's the test coverage for auth?"

**3. report** - Status update or findings
> "Completed scanning, found 3 high-priority items"

**4. alert** - Error or blocker
> "Cannot access database schema files"

### Acknowledgment

When a team processes a signal, it creates a `.ack` file:

```bash
.squad/signals/inbox/1706611200000-directive-focus-on-auth.json
.squad/signals/inbox/1706611200000-directive-focus-on-auth.json.ack
```

The `.ack` file prevents re-processing the same signal.

### Sending Signals

Through Copilot:
> "Tell the frontend team to focus on authentication"

The orchestration skill writes the signal file automatically.

### Reading Signals

Teams check their inbox during status updates. The placement adapter reads `.squad/signals/inbox/`, parses unacknowledged signals, and returns them to the team agent.

## Signal Protocol Reference

### Message Schema

All signals conform to this structure:

```typescript
{
  id: string;                // Unique signal ID
  timestamp: string;          // ISO 8601 timestamp
  from: string;               // Sender team ID
  to: string;                 // Recipient team ID
  type: 'directive' | 'question' | 'report' | 'alert';
  subject: string;            // Short summary
  body: string;               // Detailed message
  protocol: string;           // Protocol version
}
```

### File Naming Convention

**Format:** `{timestamp}-{type}-{subject-slug}.json`

**Example:** `1706611200000-directive-focus-on-auth.json`

The timestamp (Unix milliseconds) ensures chronological ordering.

### Acknowledgment Lifecycle

**File signals:**
1. Signal written to `inbox/`
2. Team reads signal
3. Team creates `.ack` file
4. Signal no longer appears in unacknowledged list

## Debugging Communication

### File Signals

Ask the monitoring skill to show signal status:
> "Show me signals for the frontend team"

You can also inspect signals directly in the team's workspace at `.worktrees/frontend/.squad/signals/inbox/` to see unprocessed messages and acknowledgments.

## Common Issues

### File Signals: Inbox not being checked

Teams check inbox during status updates. If a team isn't running or stuck, signals won't be read.

**Fix:** Restart the team:
> "Restart the frontend team"

### Signals not routed correctly

Check the `to` field in the signal matches the team's `domainId` in `.squad/teams.json`.

## Next Steps

- [Monitor team communication](/vladi-plugins-marketplace/guides/monitoring)
- [Launch and manage teams](/vladi-plugins-marketplace/guides/federation-setup#the-setup-conversation)
- [Learn about team onboarding](/vladi-plugins-marketplace/guides/team-onboarding)
