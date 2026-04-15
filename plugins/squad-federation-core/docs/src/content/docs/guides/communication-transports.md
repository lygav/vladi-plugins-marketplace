---
title: Communication Transports
description: How teams communicate via file signals or Teams channels
---

# Communication Transports

Squad Federation teams communicate via **signals** — structured messages for directives, questions, reports, and alerts. The communication protocol is federation-scoped: all teams use the same method, configured during federation setup.

## Two Options: File Signals vs Teams Channel

The federation-setup skill asks which communication type you want. Your choice determines how teams exchange messages.

### File Signals (Default)

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

**Generated config:**
The federation-setup skill creates this configuration:
```json
{
  "communicationType": "file-signal"
}
```

### Teams Channel

**What it is:**
- Signals posted as Adaptive Cards to Microsoft Teams chat
- Hashtag routing protocol (#meta, #teamId)
- Human-visible in real-time
- OAuth-authenticated access

**Best for:**
- Human oversight and collaboration
- Stakeholder visibility
- Real-time notifications
- Existing Teams workflows
- Cross-functional coordination

**Generated config:**
The federation-setup skill creates this configuration:
```json
{
  "communicationType": "teams-channel",
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

### Sending Signals (File)

Through Copilot:
> "Tell the frontend team to focus on authentication"

The orchestration skill writes the signal file automatically.

### Reading Signals (File)

Teams check their inbox during status updates. The placement adapter reads `.squad/signals/inbox/`, parses unacknowledged signals, and returns them to the team agent.

## How Teams Channel Works

### Hashtag Protocol

Messages use hashtags to route signals:

**User → Meta Squad:**
```
#meta Analyze the authentication flow
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

### Adaptive Card Format

Signals appear as formatted cards in Teams:

```
🎯 Directive
━━━━━━━━━━━━
Subject: Focus on authentication module
Body: Prioritize auth components. Skip legacy utils for now.

From: meta-squad
To: frontend
Timestamp: 2025-01-30T12:00:00Z
```

Human team members see these updates in real-time.

### Getting Team/Channel IDs

The federation-setup skill asks for your Teams channel link if you choose Teams communication. It extracts the IDs automatically from the URL:

**Team ID:**
- Open Teams → Click team name → "Get link to team"
- URL contains: `?groupId={teamId}`

**Channel ID:**
- Right-click channel → "Get link to channel"
- URL contains: `&threadId={channelId}`

Paste the link, and the skill parses both IDs.

### Sending Signals (Teams)

Through Copilot:
> "Tell the frontend team to focus on authentication"

The orchestration skill posts an Adaptive Card to the Teams channel with hashtag `#frontend`.

### Reading Signals (Teams)

Teams poll the channel for new messages via the Microsoft Graph API. The communication adapter:
1. Fetches recent channel messages
2. Parses Adaptive Cards or plain text
3. Extracts hashtags to determine routing
4. Converts to `SignalMessage` objects
5. Returns signals to the team agent

## Switching Communication Types

### Before Teams Exist

Run the federation-setup skill again to change the communication type. New team launches will use the updated protocol.

### With Running Teams

1. Run federation-setup again to update the configuration
2. Restart team sessions:
   > "Restart all teams"

Old signals (file or Teams) remain but aren't processed by the new protocol.

## Hybrid Approach (Not Supported)

You **cannot** mix communication types within a federation. All teams must use file-signal **or** Teams-channel — not both.

**Workaround:** Run separate federations with different configs if you need both protocols.

## Performance Considerations

### File Signals

**Latency:** Near-instant for local filesystems (<1ms)
**Throughput:** Thousands of signals per second
**Concurrency:** Atomic filesystem operations
**Offline:** Works without network

### Teams Channel

**Latency:** HTTP request overhead (~100-500ms)
**Throughput:** Rate-limited by Teams API (dozens per minute)
**Concurrency:** Handled by Teams service
**Offline:** Requires internet connection

## Security

### File Signals

- Access control via filesystem permissions
- Signals stored in git (version history for audit)
- No external exposure
- No authentication overhead

### Teams Channel

- OAuth authentication required (Microsoft Graph API)
- Messages visible to channel members
- Audit log via Teams compliance center
- External dependency (Teams availability)

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

**Teams channel:**
1. Signal posted as Adaptive Card
2. Team reads via Graph API
3. Optional: React with ✅ emoji (not required)
4. Message ID tracked to prevent re-processing

## Debugging Communication

### File Signals

Ask the monitoring skill to show signal status:
> "Show me signals for the frontend team"

You can also inspect signals directly in the team's workspace at `.worktrees/frontend/.squad/signals/inbox/` to see unprocessed messages and acknowledgments.

### Teams Channel

**View recent messages:**
Open the Teams channel in Teams app. All signals appear as cards.

**Check Graph API access:**
Ensure your OAuth token has `ChannelMessage.Read.All` and `ChannelMessage.Send` permissions.

## Common Issues

### File Signals: Inbox not being checked

Teams check inbox during status updates. If a team isn't running or stuck, signals won't be read.

**Fix:** Restart the team:
> "Restart the frontend team"

### Teams: Authentication errors

OAuth token might be expired or missing permissions.

**Fix:** Re-authenticate with Microsoft Graph API. Ensure the app has:
- `ChannelMessage.Read.All`
- `ChannelMessage.Send`

### Signals not routed correctly

Check the `to` field in the signal matches the team's `domainId` in `.squad/teams.json`.

## Migration Scenarios

### File → Teams

**Why:** You want human visibility into team communication.

**Steps:**
1. Create Teams team and channel
2. Get channel link from Teams
3. Run federation setup again, choose Teams communication
4. The setup skill updates the configuration with Teams settings
5. Restart all teams

**Note:** Existing file signals are not migrated. Teams start fresh with Teams channel.

### Teams → File

**Why:** You want offline development or faster signal throughput.

**Steps:**
1. Run federation setup again, choose file signals
2. The setup skill updates the configuration to use file signals
3. Restart all teams

**Note:** Teams messages remain in channel but are no longer monitored.

## Next Steps

- [Monitor team communication](/vladi-plugins-marketplace/guides/monitoring)
- [Launch and manage teams](/vladi-plugins-marketplace/guides/federation-setup#the-setup-conversation)
- [Learn about team onboarding](/vladi-plugins-marketplace/guides/team-onboarding)
