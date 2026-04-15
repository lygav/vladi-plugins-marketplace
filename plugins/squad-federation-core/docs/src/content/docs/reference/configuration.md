---
title: Configuration
description: Federation configuration schema and team registry format
---

# Configuration

Squad Federation uses two configuration files: **federate.config.json** (federation-wide settings) and **.squad/team-registry.json** (registered teams).

## federate.config.json

Located at the root of your repository. Created when you set up federation using the federation-setup skill.

### Schema

```typescript
interface FederateConfig {
  // Optional: Federation description
  description?: string;
  
  // Optional: Telemetry settings
  telemetry?: {
    enabled?: boolean;        // Default: true
    aspire?: {
      endpoint?: string;      // OpenTelemetry endpoint
    };
  };
  
  // Optional: Teams channel for meta-squad notifications
  teamsConfig?: {
    teamId: string;           // MS Teams team ID
    channelId: string;        // MS Teams channel ID
  };
  
  // Optional: Playbook skill name
  playbookSkill?: string;     // Default: 'domain-playbook'
  
  // Optional: Deliverable file name
  deliverable?: string;       // Default: 'deliverable.md'
  
  // Optional: Deliverable schema file
  deliverableSchema?: string;
  
  // Optional: Import hook for custom initialization
  importHook?: string;
  
  // Optional: Periodic heartbeat for unattended monitoring
  heartbeat?: {
    enabled?: boolean;          // Default: false
    intervalSeconds?: number;   // Default: 300
  };
}
```

### Example (Minimal)

```json
{
  "description": "Development federation for product API",
  "telemetry": {
    "enabled": true
  },
  "playbookSkill": "domain-playbook",
  "deliverable": "deliverable.md",
  "heartbeat": {
    "enabled": true,
    "intervalSeconds": 300
  }
}
```

### Example (With Teams Notifications)

```json
{
  "description": "Cross-team coordination with Teams updates",
  "teamsConfig": {
    "teamId": "19:abc123...",
    "channelId": "19:xyz789..."
  },
  "telemetry": {
    "enabled": true,
    "aspire": {
      "endpoint": "http://localhost:18888"
    }
  }
}
```

### Fields Reference

#### `description`

**Optional.** Human-readable description of this federation's purpose.

#### `telemetry`

**Optional.** OpenTelemetry configuration for monitoring team activity.

**Defaults:**
- `telemetry.enabled` = `true`
- `telemetry.aspire.endpoint` = `http://localhost:18888` (if enabled)

#### `teamsConfig`

**Optional.** Microsoft Teams channel for meta-squad notifications. When configured, the meta-squad skill layer posts summaries and polls for `#directive` messages from the user via the Teams MCP tools (`PostChannelMessage`, `ListChannelMessages`).

- `teamId` — Teams team GUID (find it in Teams admin or by using the `ListTeams` MCP tool)
- `channelId` — Channel ID within that team (format: `19:...@thread.tacv2`, find via `ListChannels` MCP tool)

**How it's used:**
- The federation-orchestration skill reads `teamsConfig` and, when present, posts status summaries to the channel after every monitoring cycle or heartbeat
- The heartbeat session polls the channel for messages containing `#directive` and acts on them as user commands
- This is entirely handled at the skill layer — no Teams SDK or API keys needed, the MCP tools handle authentication natively

**Example:**
```json
{
  "teamsConfig": {
    "teamId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "channelId": "19:meeting_ABC123@thread.tacv2"
  }
}
```

