---
title: Team Onboarding
description: How the team-onboarding skill creates new teams conversationally
---

# Team Onboarding

The **team-onboarding skill** guides you through creating a new team in your federation. It asks what the team should do, discovers the right archetype through guided questions, and sets up the workspace automatically.

## Starting Onboarding

In Copilot, say:

> "Spin up a team for authentication"

or

> "Onboard a team"

or

> "Add a frontend team"

The skill activates and begins asking questions.

## The Onboarding Conversation

### 1. What Should This Team Work On?

**Skill asks:**
> "What should this team work on? Be specific about what they'll build or analyze."

**You describe the team's mission:**
> "Build and test React components for the frontend"

or

> "Audit infrastructure code for security vulnerabilities"

or

> "Create API documentation from OpenAPI specs"

The skill uses this to derive the team name and choose the right archetype.

### 2. Team Name Confirmation

**Skill derives a name from your description:**
> "I'll call this team 'frontend' — sound good?"

**Your options:**

**Yes** - Team named `frontend`

**No, call it X** - You provide a different name:
> "No, call it 'ui-components'"

The name must be:
- Lowercase letters, numbers, hyphens only
- Unique across all teams in the federation

### 3. Archetype Discovery

The skill asks **guiding questions** to discover the right archetype. It doesn't show you a menu — it figures it out from your answers.

#### Question 1: Output Type

**Skill asks:**
> "Will this team write code, or produce file artifacts like reports or specs?"

**Your options:**

**Write code** → Coding or Research archetype (next question determines which)

**Produce artifacts** → Deliverable archetype (skip to placement)

#### Question 2: Integration (if you said "write code")

**Skill asks:**
> "Will they open pull requests to integrate their work?"

**Your options:**

**Yes** → **Coding archetype**
- Builds features in branches
- Opens PRs to main
- Runs tests and CI checks

**No** → **Research archetype**  
- Explores code, analyzes patterns
- Documents findings
- No PR workflow

#### Archetype Confirmation

**Skill shows its recommendation:**
> "Based on your answers, I recommend the **coding archetype**. Sound right?"

You confirm or override:
- **Yes** - Archetype locked in
- **No, use X** - You specify a different archetype manually

### 4. Archetype Plugin Check

**Skill checks if the archetype plugin is installed:**
> "Checking if squad-archetype-coding is installed..."

**If missing:**
> "I need to install squad-archetype-coding first. OK?"

You confirm, and the skill installs it from the marketplace.

### 5. Workspace Placement

**Skill asks:**
> "Where should this team's workspace live?"

**Your options:**

**Worktree** (recommended):
- Git branch: `squad/{team-name}`
- Worktree location: `.worktrees/{team-name}/`
- Full git integration (commit, push, PR)
- Isolated from main branch

**Directory**:
- Standalone directory (no git branch)
- Filesystem-only operations
- No PR workflow
- Lighter weight

**Custom path**:
> "Actually, put it at /var/teams/frontend"

If you choose **worktree**, the skill asks:

> "Where should worktrees live? Inside the repo (.worktrees/) or outside (../)?"

**Inside** - `.worktrees/` in the repo

**Outside** - `../` as sibling directory

### 6. Onboarding Summary

**Skill shows a complete summary:**

```
📋 Team Setup Summary:
━━━━━━━━━━━━━━━━━━━━
Name: frontend
Mission: Build and test React components for the frontend
Archetype: coding
Placement: worktree (inside repo)
Location: .worktrees/frontend
Branch: squad/frontend
Communication: file-signal (from federate.config.json)

Proceed?
```

You confirm, and the skill executes onboarding.

### 7. Autonomous Execution

Behind the scenes, the skill calls `scripts/onboard.ts` with the parameters you confirmed:

```bash
npx tsx scripts/onboard.ts \
  --name "frontend" \
  --domain-id "frontend-abc123" \
  --archetype "squad-archetype-coding" \
  --placement worktree \
  --worktree-dir .worktrees \
  --description "Build and test React components for the frontend"
```

**The script:**
1. Creates git branch `squad/frontend` and worktree
2. Seeds archetype skills and configuration
3. Bootstraps `.squad/` structure (signals, learnings)
4. Registers team in `.squad/teams.json`
5. Runs `squad init` to cast the team agent

**Output:**
```
✅ Team 'frontend' onboarded successfully
📍 Location: .worktrees/frontend
🌿 Branch: squad/frontend
🔧 Archetype: coding
```

### 8. Next Steps Prompt (Optional)

**Skill asks:**
> "Want me to launch this team now?"

**Yes** - The orchestration skill takes over and starts the team session

**No** - Onboarding complete. Launch anytime:
> "Launch the frontend team"

## What Gets Created

After onboarding, the team workspace contains:

```
.worktrees/frontend/
├── DOMAIN_CONTEXT.md         # Team mission from your description
├── archetype.json            # Lifecycle states from archetype
├── .squad/
│   ├── skills/               # Archetype skills seeded from plugin
│   │   ├── pr-creation/
│   │   ├── test-runner/
│   │   └── code-review/
│   ├── signals/
│   │   ├── inbox/            # Receives directives
│   │   ├── outbox/           # Sends questions/reports
│   │   └── status.json       # Team state (initially: "initializing")
│   ├── learnings/
│   │   └── log.jsonl         # Learning log (empty initially)
│   └── ceremonies.md         # Ceremony templates
├── .mcp.json                 # Telemetry config (if enabled)
└── README.md                 # Auto-generated team README
```

