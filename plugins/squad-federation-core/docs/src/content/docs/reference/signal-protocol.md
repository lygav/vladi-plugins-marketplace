---
title: Signal Protocol
description: File signal and Teams channel message formats
---

# Signal Protocol

Squad Federation uses a **signal protocol** for inter-team communication. Signals are structured messages that coordinate team work.

## Signal Types

All four signal types are supported by both file-signal and teams-channel protocols:

### Directive

**Purpose:** Tell a team what to do

**Example:**
```json
{
  "type": "directive",
  "subject": "Focus on authentication module",
  "body": "Prioritize login and logout flows. Skip legacy utils for now."
}
```

**Use case:** Meta squad assigns tasks to teams

### Question

**Purpose:** Request information

**Example:**
```json
{
  "type": "question",
  "subject": "What's the database schema for users table?",
  "body": "Need to understand user fields before implementing auth."
}
```

**Use case:** Team asks meta squad for clarification

### Report

**Purpose:** Share findings or status

**Example:**
```json
{
  "type": "report",
  "subject": "Authentication scan complete",
  "body": "Found 12 auth-related files. Main flow uses JWT tokens."
}
```

**Use case:** Team reports progress to meta squad

### Alert

**Purpose:** Raise error or blocking issue

**Example:**
```json
{
  "type": "alert",
  "subject": "Cannot access database schema files",
  "body": "Permissions error when reading db/migrations/. Need access."
}
```

**Use case:** Team notifies meta squad of problems

## File-Signal Protocol

Signals are stored as JSON files in `.squad/signals/inbox/` and `outbox/`.

### File Naming

Format: `{timestamp}-{type}-{subject-slug}.json`

**Example:**
```
1706611200000-directive-focus-on-auth.json
1706611210000-question-database-schema.json
1706611220000-report-scan-complete.json
1706611230000-alert-permission-error.json
```

**Components:**
- `timestamp` - Unix milliseconds (sortable)
- `type` - Signal type (lowercase)
- `subject-slug` - Kebab-case subject (max 50 chars)

### File Structure

```json
{
  "id": "sig-1706611200000-abc123",
  "timestamp": "2025-01-30T12:00:00Z",
  "from": "meta-squad",
  "to": "frontend",
  "type": "directive",
  "subject": "Focus on authentication module",
  "body": "Prioritize login and logout flows. Skip legacy utils for now.",
  "protocol": "file-signal-v1"
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (format: `sig-{timestamp}-{random}`) |
| `timestamp` | string | ISO 8601 timestamp |
| `from` | string | Sender team ID (e.g., `"meta-squad"`) |
| `to` | string | Recipient team ID (e.g., `"frontend"`) |
| `type` | enum | One of: `directive`, `question`, `report`, `alert` |
| `subject` | string | Brief subject line (1-100 chars) |
| `body` | string | Detailed message content |
| `protocol` | string | Always `"file-signal-v1"` |

### Directory Structure

```
.squad/signals/
├── inbox/
│   ├── 1706611200000-directive-focus-on-auth.json
│   ├── 1706611200000-directive-focus-on-auth.json.ack
│   └── 1706611210000-question-database-schema.json
└── outbox/
    ├── 1706611220000-report-scan-complete.json
    └── 1706611230000-alert-permission-error.json
