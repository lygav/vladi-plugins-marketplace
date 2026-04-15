---
title: Communication Transports
description: File-based signals vs Teams channels and when to use each
---

# Communication Transports

Squad Federation supports two communication protocols for team coordination: **file-based signals** and **Teams channel messages**. All teams in a federation use the same protocol (configured in `federate.config.json`).

## File-Based Signals (Default)

File-based communication stores signals as JSON files in each team's `.squad/signals/` directory.

### How It Works

**Signal Storage:**
- Inbox: `.squad/signals/inbox/{timestamp}-{type}-{subject-slug}.json`
- Outbox: `.squad/signals/outbox/{timestamp}-{type}-{subject-slug}.json`

**Signal Structure:**
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

**Acknowledgment:**
When a team processes a signal, it creates a `.ack` file:
```bash
.squad/signals/inbox/1706611200000-directive-skip-legacy.json
.squad/signals/inbox/1706611200000-directive-skip-legacy.json.ack
```

### Configuration

```json
{
  "communicationType": "file-signal"
}
```

No additional configuration needed.

### When to Use

**Ideal for:**
- Local or git-based workflows
- Offline development
- Debugging signal flow directly
- Audit trail via git history
- No external dependencies

**Not ideal for:**
- Human oversight requirements
- Real-time collaboration
- Cross-system integration

### Reading Signals Programmatically

Teams read signals via the `TeamCommunication` interface:

```typescript
const signals = await communication.readSignals(teamId, 'inbox');
for (const signal of signals) {
  console.log(`${signal.type}: ${signal.subject}`);
}
```

### Writing Signals

Via monitor script:
```bash
npx tsx scripts/monitor.ts --send frontend --directive "Skip legacy utils"
```

Or programmatically:
```typescript
await communication.writeInboxSignal(teamId, {
  id: `sig-${Date.now()}-${randomId()}`,
  timestamp: new Date().toISOString(),
  from: 'meta-squad',
  to: 'frontend',
  type: 'directive',
  subject: 'New directive',
  body: 'Detailed instructions...',
  protocol: 'file-signal-v1'
});
```

## Teams Channel Communication

Teams channel communication posts signals as Adaptive Cards to a Microsoft Teams channel.

### How It Works

**Hashtag Protocol:**
- Meta receives: `#meta` (directive from user)
- Team reports status: `#meta-status`
- Team reports error: `#meta-error`
- Meta sends directive: `#{teamId}` (e.g., `#frontend`)

**Message Format:**
Signals are converted to Adaptive Cards:

```json
{
  "type": "AdaptiveCard",
  "body": [
    {
      "type": "TextBlock",
      "text": "🎯 Directive",
      "weight": "Bolder",
      "size": "Medium"
    },
    {
      "type": "TextBlock",
      "text": "Focus on authentication module"
    },
    {
      "type": "TextBlock",
      "text": "Prioritize auth components...",
      "wrap": true
    }
  ]
}
```

### Configuration

```json
{
  "communicationType": "teams-channel",
  "teamsConfig": {
    "teamId": "abc-123-def-456",
    "channelId": "xyz-789-uvw-012"
  }
}
```

**Getting IDs:**

1. **Team ID:**
   - Open Teams → Click team name → "Get link to team"
   - Extract from URL: `teams.microsoft.com/...?groupId={teamId}`

2. **Channel ID:**
   - Right-click channel → "Get link to channel"
   - Extract from URL: `...&threadId={channelId}`

### When to Use

**Ideal for:**
- Human oversight and collaboration
- Real-time notifications
- Existing Teams workflows
- Transparency for stakeholders
- Cross-functional coordination

**Not ideal for:**
- Offline development
- High-frequency signals (channel noise)
- Automated testing

### Hashtag Routing

**User → Meta Squad:**
```
#meta Please analyze the authentication flow
```

**Meta → Specific Team:**
```
#frontend Focus on login form validation
```

**Team → Meta (Status):**
```
#meta-status Completed scanning, starting distillation
```

**Team → Meta (Error):**
```
#meta-error Cannot access database schema files
```

### Signal Types

All four signal types are supported:

1. **directive** - Action to take
2. **question** - Information request
3. **report** - Status or findings
4. **alert** - Error or blocking issue

### Reading from Teams

The `TeamsChannelCommunication` adapter:

1. Polls the channel for new messages
2. Parses Adaptive Cards or plain text
3. Extracts hashtags to determine routing
4. Converts to `SignalMessage` objects

### Writing to Teams

```typescript
await communication.writeInboxSignal(teamId, {
  id: `sig-${Date.now()}`,
  timestamp: new Date().toISOString(),
  from: 'meta-squad',
  to: 'frontend',
  type: 'directive',
  subject: 'New task',
  body: 'Details here...',
  protocol: 'teams-channel-v1'
});
```

This posts an Adaptive Card to the Teams channel with hashtag `#frontend`.

## Switching Communication Types

### Before Teams Exist

Just update `federate.config.json`:

```json
{
  "communicationType": "teams-channel",
  "teamsConfig": { ... }
}
```

New launches will use Teams.

### With Existing Teams

1. Update config
2. Restart team sessions (`launch.ts --team {name}`)
3. Old file signals remain in inbox (manual cleanup if needed)

## Hybrid Approach (Not Supported)

You **cannot** mix communication types within a federation. All teams must use the same protocol.

Workaround: Run separate federations if you need both protocols.

## Signal Protocol Details

### Signal Message Schema (Zod)

```typescript
{
  id: z.string(),
  timestamp: z.string(),
  from: z.string(),
  to: z.string(),
  type: z.enum(['directive', 'question', 'report', 'alert']),
  subject: z.string(),
  body: z.string(),
  protocol: z.string()
}
```

### File Naming Convention

Format: `{timestamp}-{type}-{subject-slug}.json`

Example: `1706611200000-directive-focus-on-auth.json`

### Acknowledgment Protocol

**File-signal:** Create `.ack` file

**Teams-channel:** React to message with ✅ emoji (optional)

## Performance Considerations

### File-Signal

- **Latency:** Depends on file system (local: <1ms, networked: variable)
- **Throughput:** Limited by filesystem (thousands per second)
- **Concurrency:** File locking via atomic operations

### Teams-Channel

- **Latency:** HTTP request overhead (~100-500ms)
- **Throughput:** Rate-limited by Teams API (dozens per minute)
- **Concurrency:** Handled by Teams service

## Security

### File-Signal

- Access control via filesystem permissions
- Signals stored in git (version history)
- No external exposure

### Teams-Channel

- OAuth authentication required
- Messages visible to channel members
- Audit log via Teams compliance

## Migration

### File-Signal → Teams-Channel

1. Create Teams team and channel
2. Update `federate.config.json` with `teamsConfig`
3. Restart all teams

Existing file signals are not migrated automatically.

### Teams-Channel → File-Signal

1. Remove `teamsConfig` from config
2. Set `communicationType: "file-signal"`
3. Restart all teams

Teams messages remain in channel but are no longer monitored.

## Next Steps

- [Monitor team communication](/guides/monitoring)
- [Understand the signal protocol](/reference/signal-protocol)
- [Configure federation](/reference/configuration)
