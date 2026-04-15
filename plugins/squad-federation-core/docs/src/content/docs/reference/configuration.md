---
title: Configuration
description: federate.config.json schema and all configuration options
---

# Configuration

Squad Federation is configured via `federate.config.json` at the repository root.

## File Location

```
your-repo/
├── federate.config.json    ← Federation configuration
├── .squad/
│   ├── teams.json          ← Team registry (auto-generated)
│   ├── skills/             ← Shared skills
│   └── learnings/
│       └── log.jsonl       ← Learning log
├── .worktrees/             ← Team worktrees (if using worktree placement)
└── ... (project files)
```

## Minimal Configuration

```json
{
  "federationName": "my-project"
}
```

Defaults:
- `communicationType`: `"file-signal"`
- `telemetry.enabled`: `false`

## Full Configuration

```json
{
  "federationName": "my-project",
  "communicationType": "teams-channel",
  "teamsConfig": {
    "teamId": "abc-123-def-456",
    "channelId": "xyz-789-uvw-012"
  },
  "telemetry": {
    "enabled": true,
    "aspire": true
  }
}
```

## Schema

### `federationName` (required)

**Type:** `string`

**Description:** Unique identifier for this federation.

**Example:**
```json
{
  "federationName": "acme-web-app"
}
```

**Validation:**
- Must be non-empty
- Recommended: kebab-case

### `communicationType` (optional)

**Type:** `"file-signal" | "teams-channel"`

**Default:** `"file-signal"`

**Description:** How teams exchange signals.

**Values:**
- `"file-signal"` - JSON files in `.squad/signals/` (default)
- `"teams-channel"` - Microsoft Teams channel with hashtag protocol

**Example:**
```json
{
  "communicationType": "file-signal"
}
```

### `teamsConfig` (conditional)

**Type:** `object`

**Required when:** `communicationType` is `"teams-channel"`

**Fields:**

#### `teamsConfig.teamId`

**Type:** `string` (GUID)

**Description:** Microsoft Teams team identifier.

**How to get:**
1. Open Teams → Click team name → "Get link to team"
2. Extract from URL: `teams.microsoft.com/...?groupId={teamId}`

**Example:**
```json
{
  "teamsConfig": {
    "teamId": "abc-123-def-456-ghi-789"
  }
}
```

#### `teamsConfig.channelId`

**Type:** `string` (GUID)

**Description:** Microsoft Teams channel identifier.

**How to get:**
1. Right-click channel → "Get link to channel"
2. Extract from URL: `...&threadId={channelId}`

**Example:**
```json
{
  "teamsConfig": {
    "channelId": "19:abc123def456@thread.tacv2"
  }
}
```

### `telemetry` (optional)

**Type:** `object`

**Default:** `{ "enabled": false }`

**Description:** OpenTelemetry configuration.

**Fields:**

#### `telemetry.enabled`

**Type:** `boolean`

**Default:** `false`

**Description:** Enable OpenTelemetry instrumentation.

**Example:**
```json
{
  "telemetry": {
    "enabled": true
  }
}
```

#### `telemetry.aspire`

**Type:** `boolean`

**Default:** `false`

**Description:** Enable Aspire Dashboard compatibility mode.

**Example:**
```json
{
  "telemetry": {
    "enabled": true,
    "aspire": true
  }
}
```

**Environment Variables:**