```

**Inbox:** Signals sent TO this team

**Outbox:** Signals sent FROM this team

### Acknowledgment

When a team processes a signal, it creates a `.ack` file:

```bash
touch .squad/signals/inbox/1706611200000-directive-focus-on-auth.json.ack
```

**Ack file content:** Empty (presence = acknowledged)

**Purpose:**
- Mark signal as read
- Prevent duplicate processing
- Enable audit trail

### Reading Signals

**Unacknowledged signals:**
```typescript
const signals = await communication.readSignals(teamId, 'inbox');
const unacked = signals.filter(s => !hasAck(s.id));
```

**All signals:**
```bash
ls .squad/signals/inbox/*.json
```

**Parse signal:**
```bash
cat .squad/signals/inbox/1706611200000-directive-focus-on-auth.json | jq .
```

### Writing Signals

**Via script:**
```bash
npx tsx scripts/monitor.ts \
  --send frontend \
  --directive "Focus on login flow first"
```

**Programmatically:**
```typescript
await communication.writeInboxSignal('frontend', {
  id: `sig-${Date.now()}-${randomId()}`,
  timestamp: new Date().toISOString(),
  from: 'meta-squad',
  to: 'frontend',
  type: 'directive',
  subject: 'New task',
  body: 'Details here...',
  protocol: 'file-signal-v1'
});
```

**Manual (for testing):**
```bash
echo '{
  "id": "sig-test-123",
  "timestamp": "2025-01-30T12:00:00Z",
  "from": "meta-squad",
  "to": "frontend",
  "type": "directive",
  "subject": "Test signal",
  "body": "This is a test",
  "protocol": "file-signal-v1"
}' > .squad/signals/inbox/test-signal.json
```

## Teams Channel Protocol

Signals are posted as Adaptive Cards or text messages to a Microsoft Teams channel.

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

### Hashtag Format

| Hashtag | Direction | Purpose |
|---------|-----------|---------|
| `#meta` | User → Meta | Request or question from human |
| `#{teamId}` | Meta → Team | Directive to specific team |
| `#meta-status` | Team → Meta | Status report |
| `#meta-error` | Team → Meta | Error alert |

### Adaptive Card Format

```json
{
  "type": "AdaptiveCard",
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "version": "1.5",
  "body": [
    {
      "type": "TextBlock",
      "text": "🎯 Directive",
      "weight": "Bolder",
      "size": "Medium"
    },
    {
      "type": "TextBlock",
      "text": "Focus on authentication module",
      "weight": "Bolder"
    },
    {
      "type": "TextBlock",
      "text": "Prioritize login and logout flows. Skip legacy utils for now.",
      "wrap": true
    },
    {
      "type": "FactSet",
      "facts": [
        { "title": "From:", "value": "meta-squad" },
        { "title": "To:", "value": "frontend" },
        { "title": "Time:", "value": "2025-01-30 12:00 PM" }
      ]
    }
  ]
}
```

**Icon mapping:**
- `directive` → 🎯
- `question` → ❓
- `report` → 📊
- `alert` → 🚨

### Plain Text Fallback

If Adaptive Cards are unsupported, plain text is used:

```
🎯 Directive: Focus on authentication module

Prioritize login and logout flows. Skip legacy utils for now.

From: meta-squad
To: frontend
Time: 2025-01-30 12:00 PM

#frontend
```

### Signal Message Conversion

**Teams message → SignalMessage:**

1. Parse hashtag to determine `to` field
2. Extract signal type from icon or keyword
3. Extract subject (first bold line or first sentence)
4. Extract body (remaining text)
5. Set `protocol: "teams-channel-v1"`

**SignalMessage → Teams message:**

1. Choose icon based on `type`
2. Create Adaptive Card with `subject` and `body`
3. Add hashtag for routing (`#{to}`)
4. Post to Teams channel

### Reading from Teams

```typescript
const messages = await teamsClient.listChannelMessages(teamId, channelId);
const signals = messages
  .filter(m => m.body.content.includes('#frontend'))
  .map(m => parseTeamsMessage(m));
```

### Writing to Teams

```typescript
await communication.writeInboxSignal('frontend', {
  id: `sig-${Date.now()}`,
  timestamp: new Date().toISOString(),
  from: 'meta-squad',
  to: 'frontend',
  type: 'directive',
  subject: 'New task',
  body: 'Details...',
  protocol: 'teams-channel-v1'
});
```

This posts an Adaptive Card to the channel with hashtag `#frontend`.

## Protocol Comparison

| Feature | File-Signal | Teams-Channel |
|---------|------------|---------------|
| **Latency** | <1ms (local) | ~100-500ms (HTTP) |
| **Throughput** | Thousands/sec | Dozens/min (rate-limited) |
| **Offline** | ✅ Yes | ❌ No |
| **Human visibility** | ⚠️ Via git | ✅ Yes (real-time) |
| **Audit trail** | ✅ Git history | ✅ Teams compliance |
| **Authentication** | Filesystem | OAuth |
| **Setup complexity** | Low | Medium (Teams config) |

## Signal Lifecycle

### File-Signal

1. **Create** - Write JSON file to `inbox/`
2. **Read** - Team polls `inbox/` for new files
3. **Process** - Team handles signal logic
4. **Acknowledge** - Team creates `.ack` file
5. **Archive** (optional) - Move to `archive/` folder

### Teams-Channel

1. **Create** - Post Adaptive Card to channel
2. **Read** - Poll channel for new messages with hashtags
3. **Process** - Team handles signal logic
4. **Acknowledge** - React to message with ✅ emoji (optional)
5. **Archive** - Messages remain in Teams (no deletion)

## Best Practices

### Subject Lines

- Keep concise (1-10 words)
- Be specific ("Focus on auth module" not "Do this")
- Use imperative mood for directives ("Implement X")
- Use question format for questions ("What is X?")

### Body Content

- Provide context (why is this needed?)
- Include relevant details (file paths, error messages)
- Keep under 1000 chars if possible
- Use plain text (no formatting for file-signal)

### Signal Frequency

**File-signal:**
- No hard limits
- Batch when possible (avoid 100s per minute)

**Teams-channel:**
- Respect Teams API rate limits
- Avoid high-frequency signals (poll interval: 30-60s)
- Batch updates into single report

### Error Handling

**Invalid JSON (file-signal):**
```typescript
try {
  const signal = JSON.parse(content);
} catch (err) {
  console.error('Invalid signal JSON:', err);
  // Move to error folder
}
```

**Failed Teams post:**
```typescript
try {
  await teamsClient.postMessage(card);
} catch (err) {
  console.error('Failed to post to Teams:', err);
  // Retry with exponential backoff
}
```

## Security

### File-Signal

**Access control:** Filesystem permissions

**Encryption:** Not built-in (use git-crypt if needed)

**Audit:** Git commit history

### Teams-Channel

**Access control:** Teams channel membership

**Encryption:** TLS for API calls

**Audit:** Teams compliance logs

## Troubleshooting

### Signal not appearing (file-signal)

Check file exists:
```bash
ls .squad/signals/inbox/*.json
```

Validate JSON:
```bash
cat signal.json | jq .
```

Check file permissions:
```bash
ls -la .squad/signals/inbox/
```

### Signal not appearing (teams-channel)

Check hashtag format:
```
#frontend (correct)
# frontend (wrong - space)
#Frontend (wrong - case-sensitive)
```

Verify Teams config:
```bash
cat federate.config.json | jq '.teamsConfig'
```

Test Teams API access:
```bash
curl -H "Authorization: Bearer $MICROSOFT_GRAPH_TOKEN" \
  https://graph.microsoft.com/v1.0/teams/{teamId}/channels/{channelId}/messages
```

## Next Steps

- [Configure communication transports](/guides/communication-transports)
- [Monitor team status](/guides/monitoring)
- [View SDK interfaces](/reference/sdk-types)
