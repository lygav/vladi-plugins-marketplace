---
title: Federation Setup
description: How the federation-setup skill walks you through configuration
---

# Federation Setup

The **federation-setup skill** guides you through creating your federation configuration conversationally. No manual config file editing needed — the skill asks questions and generates the configuration for you.

## Starting Setup

In Copilot, say:

> "Set up a federation"

or

> "Initialize federation for my project"

The skill activates and begins asking questions.

## The Setup Conversation

### 1. Prerequisites Check

The skill first validates your environment:

✅ **Squad CLI installed?**
- Checks for `squad` command
- If missing: "Install Squad CLI from https://squad.dev/install"

✅ **Git repository initialized?**
- Checks for `.git/`
- If missing: "Run `git init` in your project root"

✅ **Node.js v20+?**
- Checks node version
- If old: "Update Node.js to v20 or later"

✅ **Docker available (optional)?**
- Checks for `docker` command
- If missing: "Install Docker if you want observability dashboard"

If anything fails, the skill provides install instructions and stops. Fix the issues and run setup again.

### 2. What Are You Building?

**Skill asks:**
> "What is this federation for? Describe your project or what you're coordinating."

**You respond with context:**
> "Coordinating frontend, backend, and infrastructure teams for a web application"

or

> "Managing parallel feature teams for a SaaS product"

The skill uses this description to generate helpful defaults and context for teams later.

### 3. Telemetry Setup

**Skill asks:**
> "Want me to set up an observability dashboard? (Requires Docker)"

**Your options:**

**Yes** - Skill enables telemetry and starts the Aspire dashboard automatically:
```json
{
  "telemetry": {
    "enabled": true,
    "aspire": true
  }
}
```

Dashboard runs at `http://localhost:18888` showing traces, metrics, and logs from all teams.

**No** - Telemetry disabled:
```json
{
  "telemetry": {
    "enabled": false
  }
}
```

**Later** - Enabled but dashboard not started (you can run it manually):
```json
{
  "telemetry": {
    "enabled": true
  }
}
```

### 4. Communication Type

**Skill asks:**
> "How should your teams communicate? File signals (default) or Microsoft Teams channel?"

**Your options:**

**File signals** (recommended for most users):
- Fastest, works offline
- Signals stored as JSON files in `.squad/signals/`
- Best for local development and git workflows
- Configuration:
  ```json
  {
    "communicationType": "file-signal"
  }
  ```

**Microsoft Teams channel:**
- Human-visible in Teams chat
- Real-time notifications
- Hashtag protocol routes messages (#meta, #teamId)
- Requires Teams workspace access

If you choose Teams, the skill asks:

> "I need your Teams channel ID. Get it from: Channel → ... → Get link to channel"

Paste the channel link, and the skill extracts the team ID and channel ID automatically:
```json
{
  "communicationType": "teams-channel",
  "teamsConfig": {
    "teamId": "abc-123-def-456",
    "channelId": "xyz-789-uvw-012"
  }
}
```

### 5. Configuration Preview

The skill shows you the final config:

```
📋 Generated Configuration:
━━━━━━━━━━━━━━━━━━━━━━━━
Description: Coordinating frontend, backend, and infrastructure teams
Telemetry: Enabled (Aspire dashboard at http://localhost:18888)
Communication: file-signal

Save to federate.config.json?
```

You confirm, and `federate.config.json` is written to your project root.

### 6. Meta-Squad Casting

**Skill asks:**
> "Want me to cast the meta-squad now? (The meta-squad coordinates cross-team work)"

**Yes** - Skill runs `squad init` in the main repo to create the meta-squad agent.

**No** - You can run `squad init` manually later.

### 7. First Team (Optional)

**Skill asks:**
> "Ready to onboard your first team?"

**Yes** - The team-onboarding skill activates (see [Team Onboarding](/vladi-plugins-marketplace/guides/team-onboarding))

**No** - Setup completes. You can onboard teams anytime:
> "Spin up a team for frontend"

## What Gets Created

After setup, your repository contains:

```
my-project/
├── federate.config.json     # Federation configuration
├── .squad/
│   ├── teams.json           # Team registry (empty initially)
│   ├── skills/              # Shared skills directory
│   └── decisions/           # Decision tracking
```

If telemetry is enabled, each team workspace also gets `.mcp.json` with the OpenTelemetry MCP server config.

## Configuration Options Explained

### Communication: File Signal vs Teams

**File Signal:**
- Teams write signals to `.squad/signals/inbox/` and `outbox/`
- Fast, local, works offline
- Signals are JSON files with metadata
- Acknowledgments via `.ack` files
- Best for: Git workflows, debugging, local development

**Teams Channel:**
- Signals posted as Adaptive Cards to Teams chat
- Hashtag routing: `#meta`, `#frontend`, `#backend`
- Human-visible, real-time updates
- Best for: Collaborative oversight, stakeholder visibility

### Telemetry: Dashboard vs None

**With Dashboard (aspire: true):**
- Aspire dashboard auto-starts in Docker
- View at `http://localhost:18888`
- See traces, metrics, logs from all teams
- Each team gets an MCP server for telemetry export

**Without Dashboard (enabled: true):**
- Telemetry enabled but no dashboard
- Export to custom OTLP endpoint:
  ```bash
  export OTEL_EXPORTER_OTLP_ENDPOINT=http://your-collector:4318
  ```

**Disabled (enabled: false):**
- No telemetry overhead
- Lighter resource usage

## Advanced Configuration

After initial setup, you can edit `federate.config.json` to add advanced options:

### Custom Deliverable Files

```json
{
  "deliverable": "OUTPUT.md",
  "deliverableSchema": "schemas/output.schema.json"
}
```

Teams produce the specified deliverable file, validated against the JSON schema.

### Import Hooks

```json
{
  "importHook": "scripts/import-context.sh"
}
```

Run custom script during team onboarding to inject domain-specific context.

### Playbook Skill Override

```json
{
  "playbookSkill": "custom-playbook"
}
```

Teams look for `.squad/skills/{playbookSkill}/SKILL.md` instead of the default.

## Troubleshooting Setup

### "Squad CLI not found"

Install Squad CLI:
```bash
npm install -g @squadai/cli
```

Or follow install instructions at https://squad.dev/install

### "Not a git repository"

Initialize git in your project:
```bash
cd /path/to/your/project
git init
```

### "Docker not available" (but you want telemetry)

Install Docker Desktop, then re-run setup and answer "Yes" to dashboard.

### Config file already exists

The skill won't overwrite existing `federate.config.json`. If you want to reconfigure:

1. Backup your current config: `mv federate.config.json federate.config.backup.json`
2. Run setup again
3. Merge any custom settings from the backup

## Script Reference

While the skill handles setup conversationally, you can inspect what was created:

**Validate config:**
```bash
npx tsx path/to/squad-federation-core/scripts/validate-config.ts
```

**View registry:**
```bash
cat .squad/teams.json
```

**Manually start dashboard** (if telemetry enabled but aspire: false):
```bash
docker run -p 18888:18888 -p 4318:18889 \
  mcr.microsoft.com/dotnet/aspire-dashboard:latest
```

## Next Steps

- [Onboard your first team](/vladi-plugins-marketplace/guides/team-onboarding)
- [Learn about communication protocols](/vladi-plugins-marketplace/guides/communication-transports)
- [Set up monitoring](/vladi-plugins-marketplace/guides/monitoring)
