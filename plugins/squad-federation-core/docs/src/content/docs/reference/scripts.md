---
title: Scripts
description: CLI scripts for managing federations and teams
---

# Scripts

Squad Federation provides CLI scripts for federation management. All scripts are located in `scripts/` and run via `npx tsx`.

## onboard.ts

**Purpose:** Add a new team to the federation

**Usage:**
```bash
npx tsx scripts/onboard.ts \
  --domain {team-name} \
  --mission "{team-objective}" \
  --archetype {archetype-id} \
  --placement {placement-type} \
  [placement-specific-options]
```

**Required Arguments:**

| Argument | Type | Description |
|----------|------|-------------|
| `--domain` | string | Team name (slug, kebab-case) |
| `--mission` | string | Team objective (quoted) |
| `--archetype` | string | Archetype ID (`coding`, `deliverable`, `consultant`) |
| `--placement` | string | Placement type (`worktree`, `directory`, `custom`) |

**Placement-Specific Options:**

### Worktree

```bash
--placement worktree \
--branch squad/frontend \
[--worktree-path .worktrees/frontend]
```

- `--branch` (required) - Git branch name
- `--worktree-path` (optional) - Custom worktree path (default: `.worktrees/{domain}`)

### Directory

```bash
--placement directory \
--path ./teams/frontend
```

- `--path` (required) - Directory path (absolute or relative)

### Custom

```bash
--placement custom \
--plugin-id s3-placement \
--plugin-option bucket=my-bucket \
--plugin-option prefix=teams/frontend/
```

- `--plugin-id` (required) - Custom placement plugin identifier
- `--plugin-option` (repeatable) - Plugin-specific options as `key=value`

**Examples:**

**Worktree placement:**
```bash
npx tsx scripts/onboard.ts \
  --domain frontend \
  --mission "Build authentication UI" \
  --archetype coding \
  --placement worktree \
  --branch squad/frontend
```

**Directory placement:**
```bash
npx tsx scripts/onboard.ts \
  --domain backend \
  --mission "Implement auth API" \
  --archetype coding \
  --placement directory \
  --path ./teams/backend
```

**What it does:**

1. Validates archetype exists
2. Creates placement (worktree, directory, or custom)
3. Copies archetype files to team placement
4. Initializes `.squad/` directory in team workspace
5. Registers team in `.squad/teams.json`
6. Creates `.mcp.json` if telemetry enabled
7. Outputs team ID and next steps

**Output:**

```
✅ Team onboarded successfully!

Team ID: team-abc-123-def-456
Domain: frontend
Placement: worktree (.worktrees/frontend)
Branch: squad/frontend

Next steps:
1. Launch the team: npx tsx scripts/launch.ts --team frontend
2. Monitor progress: npx tsx scripts/monitor.ts
```

---

## launch.ts

**Purpose:** Start a team's work session

**Usage:**
```bash
npx tsx scripts/launch.ts --team {domain}
```

**Required Arguments:**

| Argument | Type | Description |
|----------|------|-------------|
| `--team` | string | Team domain name |

**Example:**

```bash
npx tsx scripts/launch.ts --team frontend
```

**What it does:**

1. Reads team config from registry
2. Resolves archetype and placement
3. Starts Copilot CLI session in team workspace
4. Redirects output to `run-output.log`
5. Returns immediately (session runs in background)

**Output:**

```
🚀 Launching team: frontend
Placement: .worktrees/frontend
Archetype: coding
Session started. Check run-output.log for progress.
```

**Stopping a session:**

(No built-in stop command in v0.5.0 - use process management)

```bash
ps aux | grep copilot | grep frontend
kill {PID}
```

---

## monitor.ts

**Purpose:** View team status and send signals

**Usage:**

### Dashboard Mode

```bash
npx tsx scripts/monitor.ts [--watch] [--interval {seconds}]
```

**Arguments:**

| Argument | Type | Description |
|----------|------|-------------|
| `--watch` | flag | Continuous monitoring (updates every `--interval` seconds) |
| `--interval` | number | Update interval in seconds (default: 30) |

**Example:**

```bash
npx tsx scripts/monitor.ts --watch --interval 30
```

**Output:**

```
📊 Squad Federation Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━

Team         State       Step              Progress  Updated
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ backend   failed      analyzing routes  65%       1m ago
🔄 frontend  scanning    auth module       45%       2m ago
✅ infra     complete    -                 100%      5m ago
⏸️  testing  paused      -                 80%       12m ago
```

### Send Signal Mode

```bash
npx tsx scripts/monitor.ts \
  --send {team-domain} \
  --directive "{message}" | \
  --question "{message}" | \
  --report "{message}" | \
  --alert "{message}"
```

**Arguments:**

| Argument | Type | Description |
|----------|------|-------------|
| `--send` | string | Recipient team domain |
| `--directive` | string | Send directive signal (mutually exclusive) |
| `--question` | string | Send question signal (mutually exclusive) |
| `--report` | string | Send report signal (mutually exclusive) |
| `--alert` | string | Send alert signal (mutually exclusive) |

**Example:**

```bash
npx tsx scripts/monitor.ts \
  --send frontend \
  --directive "Focus on login flow first"
```

**Output:**

```
📨 Signal sent to frontend
Type: directive
Message: Focus on login flow first
```

---

## sweep.ts