## Advanced Options

### Seeding Custom Skills

After onboarding, add domain-specific skills:

```bash
cp my-custom-skill/ .worktrees/frontend/.squad/skills/
```

The team reads skills from `.squad/skills/` at launch.

### Customizing DOMAIN_CONTEXT.md

Edit the team's mission file:

```bash
vim .worktrees/frontend/DOMAIN_CONTEXT.md
```

Add:
- Specific responsibilities
- Key files/directories to focus on
- Integration points with other teams
- Constraints or guidelines

### Custom Launch Prompt

Override the default launch prompt by creating `.squad/launch-prompt.md`:

```markdown
# Frontend Team Launch

Focus on:
1. Component library in src/components
2. Unit tests with vitest
3. Storybook documentation

Check inbox for directives from meta-squad.
```

## Verifying Onboarding

### Check Team Registry

```bash
cat .squad/teams.json | jq '.teams[] | select(.domain == "frontend")'
```

### Check Worktree

```bash
git worktree list | grep frontend
```

### Inspect Team Workspace

```bash
ls -la .worktrees/frontend/.squad/
```

You should see `status.json`, `signals/`, `learnings/`, `ceremonies.md`.

## Placement Options Explained

### Worktree Placement

**Best for:**
- Teams that open PRs
- Version history needed
- Git-based workflows
- Cross-branch reading via `git show`

**What you get:**
- Git branch: `squad/{team}`
- Dedicated worktree directory
- Full git operations: commit, push, PR
- Isolated from main branch

**Where worktrees live:**

**Inside repo (.worktrees/)**:
```
my-project/
├── .worktrees/
│   ├── frontend/
│   └── backend/
```

**Outside repo (../):**:
```
parent-dir/
├── my-project/       (main repo)
└── worktrees/
    ├── frontend/
    └── backend/
```

### Directory Placement

**Best for:**
- Deliverable/research teams (no PRs needed)
- External system integration
- Ephemeral teams
- Custom storage backends

**What you get:**
- Standalone directory
- Filesystem-only operations
- No git branch or history
- Lighter resource usage

## Archetype Selection Guide

### Coding Archetype

**Use when team:**
- Writes code (features, fixes, refactors)
- Opens pull requests
- Runs tests and CI
- Integrates via git workflow

**Examples:**
- "Build frontend components"
- "Implement API endpoints"
- "Refactor authentication module"

### Deliverable Archetype

**Use when team:**
- Produces structured file outputs
- Creates reports, specs, schemas
- Generates documentation
- No code changes

**Examples:**
- "Audit security vulnerabilities"
- "Generate API documentation"
- "Create infrastructure inventory"

### Research Archetype

**Use when team:**
- Analyzes code or systems
- Explores patterns and anti-patterns
- Documents findings
- No integration workflow

**Examples:**
- "Analyze test coverage gaps"
- "Map service dependencies"
- "Identify performance bottlenecks"

## Troubleshooting

### "Team name already exists"

Choose a different name. Names must be unique across the federation.

> "No, call it 'ui-components'"

### "Archetype plugin not found"

The skill should auto-install missing archetypes. If it doesn't:

```bash
copilot plugin install squad-archetype-coding@vladi-plugins-marketplace
```

Then retry onboarding.

### Worktree creation failed

Branch might already exist:

```bash
git branch -d squad/frontend  # Delete old branch
git worktree prune            # Clean up stale worktrees
```

Then retry onboarding.

### Can't find .squad/teams.json

Run federation setup first:

> "Set up a federation"

You need `federate.config.json` before onboarding teams.

## Script Reference

While the skill handles onboarding conversationally, you can run the script directly for CI/CD or automation:

**Manual onboarding:**
```bash
npx tsx path/to/squad-federation-core/scripts/onboard.ts \
  --name "frontend" \
  --domain-id "fe-001" \
  --archetype "squad-archetype-coding" \
  --placement worktree \
  --description "Build React components"
```

**Required flags:**
- `--name` - Team name (kebab-case)
- `--domain-id` - Unique team identifier
- `--archetype` - Archetype plugin name

**Optional flags:**
- `--description` - Team mission (written to DOMAIN_CONTEXT.md)
- `--placement` - `worktree` (default) or `directory`
- `--worktree-dir` - Worktree location (default: `.worktrees`)
- `--path` - Directory location (for `--placement directory`)
- `--base-branch` - Base branch for worktree (default: `main`)

See the script output for details on what was created.

## Next Steps

- [Launch the team](/vladi-plugins-marketplace/getting-started/first-federation#step-3-launch-the-team)
- [Send directives to guide work](/vladi-plugins-marketplace/guides/federation-setup#step-5-send-a-directive-optional)
- [Monitor team progress](/vladi-plugins-marketplace/guides/monitoring)
