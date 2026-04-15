---
title: Team Onboarding
description: How to create and configure teams in your federation
---

# Team Onboarding

Team onboarding is the process of creating a new autonomous team within your federation. Each team gets its own workspace, archetype, and identity.

## Onboarding Script

Use `scripts/onboard.ts` to create teams:

```bash
npx tsx scripts/onboard.ts \
  --name "team-name" \
  --domain-id "unique-id" \
  --archetype "squad-archetype-{type}" \
  [options]
```

## Required Arguments

### `--name`

Human-readable team name (used for branch name and directory).

**Examples:**
- `frontend`
- `api-gateway`
- `data-pipeline`

**Rules:**
- Lowercase letters, numbers, hyphens only
- No spaces or special characters
- Used in git branch: `squad/{name}`

### `--domain-id`

Unique identifier for the team (must be globally unique in the federation).

**Examples:**
- `frontend-001`
- `api-gw-prod`
- `data-etl-v2`

**Rules:**
- Must be unique across all teams
- Stored in registry (`.squad/teams.json`)
- Used for signal routing and telemetry

### `--archetype`

Archetype plugin name defining the team's lifecycle.

**Available archetypes:**
- `squad-archetype-coding` - Feature development, refactoring, testing
- `squad-archetype-deliverable` - Structured output creation (specs, reports, schemas)
- `squad-archetype-consultant` - Analysis and recommendations

**Example:**
```bash
--archetype "squad-archetype-coding"
```

## Optional Arguments

### `--description`

Human-readable description of the team's mission.

```bash
--description "Builds and tests frontend React components"
```

This is written to the team's `DOMAIN_CONTEXT.md`.

### `--placement`

Placement strategy (default: `worktree`).

**Options:**
- `worktree` - Git branch + worktree
- `directory` - Standalone directory

```bash
--placement worktree
```

### `--worktree-dir`

Directory for worktree placement (only used with `--placement worktree`).

**Options:**
- `.worktrees` (default) - Inside repository
- `../` - Sibling to repository
- Absolute path - Custom location

```bash
--worktree-dir ../team-workspaces
```

### `--path`

Custom path for directory placement (only used with `--placement directory`).

```bash
--placement directory --path /var/teams/my-team
```

### `--base-branch`

Base branch for worktree (default: `main`).

```bash
--base-branch develop
```

## Onboarding Flow

When you run `onboard.ts`, here's what happens:

### 1. Validate Arguments

- Check archetype exists (from marketplace.json)
- Validate name format (kebab-case)
- Ensure domain-id is unique

### 2. Create Workspace

**Worktree:**
```bash
git worktree add .worktrees/{name} -b squad/{name} main
```

**Directory:**
```bash
mkdir -p {path}
```

### 3. Seed Team Directory

Copy archetype files from `plugins/{archetype}/team/` to team workspace:

```
.worktrees/{name}/
├── archetype.json          # Lifecycle states
├── .squad/
│   └── skills/             # Archetype skills
└── DOMAIN_CONTEXT.md       # Team mission (from --description)
```

### 4. Bootstrap `.squad` Structure

Create signal and learning directories:

```
.squad/
├── signals/
│   ├── inbox/
│   ├── outbox/
│   └── status.json         # Initial state: "initializing"
├── learnings/
│   └── log.jsonl           # Empty learning log
└── ceremonies.md           # Ceremony templates
```

### 5. Register Team

Add entry to `.squad/teams.json`:

```json
{
  "domain": "frontend",
  "domainId": "frontend-001",
  "archetypeId": "squad-archetype-coding",
  "placementType": "worktree",
  "location": "/path/to/.worktrees/frontend",
  "createdAt": "2025-01-30T12:00:00Z",
  "federation": {
    "parent": "meta-squad",
    "parentLocation": "/path/to/repo",
    "role": "team"
  }
}
```

### 6. Run `squad init`

Cast the team agent in its workspace:

```bash
cd .worktrees/{name}
squad init
```

This creates the team's agent configuration and initial state.

## Examples

### Minimal Onboarding (Worktree)

```bash
npx tsx scripts/onboard.ts \
  --name "frontend" \
  --domain-id "fe-001" \
  --archetype "squad-archetype-coding"
```

Creates:
- Branch: `squad/frontend`
- Worktree: `.worktrees/frontend/`
- Archetype: Coding

### Onboarding with Description

```bash
npx tsx scripts/onboard.ts \
  --name "api-gateway" \
  --domain-id "api-gw-prod" \
  --archetype "squad-archetype-coding" \
  --description "Manages API routing, auth, and rate limiting"
```

### Directory Placement

```bash
npx tsx scripts/onboard.ts \
  --name "reporting" \
  --domain-id "report-001" \
  --archetype "squad-archetype-deliverable" \
  --placement directory \
  --path /var/teams/reporting
```

### Custom Worktree Location

```bash
npx tsx scripts/onboard.ts \
  --name "infra" \
  --domain-id "infra-001" \
  --archetype "squad-archetype-coding" \
  --worktree-dir ../team-branches
```

Creates worktree at `../team-branches/infra/` (outside repo).

## Post-Onboarding Steps

### 1. Customize DOMAIN_CONTEXT.md

Edit the team's context file:

```bash
vim .worktrees/frontend/DOMAIN_CONTEXT.md
```

Add:
- Team responsibilities
- Key files/directories to focus on
- Constraints or guidelines
- Integration points with other teams

### 2. Seed Skills (Optional)

Add custom skills to `.worktrees/{name}/.squad/skills/`:

```bash
cp my-custom-skill/ .worktrees/frontend/.squad/skills/
```

### 3. Write Launch Prompt (Optional)

Create `.worktrees/{name}/.squad/launch-prompt.md`:

```markdown
# Frontend Team Launch

Your mission: Build and test React components in src/components.

Focus areas:
1. Component library
2. Unit and integration tests
3. Storybook documentation

Check inbox for directives from meta-squad.
```

This overrides the default launch prompt.

### 4. Launch the Team

Start a headless session:

```bash
npx tsx scripts/launch.ts --team frontend
```

## Verifying Onboarding

### Check Registry

```bash
cat .squad/teams.json | jq '.teams[] | select(.domain == "frontend")'
```

### Check Worktree

```bash
git worktree list | grep frontend
```

### Check Bootstrap

```bash
ls -la .worktrees/frontend/.squad/
```

Should show: `status.json`, `signals/`, `learnings/`, `ceremonies.md`.

## Troubleshooting

### "Team already registered"

Domain ID is not unique. Use a different ID:

```bash
--domain-id "frontend-002"
```

Or remove the old entry from `.squad/teams.json` if it's a duplicate.

### "Archetype not found"

Check available archetypes:

```bash
cat .github/plugin/marketplace.json | jq '.plugins[] | select(.category == "archetype")'
```

Ensure the archetype name matches exactly.

### Worktree creation failed

Branch already exists:

```bash
git branch -d squad/frontend  # Delete old branch
git worktree prune            # Clean up stale worktrees
```

Then retry onboarding.

## Next Steps

- [Launch the team](/getting-started/first-federation#step-5-launch-the-team)
- [Monitor team progress](/guides/monitoring)
- [Send directives](/reference/signal-protocol)
