---
title: Scripts Reference
description: Under-the-hood automation scripts for federation management
---

# Scripts Reference

Squad Federation includes TypeScript automation scripts in `scripts/`. These power the conversational skills you interact with via Copilot—you typically won't run them directly.

## What These Scripts Do

The **federation skills** (federation-setup, federation-orchestration, etc.) call these scripts under the hood when you use natural language. For example:

**You say:** "Onboard a coding team for the backend API"

**Copilot calls:** `npx tsx scripts/onboard.ts --archetype coding --domain backend-api ...`

This page documents the scripts for reference and troubleshooting, but you should **use the Copilot skills as your primary interface**.

## Core Scripts

### `setup.ts`

**What it does:** Initializes a new federation — validates prerequisites, writes `federate.config.json`, creates `.squad/` directory, and initializes team registry. Implements the **script-drives-skill** model (ADR-001) — the script owns all setup logic; the `federation-setup` skill is a thin conversational wrapper.

**Called by:** `federation-setup` skill (via `--non-interactive --output-format json`)

**Parameters:**
- `--description <text>` — Federation description *(required)*
- `--telemetry` / `--no-telemetry` — Enable/disable telemetry *(default: enabled)*
- `--telemetry-endpoint <url>` — OTel endpoint URL
- `--teams-notification` — Enable Teams notifications
- `--teams-team-id <id>` — Teams workspace ID *(required with `--teams-notification`)*
- `--teams-channel-id <id>` — Teams channel ID *(required with `--teams-notification`)*
- `--non-interactive` — No stdin prompts; all params via flags *(for CI/skill use)*
- `--output-format <text|json>` — Output format; `json` produces structured `SetupResult`
- `--dry-run` — Validate prerequisites without creating anything

**What it creates:**
```
federate.config.json             # Federation configuration
.squad/
  teams.json                     # Team registry (empty)
  team.md                        # Squad roster (from squad init)
```

**Example (non-interactive with JSON output):**
```bash
npx tsx scripts/setup.ts \
  --description "Coordinate security audits" \
  --telemetry --telemetry-endpoint http://localhost:4318 \
  --non-interactive \
  --output-format json
```

**Example (dry run):**
```bash
npx tsx scripts/setup.ts \
  --description "test" \
  --dry-run --non-interactive --output-format json
```

**JSON output structure (`SetupResult`):**
```json
{
  "success": true,
  "configPath": "/path/to/federate.config.json",
  "config": {
    "description": "Coordinate security audits",
    "telemetry": { "enabled": true, "endpoint": "http://localhost:4318" }
  },
  "squadDir": "/path/to/.squad",
  "registryPath": "/path/to/.squad/teams.json",
  "prerequisites": [
    { "name": "git", "status": "ok", "version": "2.43.0" },
    { "name": "node", "status": "ok", "version": "v20.11.0" }
  ],
  "dryRun": false
}
```

---

### `onboard.ts`

**What it does:** Creates a new team workspace, seeds archetype files, registers team in `.squad/team-registry.json`. Implements the **script-drives-skill** model (ADR-001) — the script owns all onboarding logic; skills are thin wrappers.

**Called by:** `team-onboarding` skill (via `--non-interactive --output-format json`)

**Parameters:**
- `--name <name>` / `--team <name>` — Team domain name *(required)*
- `--archetype <id>` — Archetype to use (coding, deliverable, consultant, or custom) *(required)*
- `--domain-id <uuid>` — Domain identifier *(auto-generated if omitted)*
- `--description <text>` / `--mission <text>` — Team mission/description
- `--placement <type>` — `worktree` (default) or `directory`
- `--worktree-dir <path>` — Base directory for worktree (default: `.worktrees`)
- `--path <path>` — Directory path (required when `--placement directory`)
- `--base-branch <name>` — Git branch to create worktree from (default: current branch)
- `--roles <roles>` — Comma-separated agent roles to cast (default: from archetype `defaultTeam`)
- `--universe <id>` — Casting universe theme: `usual-suspects` or `oceans-eleven` (default: `usual-suspects`)
- `--non-interactive` — No stdin prompts; all params via flags *(for CI/skill use)*
- `--output-format <text|json>` — Output format; `json` produces structured `OnboardResult`
- `--dry-run` — Validate inputs without creating anything; returns what *would* happen

