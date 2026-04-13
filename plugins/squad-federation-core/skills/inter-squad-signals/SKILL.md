---
name: "inter-squad-signals"
description: "The user wants to understand or work with the signal protocol for cross-squad communication, check domain status, send directives, read inbox or outbox messages, or debug inter-squad messaging. Triggers on: signal, status, inbox, outbox, directive, inter-squad, message, acknowledgment, scan status."
version: "0.1.0"
---

## Purpose

Define the file-based signal protocol that enables communication between the meta-squad (coordinator) and domain squads (experts). All signals are JSON files on disk — no network services, no databases, no shared memory. This makes the protocol debuggable, version-controllable, and resilient to process crashes.

## Signal Directory Structure

Each domain worktree maintains its own signal directory:

```
{worktree}/.squad/signals/
├── status.json          ← Domain writes, meta-squad reads
├── inbox/               ← Meta-squad writes, domain reads
│   ├── 2024-01-15T10-30-00-000Z-directive-skip-legacy-repo.json
│   └── 2024-01-15T11-00-00-000Z-directive-prioritize-auth.json
└── outbox/              ← Domain writes, meta-squad reads
    ├── 2024-01-15T10-45-00-000Z-report-discovery-complete.json
    └── 2024-01-15T11-15-00-000Z-question-ambiguous-config.json
```

The signals directory is initialized by `onboard.ts` and refreshed by `launch.ts`. Never manually create signal directories — always use the initialization functions.

## ScanStatus Interface

The `status.json` file is the heartbeat of each domain squad. The domain writes to it; the meta-squad reads it.

```typescript
interface ScanStatus {
  domain: string;         // Domain name (e.g., "payments")
  domain_id: string;      // Unique identifier for the domain
  state: 'initializing' | 'working' | 'reviewing' | 'complete' | 'failed' | 'paused';
  step: string;           // Current playbook step (e.g., "analysis")
  started_at: string;     // ISO 8601 timestamp — when the work began
  updated_at: string;     // ISO 8601 timestamp — last status write
  completed_at?: string;  // ISO 8601 timestamp — when state became 'complete'
  progress_pct?: number;  // 0-100, optional progress indicator
  error?: string;         // Error message when state is 'failed'
  agent_active?: string;  // Name of the currently active agent
}
```

### State Machine

```
initializing → working → reviewing → complete
                  ↓          ↓
                failed     failed
                  ↓
                paused → working (resume)
```

- **initializing**: infrastructure is being set up, environment prepared
- **working**: actively executing work steps (archetype-specific playbook)
- **reviewing**: validating outputs and performing quality checks
- **complete**: work is done, outputs finalized
- **failed**: an unrecoverable error occurred (check `error` field)
- **paused**: manually paused via directive, awaiting resume

### Writing Status

Domain squads update status at each step transition and periodically within long steps:

```typescript
import { writeStatus } from '${CLAUDE_PLUGIN_ROOT}/scripts/lib/signals.js';

writeStatus(worktreePath, {
  domain: 'my-product',
  domain_id: 'prod-001',
  state: 'working',
  step: 'analysis',
  started_at: '2024-01-15T10:00:00.000Z',
  updated_at: new Date().toISOString(),
  progress_pct: 45,
  agent_active: 'Agent Beta',
});
```

The `writeStatus` function automatically sets `updated_at` to the current time.

### Reading Status

Meta-squad reads status to build the monitoring dashboard:

```typescript
import { readStatus } from '${CLAUDE_PLUGIN_ROOT}/scripts/lib/signals.js';

const status = readStatus(worktreePath);
if (status && status.state === 'failed') {
  console.error(`Domain ${status.domain} failed: ${status.error}`);
}
```

Returns `null` if no status file exists (domain not yet initialized).

## SignalMessage Interface

All inter-squad messages (inbox and outbox) share a common format:

```typescript
interface SignalMessage {
  id: string;               // UUID, auto-generated
  ts: string;               // ISO 8601 timestamp, auto-generated
  from: string;             // Sender identifier (e.g., "meta-squad" or "my-product")
  type: 'directive' | 'question' | 'report' | 'alert';
  subject: string;          // Brief summary (used in filenames)
  body: string;             // Full message content (Markdown supported)
  acknowledged?: boolean;   // Set to true when recipient has read the message
  acknowledged_at?: string; // ISO 8601 timestamp of acknowledgment
}
```

### Message Types

**directive** — Meta-squad tells a domain squad to do something.
- Direction: meta-squad → domain inbox
- Examples: "Skip repository legacy-utils", "Prioritize authentication analysis", "Pause and wait for schema update"
- Domain squads should check inbox at the start of each playbook step

**question** — Domain squad asks the meta-squad for clarification.
- Direction: domain outbox → meta-squad reads
- Examples: "Found conflicting configurations — which takes precedence?", "Access denied to resource — should I skip?"
- Meta-squad responds with a directive

**report** — Domain squad provides a progress or findings update.
- Direction: domain outbox → meta-squad reads
- Examples: "Discovery phase complete, found 12 repositories", "Critical issue in payment gateway configuration"
- Informational — no response expected unless meta-squad wants to redirect

**alert** — Domain squad flags an urgent issue.
- Direction: domain outbox → meta-squad reads
- Examples: "Resource quota exceeded", "Circular dependency detected across 3 services"
- Meta-squad should review promptly; may require a directive response

### Message File Naming

Messages are saved as JSON files with descriptive names:

```
{timestamp}-{type}-{subject-slug}.json
```

Example: `2024-01-15T10-30-00-000Z-directive-skip-legacy-repo.json`

The timestamp prefix ensures natural chronological ordering when listing directory contents.

## Communication Flows

### Meta-Squad Sends a Directive

1. Meta-squad calls `sendMessage()` with `from: 'meta-squad'` — file is written to the domain's **inbox/**
2. Domain squad checks inbox at the start of its next step (or periodically)
3. Domain squad reads the directive and adjusts behavior
4. Domain squad acknowledges by updating the message file: sets `acknowledged: true` and `acknowledged_at`

```typescript
import { sendMessage } from '${CLAUDE_PLUGIN_ROOT}/scripts/lib/signals.js';

// Meta-squad sends
sendMessage(domainWorktreePath, {
  from: 'meta-squad',
  type: 'directive',
  subject: 'Skip legacy-utils repository',
  body: 'The legacy-utils repository is deprecated and scheduled for deletion. Do not include it in your analysis.',
});
```

### Domain Squad Reports Progress