See [Teams Notifications](/vladi-plugins-marketplace/guides/monitoring#teams-notifications) and [Teams as meta notification channel](/vladi-plugins-marketplace/guides/communication-transports#teams-notifications-meta-squad-channel) for usage details.

#### `playbookSkill`

**Optional.** Skill file name for domain-specific team instructions.

**Default:** `domain-playbook`

Teams look for `.squad/skills/{playbookSkill}.md` in their workspace.

#### `deliverable`

**Optional.** Output file name for team results.

**Default:** `deliverable.md`

#### `deliverableSchema`

**Optional.** Path to JSON schema file for validating deliverable output.

#### `importHook`

**Optional.** Path to custom TypeScript module for federation initialization hooks.

**Example:**
```json
{
  "importHook": "./hooks/federation-setup.ts"
}
```

#### `heartbeat`

**Optional.** Configures periodic unattended health checks. When enabled, the meta-squad spawns fresh Copilot sessions on a timer to check team status, relay signals, and post summaries.

- `enabled` — Whether heartbeat auto-starts with federation orchestration. **Default:** `false`
- `intervalSeconds` — Seconds between heartbeat checks. **Default:** `300`

**Example:**
```json
{
  "heartbeat": {
    "enabled": true,
    "intervalSeconds": 300
  }
}
```

## .squad/team-registry.json

Tracks all registered teams. Managed automatically by the system—do not edit manually.

### Schema

```typescript
interface TeamRegistry {
  lastUpdated: string;
  lockVersion: number;
  teams: TeamRegistryEntry[];
}

interface TeamRegistryEntry {
  domain: string;
  domainId: string;
  archetypeId: string;
  placementType: 'worktree' | 'directory';
  onboardedAt: string;
  location: string;
  status?: 'active' | 'paused' | 'archived';
  lastActive?: string;
}
```

### Example

```json
{
  "lastUpdated": "2025-01-30T12:00:00Z",
  "lockVersion": 5,
  "teams": [
    {
      "domain": "backend-api",
      "domainId": "backend-api",
      "archetypeId": "coding",
      "placementType": "worktree",
      "onboardedAt": "2025-01-30T10:00:00Z",
      "location": "/path/to/repo/.squad/worktrees/backend-api",
      "status": "active",
      "lastActive": "2025-01-30T11:50:00Z"
    },
    {
      "domain": "docs-team",
      "domainId": "docs-team",
      "archetypeId": "deliverable",
      "placementType": "directory",
      "onboardedAt": "2025-01-30T10:15:00Z",
      "location": "/path/to/repo/.squad/teams/docs-team",
      "status": "active"
    }
  ]
}
```

### Fields Reference

#### `lastUpdated`

ISO timestamp of last registry modification.

#### `lockVersion`

Incremented on every write. Used for optimistic concurrency control—prevents simultaneous edits from clobbering each other.

#### `teams[]`

Array of registered team entries.

##### `domain`

Human-friendly team name (e.g., `backend-api`).

##### `domainId`

Unique team identifier (usually same as `domain`).

##### `archetypeId`

Archetype the team was onboarded with (`coding`, `deliverable`, `consultant`, or custom).

##### `placementType`

Where the team workspace lives:
- `worktree` — Git worktree (isolated branch)
- `directory` — Subdirectory in `.squad/teams/`

##### `onboardedAt`

ISO timestamp when team was created.

##### `location`

Absolute path to team workspace.

##### `status`

**Optional.** Team status:
- `active` — Currently working
- `paused` — Manually paused
- `archived` — Work complete, no longer active

##### `lastActive`

**Optional.** ISO timestamp of last activity (signal sent, status update, etc.).

## Environment Variables

Squad Federation recognizes these environment variables:

### `SQUAD_TELEMETRY_ENABLED`

Override `telemetry.enabled` from config.

**Values:** `true` | `false`

**Example:**
```bash
SQUAD_TELEMETRY_ENABLED=false npx tsx scripts/launch.ts --team backend-api
```

### `OTEL_EXPORTER_OTLP_ENDPOINT`

Override `telemetry.aspire.endpoint` from config.

**Example:**
```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 npx tsx scripts/monitor.ts
```

## Validation

The SDK validates configuration on load:

**Checks:**
- If `teamsConfig` is present, `teamsConfig.teamId` and `teamsConfig.channelId` are valid strings
- Numeric fields (e.g., `lockVersion`) are integers
- Timestamps are valid ISO 8601 strings

**Throws:** `ConfigValidationError` if validation fails.

## Next Steps

- [Understand signal protocol](/vladi-plugins-marketplace/reference/signal-protocol)
- [Explore SDK types](/vladi-plugins-marketplace/reference/sdk-types)
- [View scripts reference](/vladi-plugins-marketplace/reference/scripts)