**What it creates:**
```
.worktrees/{name}/               (if placement=worktree)
OR {path}/{name}/                (if placement=directory)
  DOMAIN_CONTEXT.md
  .squad/
    agents/{name}/charter.md     (for each cast agent)
    agents/{name}/history.md
    team.md                      (members table)
    routing.md                   (routing rules)
    decisions.md
    decisions/inbox/
    signals/inbox/
    signals/outbox/
    learnings/
    archetype.json
    ceremonies.md
```

**Example (interactive):**
```bash
npx tsx scripts/onboard.ts \
  --name backend-api \
  --archetype squad-archetype-coding \
  --mission "Build REST API with PostgreSQL"
```

**Example (non-interactive with JSON output):**
```bash
npx tsx scripts/onboard.ts \
  --name backend-api \
  --archetype squad-archetype-coding \
  --mission "Build REST API" \
  --roles lead,developer,tester \
  --universe usual-suspects \
  --non-interactive \
  --output-format json
```

**Example (dry run):**
```bash
npx tsx scripts/onboard.ts \
  --name backend-api \
  --archetype squad-archetype-coding \
  --dry-run --non-interactive --output-format json
```

**JSON output structure (`OnboardResult`):**
```json
{
  "success": true,
  "domain": "backend-api",
  "domainId": "auto-generated-uuid",
  "archetype": "squad-archetype-coding",
  "placement": "worktree",
  "location": "/path/to/.worktrees/backend-api",
  "branch": "squad/backend-api",
  "dryRun": false,
  "team": {
    "members": [
      { "name": "Keyser", "role": "lead", "displayName": "Keyser — Lead" },
      { "name": "McManus", "role": "developer", "displayName": "McManus — Developer" },
      { "name": "Fenster", "role": "tester", "displayName": "Fenster — Tester" }
    ],
    "universe": "usual-suspects"
  }
}
```

---

### `launch.ts`

**What it does:** Starts a headless Copilot session for a team. Implements the **script-drives-skill** model (ADR-001) — the script owns all launch logic; skills are thin wrappers.

**Called by:** `federation-orchestration` skill (via `--non-interactive --output-format json`)

**Parameters:**
- `--team <name>` / `--domain <name>` — Team to launch *(single team)*
- `--teams <a,b,c>` / `--domains <a,b,c>` — Comma-separated teams to launch
- `--all` — Launch all active teams
- `--reset` — Clear state before launching (removes status.json, clears ack files)
- `--step <step>` — Run a single step instead of full playbook
- `--prompt "text"` — Override prompt with inline text
- `--prompt-file <path>` — Override prompt with file contents
- `--non-interactive` — No stdin prompts; all params via flags *(for CI/skill use)*
- `--output-format <text|json>` — Output format; `json` produces structured `LaunchResult`

**Launch guards:**
- Teams with `status: "paused"` or `status: "retired"` are skipped automatically
- In `--all` mode, a summary shows how many teams were skipped
- In targeted mode, each skipped team logs a message

**Headless process details:**
- Spawns Copilot with `stdio: ['pipe', logFile, logFile]` to avoid TTY issues
- stdin is closed immediately after spawn (headless sessions must not wait for input)
- Logs the full command line into `run-output.log` header for debugging
- Registers a spawn error handler that writes errors to the log file

**What it does:**
1. Reads team registry and validates workspace
2. Detects run type (first-run / refresh / reset)
3. Resolves prompt via 4-tier priority chain (see [Launch Mechanics](/vladi-plugins-marketplace/reference/launch-mechanics))
4. Writes OTel MCP config if telemetry enabled
5. Spawns detached Copilot process with command logging
6. Returns structured result with PID and log path

**Example (interactive):**
```bash
npx tsx scripts/launch.ts --team backend-api
npx tsx scripts/launch.ts --team backend-api --reset
npx tsx scripts/launch.ts --team backend-api --step distillation
npx tsx scripts/launch.ts --all
```

**Example (non-interactive with JSON output):**
```bash
npx tsx scripts/launch.ts \
  --team backend-api \
  --non-interactive \
  --output-format json
```