**Purpose:** Analyze learnings across teams to find patterns

**Usage:**

```bash
npx tsx scripts/sweep.ts [--tag {tag}] [--domain {domains}] [--since {date}]
```

**Arguments:**

| Argument | Type | Description |
|----------|------|-------------|
| `--tag` | string | Filter by tag (e.g., `performance`) |
| `--domain` | string | Filter by team domains (comma-separated) |
| `--since` | string | Filter by date (ISO 8601, e.g., `2025-01-01`) |

**Example:**

```bash
npx tsx scripts/sweep.ts --tag performance
```

**Output:**

```
🔍 Pattern Cluster: testing + performance (3 teams)
  - frontend: Parallel test execution reduces CI time
  - backend: Mock external APIs in integration tests
  - infra: Use test containers for database tests

🔍 Pattern Cluster: auth + security (2 teams)
  - frontend: Store tokens in httpOnly cookies
  - backend: Validate JWT signatures on every request
```

**What it does:**

1. Loads all learnings from `.squad/learnings/log.jsonl`
2. Groups by tag combinations
3. Finds clusters with 2+ teams
4. Ranks by frequency and tag overlap
5. Outputs pattern candidates

---

## graduate.ts

**Purpose:** Promote a learning to a skill

**Usage:**

```bash
npx tsx scripts/graduate.ts \
  --learning-id {learning-timestamp} \
  --skill-name {skill-slug}
```

**Arguments:**

| Argument | Type | Description |
|----------|------|-------------|
| `--learning-id` | string | Learning timestamp from `log.jsonl` |
| `--skill-name` | string | Skill filename (kebab-case, no `.md`) |

**Example:**

```bash
npx tsx scripts/graduate.ts \
  --learning-id "1706611200000" \
  --skill-name "parallel-testing"
```

**What it does:**

1. Reads learning from `.squad/learnings/log.jsonl`
2. Creates skill file in `.squad/skills/{skill-name}.md`
3. Adds skill metadata (tags, category, source, promoted date)
4. Appends "graduated" marker to learning log

**Output:**

```
📚 Learning graduated to skill!

Skill: .squad/skills/parallel-testing.md
Learning ID: 1706611200000
Source: frontend
Tags: testing, performance, ci-cd
```

---

## sync.ts

**Purpose:** Distribute skills to all teams

**Usage:**

```bash
npx tsx scripts/sync.ts [--team {domains}] [--skill {skill-name}] [--dry-run]
```

**Arguments:**

| Argument | Type | Description |
|----------|------|-------------|
| `--team` | string | Sync to specific teams (comma-separated, optional) |
| `--skill` | string | Sync specific skill (optional) |
| `--dry-run` | flag | Preview changes without applying |

**Example:**

```bash
npx tsx scripts/sync.ts --team frontend,backend
```

**Output:**

```
📡 Syncing skills...

Synced to frontend:
  - parallel-testing.md
  - error-handling.md

Synced to backend:
  - parallel-testing.md
  - error-handling.md

Total: 2 teams, 2 skills
```

**Dry-run:**

```bash
npx tsx scripts/sync.ts --dry-run
```

```
📡 Dry-run mode (no changes applied)

Would sync to frontend:
  - parallel-testing.md
  - error-handling.md

Would sync to backend:
  - parallel-testing.md
  - error-handling.md
```

---

## Common Workflows

### Initialize Federation

```bash
# 1. Create config
echo '{"federationName":"my-project"}' > federate.config.json

# 2. Onboard first team
npx tsx scripts/onboard.ts \
  --domain frontend \
  --mission "Build auth UI" \
  --archetype coding \
  --placement worktree \
  --branch squad/frontend

# 3. Launch team
npx tsx scripts/launch.ts --team frontend

# 4. Monitor progress
npx tsx scripts/monitor.ts --watch
```

### Send Directive

```bash
npx tsx scripts/monitor.ts \
  --send frontend \
  --directive "Focus on login flow first"
```

### Discover Patterns

```bash
# 1. Sweep learnings
npx tsx scripts/sweep.ts

# 2. Graduate high-value pattern
npx tsx scripts/graduate.ts \
  --learning-id "1706611200000" \
  --skill-name "parallel-testing"

# 3. Sync to all teams
npx tsx scripts/sync.ts
```

### Check Team Health

```bash
# Dashboard
npx tsx scripts/monitor.ts

# Team logs
tail -100 .worktrees/frontend/run-output.log

# Team status
cat .worktrees/frontend/.squad/status.json | jq .
```

---

## Troubleshooting

### Script not found

**Error:** `Cannot find module 'scripts/onboard.ts'`

**Solution:** Run from repository root:
```bash
cd /path/to/repo
npx tsx scripts/onboard.ts --help
```

### TypeScript errors

**Error:** `TS2304: Cannot find name 'X'`

**Solution:** Install dependencies:
```bash
npm install
```

### Permission denied

**Error:** `EACCES: permission denied`

**Solution:** Check file permissions:
```bash
chmod +x scripts/*.ts
```

Or run with `npx tsx` (no execute bit needed):
```bash
npx tsx scripts/onboard.ts ...
```

---

## Next Steps

- [Configure federation](/reference/configuration)
- [Understand archetypes](/archetypes/overview)
- [Monitor teams](/guides/monitoring)
