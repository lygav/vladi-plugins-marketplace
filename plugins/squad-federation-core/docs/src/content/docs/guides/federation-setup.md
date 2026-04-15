---
title: Federation Setup
description: How the federation-setup skill walks you through configuration
---

# Federation Setup

The **federation-setup skill** guides you through creating your federation configuration conversationally. Under the hood, it delegates to `scripts/setup.ts` for all mechanical work — config generation, file writing, and prerequisite validation — following the ADR-001 script-drives-skill model.

## Starting Setup

In Copilot, say:

> "Set up a federation"

or

> "Initialize federation for my project"

The skill activates and begins asking questions.

## The Setup Conversation

### 1. Prerequisites Check

The `setup.ts` script validates your environment automatically:

✅ **Git 2.20+ installed?**
- If missing or too old: provides install/upgrade instructions

✅ **Git repository initialized?**
- If not in a repo: "Run `git init` in your project root"

✅ **Node.js v20+?**
- If old: "Update Node.js to v20 or later with `nvm install 20`"

⚠️ **Squad CLI installed? (optional)**
- If missing: warns but continues — install later

⚠️ **Docker available? (optional)**
- If missing: notes the OTel dashboard won't be available

⚠️ **Uncommitted changes?**
- Warns but doesn't block

If any required check (git, git repo, Node.js) fails, the script stops. Fix the issues and retry.

### 2. What Are You Building?

**Skill asks:**
> "What is this federation for? Describe your project or what you're coordinating."

**You respond with context:**
> "Coordinating frontend, backend, and infrastructure teams for a web application"

### 3. Telemetry Setup

**Skill asks:**
> "Want me to set up an observability dashboard? (Requires Docker)"

**Yes** — Telemetry enabled with OTel endpoint:
```json
{
  "telemetry": {
    "enabled": true,
    "endpoint": "http://localhost:4318"
  }
}
```

Dashboard runs at `http://localhost:18888` showing traces, metrics, and logs from all teams.

**No** — Telemetry disabled:
```json
{
  "telemetry": {
    "enabled": false
  }
}
```

### 4. Teams Notifications (Optional)

Optionally enable **Teams notifications** so the meta-squad posts summaries to a Microsoft Teams channel:

```json
{
  "teamsConfig": {
    "teamId": "abc-123-def-456",
    "channelId": "19:xxxxx@thread.tacv2"
  }
}
```

### 5. Heartbeat (Optional)

**Skill asks:**
> "Enable periodic heartbeat monitoring?"

The heartbeat spawns unattended Copilot sessions at a regular interval (default: 5 minutes) to check team status and post summaries.

```json
{
  "heartbeat": {
    "enabled": true
  }
}
```

### 6. Configuration Generated

The skill calls `setup.ts` with all collected preferences:

```bash
npx tsx scripts/setup.ts \
  --description "Your description" \
  --telemetry --telemetry-endpoint http://localhost:4318 \
  --heartbeat \
  --non-interactive --output-format json
```

The script writes `federate.config.json`, initializes `.squad/`, and creates the team registry.

### 7. Meta-Squad Casting

The skill checks if the meta-squad has members and initiates casting if needed. This stays in the skill (not the script) because it involves Squad framework interaction.

### 8. First Team (Optional)

**Skill asks:**
> "Ready to onboard your first team?"

**Yes** — The team-onboarding skill activates (see [Team Onboarding](/vladi-plugins-marketplace/guides/team-onboarding))

**No** — Setup completes. Onboard teams anytime:
> "Spin up a team for frontend"

## What Gets Created

After setup, your repository contains:

```
my-project/
├── federate.config.json     # Federation configuration
├── .squad/
│   ├── teams.json           # Team registry (empty initially)
│   └── team.md              # Meta-squad roster (from squad init)
```

## Running setup.ts Directly

You can also run the setup script directly (bypassing the skill):

```bash
# Minimal setup
npx tsx scripts/setup.ts --description "My federation" --non-interactive

# Full setup with JSON output
npx tsx scripts/setup.ts \
  --description "Coordinate security audits" \
  --telemetry --telemetry-endpoint http://localhost:4318 \
  --teams-notification --teams-team-id xxx --teams-channel-id 19:xxx@thread.tacv2 \
  --heartbeat --heartbeat-interval 300 \
  --non-interactive --output-format json

# Dry run (validate without writing files)
npx tsx scripts/setup.ts --description "test" --dry-run --output-format json
```

See the [Scripts Reference](/vladi-plugins-marketplace/reference/scripts) for full flag documentation.

## Troubleshooting Setup

### "Prerequisites failed"

The `setup.ts` script checks git, Node.js, and git repo status. Fix any failures and retry.

### "Docker not available" (but you want telemetry)

Install Docker Desktop, then re-run setup. Telemetry still works without Docker — you just won't get the Aspire dashboard.

### Config file already exists

The script overwrites `federate.config.json`. If you want to preserve the old config, back it up first:
```bash
cp federate.config.json federate.config.backup.json
```

## Next Steps

- [Onboard your first team](/vladi-plugins-marketplace/guides/team-onboarding)
- [Learn about communication protocols](/vladi-plugins-marketplace/guides/communication-transports)
- [Set up monitoring](/vladi-plugins-marketplace/guides/monitoring)