**JSON output structure (`LaunchResult`):**
```json
{
  "success": true,
  "team": "backend-api",
  "domainId": "abc-123",
  "pid": 12345,
  "logFile": "/path/to/.worktrees/backend-api/run-output.log",
  "runType": "first-run"
}
```

**Skipped team result (paused/retired):**
```json
{
  "success": false,
  "team": "legacy-api",
  "domainId": "leg-1",
  "skipped": true,
  "skipReason": "status is \"paused\""
}
```

**Example (interactive):**
```bash
npx tsx scripts/launch.ts --team backend-api
npx tsx scripts/launch.ts --team backend-api --reset
npx tsx scripts/launch.ts --team backend-api --step distillation
npx tsx scripts/launch.ts --all
```

**Example (non-interactive with JSON output):**
```bash
npx tsx scripts/launch.ts \
  --team backend-api \
  --non-interactive \
  --output-format json
```

**JSON output structure (`LaunchResult`):**
```json
{
  "success": true,
  "team": "backend-api",
  "domainId": "abc-123",
  "pid": 12345,
  "logFile": "/path/to/.worktrees/backend-api/run-output.log",
  "runType": "first-run"
}
```

**Skipped team result (paused/retired):**
```json
{
  "success": false,
  "team": "legacy-api",
  "domainId": "leg-1",
  "skipped": true,
  "skipReason": "status is \"paused\""
}
```

---

### `monitor.ts`

**What it does:** Dashboard showing all teams' status + ability to send signals. Implements the **script-drives-skill** model (ADR-001).

**Called by:** `federation-orchestration` skill

**Parameters:**
- `--watch` — (Optional) Live-updating dashboard
- `--send <teamId>` — Send signal to team
- `--directive <text>` — Signal body (when using `--send`)
- `--type <directive|question|report|alert>` — Signal type
- `--output-format <text|json>` — Output format (default: `text`)
- `--non-interactive` — Skip interactive prompts

**Example (manual invocation):**
```bash
# Watch dashboard
npx tsx scripts/monitor.ts --watch

# JSON output for skill consumption
npx tsx scripts/monitor.ts --non-interactive --output-format json

# Send directive with JSON output
npx tsx scripts/monitor.ts \
  --send backend-api \
  --directive "Add rate limiting to login endpoint" \
  --non-interactive --output-format json
```

---

### `offboard.ts`

**What it does:** Manages team lifecycle transitions — retire, pause, or resume teams. Implements the **script-drives-skill** model (ADR-001).

**Called by:** `federation-orchestration` skill

**Parameters:**
- `--team <name>` — Team domain name *(required)*
- `--mode <retire|pause|resume>` — Lifecycle action (default: `retire`)
- `--force` — Skip confirmation prompts
- `--non-interactive` — No stdin prompts; all params via flags *(for CI/skill use)*
- `--output-format <text|json>` — Output format; `json` produces structured `OffboardResult`

**What each mode does:**

| Mode | Status Change | Learnings | Signals | Workspace |
|------|--------------|-----------|---------|-----------|
| `retire` | → retired | Graduated to main | Archived | Removed (worktree) |
| `pause` | → paused | Preserved | Preserved | Preserved |
| `resume` | → active | Preserved | Preserved | Preserved |

**Guard rails:**
- Cannot retire a retired team
- Cannot pause a non-active team
- Cannot resume a non-paused team

**Example (retire with JSON output):**
```bash
npx tsx scripts/offboard.ts \
  --team backend-api \
  --mode retire \
  --non-interactive \
  --output-format json
```

**JSON output structure (`OffboardResult`):**
```json
{
  "success": true,
  "team": "backend-api",
  "mode": "retire",
  "message": "Team \"backend-api\" retired successfully",
  "details": {
    "learningsGraduated": 5,
    "learningsSkipped": 2,
    "graduatedIds": ["learn-1", "learn-2"],
    "signalsArchived": 3,
    "statusUpdated": true,
    "worktreeRemoved": true
  }
}
```

**Example (pause/resume):**
```bash
npx tsx scripts/offboard.ts --team backend-api --mode pause
npx tsx scripts/offboard.ts --team backend-api --mode resume
```

---

### `sweep-learnings.ts`

**What it does:** Analyzes learning logs across teams, detects cross-domain patterns, suggests graduation to skills.