When `telemetry.enabled` is `true`, set:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_SERVICE_NAME=squad-federation
```

## Example Configurations

### Local Development (File Signals)

```json
{
  "federationName": "local-dev",
  "communicationType": "file-signal"
}
```

**Use case:** Solo developer or small team, git-based workflow.

### Team Collaboration (Teams Channel)

```json
{
  "federationName": "acme-web-app",
  "communicationType": "teams-channel",
  "teamsConfig": {
    "teamId": "abc-123-def-456",
    "channelId": "19:xyz789@thread.tacv2"
  }
}
```

**Use case:** Multi-person team, real-time notifications, stakeholder visibility.

### Production Monitoring (Telemetry)

```json
{
  "federationName": "prod-federation",
  "communicationType": "file-signal",
  "telemetry": {
    "enabled": true,
    "aspire": true
  }
}
```

**Use case:** CI/CD pipelines, observability dashboards, performance analysis.

## Team-Specific Configuration

Team configuration is stored in the **team registry** (`.squad/teams.json`), not in `federate.config.json`.

### Team Registry Entry

```json
{
  "teams": [
    {
      "domain": "frontend",
      "teamId": "team-abc-123",
      "mission": "Build authentication UI",
      "archetypeId": "coding",
      "placementType": "worktree",
      "placementOptions": {
        "branch": "squad/frontend"
      },
      "createdAt": "2025-01-30T12:00:00Z",
      "updatedAt": "2025-01-30T12:00:00Z"
    }
  ]
}
```

**Fields:**

- `domain` - Team name (slug)
- `teamId` - Unique identifier (GUID)
- `mission` - Team objective
- `archetypeId` - Archetype identifier (e.g., `"coding"`, `"deliverable"`)
- `placementType` - Where files live (`"worktree"`, `"directory"`, `"custom"`)
- `placementOptions` - Type-specific options (see below)
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

### Placement Options

#### Worktree

```json
{
  "placementType": "worktree",
  "placementOptions": {
    "branch": "squad/frontend",
    "worktreePath": ".worktrees/frontend"
  }
}
```

**Fields:**
- `branch` (required) - Git branch name
- `worktreePath` (optional) - Custom worktree path (default: `.worktrees/{domain}`)

#### Directory

```json
{
  "placementType": "directory",
  "placementOptions": {
    "path": "./teams/frontend"
  }
}
```

**Fields:**
- `path` (required) - Absolute or relative directory path

#### Custom

```json
{
  "placementType": "custom",
  "placementOptions": {
    "pluginId": "s3-placement",
    "bucket": "my-bucket",
    "prefix": "teams/frontend/"
  }
}
```

**Fields:** Plugin-defined (see custom placement plugin docs)

## Archetype Configuration

Archetypes are configured in `archetype.json` files within archetype directories.

### Root Archetype Manifest

**Location:** `archetypes/archetype.json`

```json
{
  "archetypes": {
    "coding": {
      "path": "./plugins/squad-archetype-coding",
      "archetypeJson": "./plugins/squad-archetype-coding/archetype.json"
    },
    "deliverable": {
      "path": "./plugins/squad-archetype-deliverable",
      "archetypeJson": "./plugins/squad-archetype-deliverable/archetype.json"
    }
  }
}
```

### Team Archetype Config

**Location:** `{archetypePath}/archetype.json`

```json
{
  "archetypeId": "coding",
  "name": "Coding Team",
  "states": [
    "initializing",
    "scanning",
    "distilling",
    "complete",
    "failed",
    "paused"
  ],
  "skills": [
    "team/skills/git-workflow.md",
    "team/skills/testing-standards.md"
  ]
}
```

**Fields:**

- `archetypeId` (required) - Unique identifier
- `name` (required) - Display name
- `states` (required) - Valid state names
- `skills` (required) - Skill file paths (relative to archetype dir)

## Environment Variables

### Telemetry

**`OTEL_EXPORTER_OTLP_ENDPOINT`**
- OpenTelemetry collector endpoint
- Default: `http://localhost:4318`

**`OTEL_SERVICE_NAME`**
- Service name for telemetry
- Default: `squad-federation`

### Teams Communication

**`MICROSOFT_GRAPH_TOKEN`**
- Bearer token for Microsoft Graph API
- Required when `communicationType` is `"teams-channel"`

## Validation

### JSON Schema

Squad Federation validates `federate.config.json` using Zod schemas.

**Validate manually:**

```typescript
import { z } from 'zod';

const FederationConfigSchema = z.object({
  federationName: z.string(),
  communicationType: z.enum(['file-signal', 'teams-channel']).optional(),
  teamsConfig: z.object({
    teamId: z.string(),
    channelId: z.string()
  }).optional(),
  telemetry: z.object({
    enabled: z.boolean(),
    aspire: z.boolean().optional()
  }).optional()
});

const config = JSON.parse(fs.readFileSync('federate.config.json', 'utf-8'));
FederationConfigSchema.parse(config);  // Throws if invalid
```

### Common Errors

**Missing `federationName`:**
```
Error: Required field 'federationName' not found in config
```

**Solution:** Add `"federationName": "your-name"` to config.

**Invalid `communicationType`:**
```
Error: Invalid enum value. Expected 'file-signal' | 'teams-channel'
```

**Solution:** Use exact string values (no typos).

**Missing `teamsConfig` when using Teams:**
```
Error: teamsConfig required when communicationType is 'teams-channel'
```

**Solution:** Add `teamsConfig` with `teamId` and `channelId`.

## Migration

### v0.4.0 → v0.5.0

**Breaking change:** Placement is now **per-team**, not federation-wide.

**Old config (v0.4.0):**
```json
{
  "federationName": "my-project",
  "placementType": "worktree"
}
```

**New config (v0.5.0):**
```json
{
  "federationName": "my-project"
}
```

Placement is now specified per-team during onboarding:

```bash
npx tsx scripts/onboard.ts \
  --domain frontend \
  --mission "Build auth UI" \
  --archetype coding \
  --placement worktree \
  --branch squad/frontend
```

## Next Steps

- [View SDK type definitions](/reference/sdk-types)
- [Understand the signal protocol](/reference/signal-protocol)
- [Explore script usage](/reference/scripts)
