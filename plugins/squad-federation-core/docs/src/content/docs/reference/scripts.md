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

### `onboard.ts`

**What it does:** Creates a new team workspace, seeds archetype files, registers team in `.squad/team-registry.json`.

**Called by:** `team-onboarding` skill

**Parameters:**
- `--archetype <id>` — Archetype to use (coding, deliverable, consultant, or custom)
- `--domain <name>` — Team domain name
- `--placement <type>` — `worktree` or `directory`
- `--mission <text>` — Initial mission/directive
- `--branch <name>` — (For worktree) Git branch to create
- `--communication <type>` — `file-signal` or `teams-channel`

**What it creates:**
```
.squad/
  worktrees/{domain}/          (if placement=worktree)
  OR teams/{domain}/           (if placement=directory)
    .squad/
      signals/inbox/
      signals/outbox/
      skills/
      archetype.json           (team state machine)
      deliverable.md           (placeholder)
```

**Example (manual invocation):**
```bash
npx tsx scripts/onboard.ts \
  --archetype coding \
  --domain backend-api \
  --placement worktree \
  --mission "Build REST API with PostgreSQL"
```

---

### `launch.ts`

**What it does:** Starts a headless Copilot session for a team.

**Called by:** `federation-orchestration` skill

**Parameters:**
- `--team <domainId>` — Team to launch
- `--model <name>` — (Optional) Override model (default from archetype)
- `--max-turns <n>` — (Optional) Max conversation turns before auto-pause

**What it does:**
1. Reads team's `archetype.json` state machine
2. Starts Copilot agent with team's system prompt
3. Runs autonomously, checking inbox for signals
4. Updates status as work progresses
5. Writes deliverable when complete

**Example (manual invocation):**
```bash
npx tsx scripts/launch.ts --team backend-api
```

---

### `monitor.ts`

**What it does:** Dashboard showing all teams' status + ability to send signals.

**Called by:** `federation-orchestration` skill

**Parameters:**
- `--watch` — (Optional) Live-updating dashboard
- `--send <teamId>` — Send signal to team
- `--directive <text>` — Signal body (when using `--send`)
- `--type <directive|question|report|alert>` — Signal type

**Dashboard output:**
```
Team                 State        Progress  Last Updated         
────────────────────────────────────────────────────────────────
backend-api          scanning     40%       30 seconds ago       
docs-team            complete     100%      2 minutes ago        
frontend-ui          distilling   75%       1 minute ago         
```

**Example (manual invocation):**
```bash
# Watch dashboard
npx tsx scripts/monitor.ts --watch

# Send directive
npx tsx scripts/monitor.ts \
  --send backend-api \
  --directive "Add rate limiting to login endpoint"
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

## Helper Scripts

### `init-federation.ts`

**What it does:** Creates initial `federate.config.json` file.

**Called by:** `federation-setup` skill

**Parameters:**
- `--communication <type>` — `file-signal` or `teams-channel`
- `--description <text>` — (Optional) Federation description
- `--teams-team-id <guid>` — (If teams-channel) Teams team ID
- `--teams-channel-id <guid>` — (If teams-channel) Teams channel ID

**Example (manual invocation):**
```bash
npx tsx scripts/init-federation.ts --communication file-signal
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