**Called by:** `knowledge-lifecycle` skill

**Parameters:**
- `--output <path>` — (Optional) Where to save findings (default: `.squad/sweep-report.md`)

**What it analyzes:**
- Pattern repetition across teams
- High-confidence learnings
- Frequently tagged topics
- Domain-agnostic insights

**Output format:**
```markdown
# Learning Sweep Report

## Cross-Domain Patterns

### Pattern: JWT token refresh logic
**Confidence:** High
**Teams:** backend-api, auth-service, gateway
**Suggestion:** Graduate to skill `jwt-refresh-pattern.md`

## Graduation Candidates

1. **Learning:** "Always validate JWT signature before parsing claims"
   - **Category:** convention
   - **Tags:** auth, security, jwt
   - **Seen in:** 3 teams
   - **Recommended skill:** `jwt-validation.md`
```

**Example (manual invocation):**
```bash
npx tsx scripts/sweep-learnings.ts
```

---

### `graduate-learning.ts`

**What it does:** Converts a specific learning log entry into a skill file.

**Called by:** `knowledge-lifecycle` skill

**Parameters:**
- `--learning-id <id>` — Learning entry UUID
- `--domain <teamId>` — Team that owns this learning
- `--skill-name <name>` — (Optional) Skill filename (auto-generated if omitted)
- `--global` — (Optional) Graduates to meta skills instead of team-specific