1. Domain squad calls `sendMessage()` with `from: '{domain-name}'` — file is written to its own **outbox/**
2. Meta-squad reads outbox messages during monitoring
3. If a response is needed, meta-squad sends a directive to the inbox

```typescript
sendMessage(domainWorktreePath, {
  from: 'my-product',
  type: 'report',
  subject: 'Discovery phase complete',
  body: 'Found 12 repositories, 3 data stores, and 2 external integrations. Moving to analysis phase.',
});
```

### Domain Squad Asks a Question

1. Domain squad writes a `question` to its outbox
2. Meta-squad notices during monitoring and evaluates
3. Meta-squad responds with a `directive` in the domain's inbox
4. Domain squad reads the answer and continues

### Acknowledgment Flow

When a domain squad processes an inbox message, it should acknowledge:

```typescript
import { readMessages, acknowledgeMessage } from '${CLAUDE_PLUGIN_ROOT}/scripts/lib/signals.js';

const messages = readMessages(worktreePath, 'inbox');
for (const msg of messages) {
  if (!msg.acknowledged) {
    // Process the message...
    acknowledgeMessage(worktreePath, msg.id, 'inbox');
  }
}
```

Unacknowledged messages in the inbox indicate the domain squad has not yet processed them. The monitor dashboard highlights these.

## Inbox Checking Protocol

Domain squads should check their inbox at these points:

1. **Before each playbook step** — read and process all unacknowledged directives
2. **After recovering from an error** — meta-squad may have sent instructions
3. **When resuming from paused state** — the resume directive is in the inbox
4. **Periodically during long steps** — every 5-10 minutes for responsiveness

Process directives in chronological order (oldest first). Acknowledge each after processing.

## OTel Integration

Instrument signal operations with telemetry for visibility in the observability dashboard.

### When to Emit Telemetry

- **otel_span**: wrap inbox-check and message-processing in a span. Name: `signal.check_inbox` or `signal.process_directive`.
- **otel_event**: emit when a status transition occurs. Name: `signal.state_change`. Attributes: `squad.domain`, `signal.from_state`, `signal.to_state`.
- **otel_metric**: count messages sent and received. Names: `signal.messages_sent`, `signal.messages_received`. Attributes: `squad.domain`, `signal.type`.
- **otel_log**: log directive content at `info` level when processing. Log errors at `error` level when a message cannot be parsed.

### Attribute Conventions

All signal telemetry should include:
- `squad.domain` — the domain name
- `squad.agent` — the agent processing the signal (if applicable)
- `signal.type` — message type (directive, question, report, alert)
- `signal.direction` — `inbound` or `outbound`

## Example: Full Directive Round-Trip

```
1. Meta-squad operator runs:
   monitor.ts --send my-product --directive "Focus on authentication endpoints"

2. File created:
   worktrees/my-product/.squad/signals/inbox/
     2024-01-15T14-00-00-000Z-directive-focus-on-authentication-endpoints.json

3. Domain squad checks inbox at next step boundary.
   Reads directive, adjusts analysis priorities.
   Sets acknowledged: true on the message file.

4. Domain squad writes report to outbox:
   worktrees/my-product/.squad/signals/outbox/
     2024-01-15T14-10-00-000Z-report-authentication-analysis-started.json

5. Meta-squad sees the report in next monitor poll.
```

## Troubleshooting

- **Status file missing**: domain was not properly initialized. Re-run `onboard.ts` or `launch.ts`.
- **Inbox messages not acknowledged**: domain squad may be stuck. Check if the Copilot session is still running.
- **Outbox messages piling up**: meta-squad is not polling. Run `monitor.ts` to read outbox.
- **Status stuck on same timestamp**: domain session likely crashed. Check process list, then re-launch with `launch.ts --step {current-step}`.
- **Message parsing errors**: validate JSON manually with `cat {message-file} | python3 -m json.tool`.

## Message Volume and Retention

Signal files accumulate over the life of a scan. A typical domain scan produces:
- 1 status.json (overwritten on each update)
- 2-5 inbox messages (directives from meta-squad)
- 5-15 outbox messages (reports, questions, alerts)

Do not clean up signal files during a scan — they form an audit trail. After aggregation is complete and the scan is archived, the entire `.squad/signals/` directory can be cleared for the next run via `launch.ts --reset`.

## Concurrency Safety

The signal protocol is file-based and designed for single-writer scenarios:
- **status.json**: only the domain squad writes; meta-squad only reads.
- **inbox/**: only the meta-squad writes; domain squad only reads (and acknowledges in-place).
- **outbox/**: only the domain squad writes; meta-squad only reads.

This eliminates race conditions. Each file has exactly one writer. If multiple meta-squad operators need to send directives, coordinate to avoid conflicting instructions (the protocol does not enforce ordering across multiple senders).

## Anti-Patterns

- Never write directly to another domain's signal directory from a domain squad. Only the meta-squad writes to inboxes.
- Never delete signal files. They form an audit trail. Let them accumulate.
- Never modify status.json from the meta-squad side — it is owned by the domain squad. Use directives to request state changes.
- Never send directives faster than the domain can process them. Check acknowledgment before sending follow-ups.
- Never use signals for large data transfer. Signals are for coordination, not payloads. If a domain needs to share data, write it to a file in the worktree and reference the path in a report message.
