---
title: Federation Setup
description: Detailed guide to initializing and configuring a Squad Federation
---

# Federation Setup

Setting up a Squad Federation involves creating the configuration file, choosing placement and communication strategies, and preparing the repository structure.

## Configuration File

Every federation requires a `federate.config.json` in the repository root.

### Minimal Configuration

```json
{
  "description": "My project federation",
  "telemetry": {
    "enabled": true
  },
  "communicationType": "file-signal"
}
```

### Complete Configuration

```json
{
  "description": "Multi-team product development",
  "telemetry": {
    "enabled": true,
    "aspire": true
  },
  "communicationType": "teams-channel",
  "teamsConfig": {
    "teamId": "abc-123-def-456",
    "channelId": "xyz-789-uvw-012"
  },
  "playbookSkill": "domain-playbook",
  "deliverable": "DELIVERABLE.md",
  "deliverableSchema": "schemas/output.json",
  "importHook": "scripts/import-context.sh"
}
```

## Communication Type Selection

### File-Signal (Default)

**When to use:**
- Local or git-based workflows
- Offline capability needed
- Debugging signals directly
- No Teams integration required

**How it works:**
- Signals written as JSON files to `.squad/signals/inbox/` and `outbox/`
- Teams poll their inbox on status updates
- Acknowledgments via `.ack` files

**Configuration:**
```json
{
  "communicationType": "file-signal"
}
```

No additional config needed.

### Teams Channel

**When to use:**
- Human oversight of team communication
- Integration with existing Teams workflows
- Real-time notifications
- Collaborative monitoring

**How it works:**
- Teams post signals as Adaptive Cards to a shared channel
- Hashtag protocol for routing (`#meta`, `#teamId`, etc.)
- Messages appear in Teams chat for visibility

**Configuration:**
```json
{
  "communicationType": "teams-channel",
  "teamsConfig": {
    "teamId": "your-teams-team-id",
    "channelId": "your-channel-id"
  }
}
```

**Getting Team/Channel IDs:**
```bash
# Use Microsoft Graph API or Teams admin center
# Team ID: Settings → Get link to team
# Channel ID: Channel → Get link to channel
```

## Telemetry Setup

### Basic Telemetry

```json
{
  "telemetry": {
    "enabled": true
  }
}
```

This enables OpenTelemetry instrumentation. Set the endpoint:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_SERVICE_NAME=squad-federation
```

If `OTEL_EXPORTER_OTLP_ENDPOINT` is not set, telemetry is a no-op (no errors).

### .NET Aspire Dashboard Integration

```json
{
  "telemetry": {
    "enabled": true,
    "aspire": true
  }
}
```

Run the Aspire dashboard:

```bash
docker run -p 18888:18888 -p 4318:18889 \
  mcr.microsoft.com/dotnet/aspire-dashboard:latest
```

Access at `http://localhost:18888`. Traces and metrics appear automatically.

## Placement Strategies

Placement is configured **per-team** during onboarding, not in `federate.config.json`.

### Git Worktree Placement (Default)

**Characteristics:**
- Each team gets a git branch (`squad/{domain}`)
- Worktree at `.worktrees/{domain}/`
- Git operations: commit, push, create PR
- Cross-branch reading via `git show`

**Use when:**
- Teams need version history
- PR workflow for team → main
- Meta-squad sweeps learnings across branches
- Parallel team development

**Onboard command:**
```bash
npx tsx scripts/onboard.ts \
  --name "my-team" \
  --domain-id "team-001" \
  --archetype "squad-archetype-coding" \
  --placement worktree \
  --worktree-dir .worktrees  # or ../worktrees or /custom/path
```

**Directory options:**
- `.worktrees` (default) - Inside repository
- `../` - Sibling to repository (keeps repo clean)
- `/absolute/path` - Custom location

### Directory Placement

**Characteristics:**
- Standalone directory (no git integration)
- Standard filesystem operations
- No commit/push/PR features
- Lighter weight

**Use when:**
- Teams don't need git history
- External system integration
- Custom storage backends
- Ephemeral team workspaces

**Onboard command:**
```bash
npx tsx scripts/onboard.ts \
  --name "my-team" \
  --domain-id "team-001" \
  --archetype "squad-archetype-deliverable" \
  --placement directory \
  --path /path/to/team/directory
```

### Mixing Placement Types

v0.4.0+ allows different teams to use different placement strategies within the same federation:

```bash
# Team A: worktree
npx tsx scripts/onboard.ts --name "frontend" --domain-id "fe-1" --placement worktree

# Team B: directory
npx tsx scripts/onboard.ts --name "backend" --domain-id "be-1" --placement directory --path /var/teams/backend
```

All teams communicate via the **same** protocol (file-signal or teams-channel, set in `federate.config.json`).

## Repository Structure

After setup, your repository will look like:

```
my-project/
├── federate.config.json          # Federation config
├── .squad/
│   ├── teams.json                 # Team registry
│   ├── teams.json.lock            # Registry lock file
│   ├── skills/                    # Federation-wide skills
│   │   ├── domain-playbook/
│   │   └── testing-strategy/
│   └── decisions/inbox/           # Decision proposals
├── .worktrees/                    # Team worktrees (if using worktree placement)
│   ├── frontend/
│   ├── backend/
│   └── infra/
└── plugins/
    └── squad-federation-core/     # Plugin installation
```

## Validation

After creating `federate.config.json`, validate it:

```bash
npx tsx scripts/validate-config.ts
```

This checks:
- Required fields present
- Valid communication type
- `teamsConfig` provided if using teams-channel
- Telemetry settings correct

## Advanced Options

### Custom Playbook Skill

```json
{
  "playbookSkill": "my-custom-playbook"
}
```

Teams look for `.squad/skills/{playbookSkill}/SKILL.md` to understand their domain.

### Deliverable Schema

```json
{
  "deliverable": "OUTPUT.json",
  "deliverableSchema": "schemas/team-output.schema.json"
}
```

Teams validate their output against this JSON schema before marking complete.

### Import Hook

```json
{
  "importHook": "scripts/import-team-context.sh"
}
```

Run custom script during team onboarding to import domain-specific context.

## Migration from v0.3.x

If upgrading from v0.3.x:

1. **Create `federate.config.json`** with your settings
2. **Run registry migration:**
   ```bash
   npx tsx scripts/migrate-registry.ts
   ```
3. **Verify teams registered:**
   ```bash
   cat .squad/teams.json | jq
   ```

## Next Steps

- [Onboard your first team](/guides/team-onboarding)
- [Choose communication transport](/guides/communication-transports)
- [Set up monitoring](/guides/monitoring)