**What it does:**
1. Reads learning entry from team's `.squad/signals/learnings.jsonl`
2. Generates skill markdown with frontmatter
3. Writes to `.squad/skills/{name}.md` (or team's skills directory)
4. Marks learning as `graduated: true` in log

**Example (manual invocation):**
```bash
npx tsx scripts/graduate-learning.ts \
  --learning-id abc-123 \
  --domain backend-api \
  --global
```

---

### `sync-skills.ts`

**What it does:** Copies skills from meta `.squad/skills/` to all teams' `.squad/skills/` directories.

**Called by:** `knowledge-lifecycle` skill

**Parameters:**
- `--skill <name>` — (Optional) Sync specific skill
- `--all` — (Optional) Sync all skills
- `--teams <ids>` — (Optional) Sync to specific teams (comma-separated)

**What it does:**
1. Reads skills from `.squad/skills/`
2. For each team in registry:
   - Checks if team's `.squad/skills/` has the skill
   - Copies if missing or outdated (based on file hash)
3. Logs sync operations

**Example (manual invocation):**
```bash
# Sync all skills to all teams
npx tsx scripts/sync-skills.ts --all

# Sync specific skill to specific teams
npx tsx scripts/sync-skills.ts \
  --skill jwt-validation.md \
  --teams backend-api,auth-service
```

---

### `offboard.ts`

**What it does:** Retires, pauses, or resumes a team.

**Parameters:** `--team`, `--mode retire|pause|resume`, `--force`, `--non-interactive`, `--output-format json`

---

### `teams-presence.ts`

**What it does:** Persistent bridge between a Microsoft Teams channel and the federation. Polls the configured channel via Microsoft Graph API for messages addressing `@<federationName>`, pipes instructions to a persistent Copilot ACP session, and posts results back to the channel.

**Called by:** User (manually or as a background process). Not called by a skill — it *is* the long-running presence daemon.

**Parameters:**
- `--interval <seconds>` — Poll interval in seconds *(default: 30, minimum: 5)*
- `--once` — Run a single poll cycle then exit
- `--stop` — Stop a running presence process (via PID file)
- `--status` — Check if presence is currently running

**Requires in `federate.config.json`:**
- `federationName` — The `@` handle to listen for in Teams
- `teamsConfig.teamId` + `teamsConfig.channelId` — Target Teams channel

**Supporting modules (`scripts/lib/teams-presence/`):**
- `acp-session.ts` — Manages a persistent Copilot ACP session; reads `copilotCommand` from config to resolve the binary
- `graph-client.ts` — Acquires Microsoft Graph API tokens for channel access
- `watermark.ts` — Tracks the last-seen message timestamp to avoid reprocessing
- `poll.ts` — Executes a single poll cycle: fetch messages → filter for `@<federationName>` → relay to ACP → post reply

**Runtime artifacts:**
- `.squad/presence.pid` — PID file for the running process
- `.squad/presence.log` — Append-only log of poll activity

**Example:**
```bash
# Start with default 30s interval
npx tsx scripts/teams-presence.ts

# Custom 15s interval
npx tsx scripts/teams-presence.ts --interval 15

# Single poll then exit (useful for cron / CI)
npx tsx scripts/teams-presence.ts --once

# Check if running
npx tsx scripts/teams-presence.ts --status

# Stop running presence
npx tsx scripts/teams-presence.ts --stop
```

See the **[Teams Presence guide](/vladi-plugins-marketplace/guides/teams-presence)** for architecture details and usage patterns.

---

## Helper Scripts

### `init-federation.ts`

**What it does:** Creates initial `federate.config.json` file.

**Called by:** `federation-setup` skill

**Parameters:**
- `--description <text>` — (Optional) Federation description

**Example (manual invocation):**
```bash
npx tsx scripts/init-federation.ts
```

---

### `validate-config.ts`

**What it does:** Validates `federate.config.json` schema.

**Called by:** Various scripts on startup

**Example (manual invocation):**
```bash
npx tsx scripts/validate-config.ts
```

---

### `team-status.ts`

**What it does:** Gets detailed status for a specific team.

**Called by:** `federation-orchestration` skill

**Parameters:**
- `--team <domainId>` — Team to query

**Example (manual invocation):**
```bash
npx tsx scripts/team-status.ts --team backend-api
```

---

## Advanced Usage

### Direct Script Invocation

If you need to run scripts directly (e.g., for automation or debugging):

**Requirements:**
- Node.js 18+
- `tsx` installed (`npm install -g tsx`)
- Run from repository root

**Pattern:**
```bash
cd /path/to/your/repo
npx tsx scripts/{script-name}.ts [options]
```

### Debugging

All scripts support `--verbose` flag for detailed logging:

```bash
npx tsx scripts/onboard.ts --archetype coding --domain test-team --verbose
```

### Environment Variables

Scripts respect these environment variables:

- `SQUAD_TELEMETRY_ENABLED` — Enable/disable telemetry (true/false)
- `OTEL_EXPORTER_OTLP_ENDPOINT` — OpenTelemetry endpoint
- `SQUAD_CONFIG_PATH` — Path to `federate.config.json` (default: `./federate.config.json`)

### Error Handling

Scripts exit with codes:

- `0` — Success
- `1` — Configuration error
- `2` — Validation error
- `3` — File system error
- `4` — Network error (Teams integration)

## Common Patterns

### Check All Team Status

```bash
npx tsx scripts/monitor.ts
```

### Send Directive to Team

Use the `federation-orchestration` skill:

**Via Copilot:** "Send a directive to backend-api: Add rate limiting"

**Manual equivalent:**
```bash
npx tsx scripts/monitor.ts \
  --send backend-api \
  --directive "Add rate limiting to login endpoint"
```

### Review Learnings

```bash
npx tsx scripts/sweep-learnings.ts
```

### Sync New Skill to All Teams

**Via Copilot:** "Sync jwt-validation skill to all teams"

**Manual equivalent:**
```bash
npx tsx scripts/sync-skills.ts --skill jwt-validation.md --all
```

## Troubleshooting

### Script Not Found

**Error:** `Cannot find module 'scripts/onboard.ts'`

**Fix:** Ensure you're running from repository root where `scripts/` exists.

### Permission Denied

**Error:** `EACCES: permission denied`

**Fix:** Check file permissions on `.squad/` directory:
```bash
chmod -R u+w .squad/
```

### Team Not Found

**Error:** `Team 'backend-api' not found in registry`

**Fix:** Verify team exists:
```bash
npx tsx scripts/monitor.ts
```

### Invalid Configuration

**Error:** `Invalid federate.config.json`

**Fix:** Validate config:
```bash
npx tsx scripts/validate-config.ts
```

## Next Steps

- [View SDK types](/vladi-plugins-marketplace/reference/sdk-types)
- [Understand configuration](/vladi-plugins-marketplace/reference/configuration)
- [Explore signal protocol](/vladi-plugins-marketplace/reference/signal-protocol)
- **Use federation skills instead of manual scripts** — talk to Copilot naturally!
