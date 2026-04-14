---
name: "federation-setup"
description: "The user wants to CREATE a new federation from scratch — no federate.config.json exists yet. Triggers on: federate this project, set up federation, go multi-team, I need multiple teams, I need a team org, create a meta-squad, configure federation, federate init, initialize federation, new federation, team organization, I want teams. Should NOT activate if federation is already configured — use federation-orchestration instead."
version: "0.2.0"
---

## Purpose

Guide the user through interactive federation setup. Walk through each decision conversationally, validate prerequisites, and generate a minimal `federate.config.json`.

Core config covers *only* what the federation runtime needs. Archetype-specific settings (deliverable filenames, schemas, pipeline steps, import hooks) live with the archetype — not here.

Team composition is handled by Squad's casting system. Don't ask for roles, team size, or member lists.

## Prerequisites Check

Before starting, verify the environment. Run all checks, collect results, then report a summary.

### Required: Squad

```bash
squad --version
```

Squad provides the agent framework, casting, and `squad.agent.md` coordinator. If missing, stop:

> "Squad is not installed. Federation builds on top of Squad. Install it first:
> ```bash
> npm install -g @bradygaster/squad-cli
> squad init
> ```
> See https://github.com/bradygaster/squad for details."

Also verify Squad is initialized:

```bash
test -f .github/agents/squad.agent.md || test -f .squad/team.md
```

If neither exists:

> "Squad is installed but not initialized in this project. Run `squad init` first, then come back to set up federation."

### Required: Git 2.20+

```bash
git --version
```

Worktree support requires git 2.20+. If missing or too old, stop with install/upgrade instructions.

### Required: Node.js 20+

```bash
node --version
```

Must be v20.0.0 or later (native fetch, structured clone). If too old, recommend `nvm install 20`.

### Optional: Docker

```bash
docker --version
```

Only needed for the OTel observability dashboard. If missing, note it — telemetry can be enabled later.

### Required: Repository State

```bash
git rev-parse --is-inside-work-tree
git status --porcelain
```

Must be inside a git repo. Warn (don't block) on uncommitted changes — onboarding creates branches and worktrees, so a clean state is recommended.

### Report Summary

Show all results before proceeding:

```
✅ Squad 1.2.0
✅ git 2.43.0
✅ Node.js v20.11.0
⚠️  Docker not found (OTel dashboard unavailable)
✅ Git repository detected
⚠️  3 uncommitted changes (recommend committing first)
```

If any required check fails, stop and provide remediation instructions. Don't continue past prerequisites with a broken environment.

---

## Conversational Setup Flow

Walk through each step in order. One question at a time. Provide sensible defaults. Keep it conversational.

### Step 1: What are you building?

**Ask:** "What's the goal for your team organization? Describe what you're trying to accomplish."

**Why:** This seeds agent charters and gives casting context. It's the first thing anyone reading the config will see.

**Store as:** `description` in config.

**Examples of good responses:**
- "Inventory all Azure services across our org"
- "Build a multi-team code review pipeline"
- "Coordinate security audits across 12 microservices"

Accept whatever the user gives. Don't try to normalize it.

### Step 2: Discover available archetypes

**Discover archetypes dynamically** using the archetype discovery library:

```typescript
import { discoverArchetypes, formatArchetypeChoices } from '${CLAUDE_PLUGIN_ROOT}/scripts/lib/archetype-discovery.js';

const archetypes = discoverArchetypes();
console.log(formatArchetypeChoices(archetypes));
```

The discovery function tries two strategies:
1. Read `.github/plugin/marketplace.json` (fastest, most reliable)
2. Fall back to filesystem scan of `plugins/` directory

**If no archetypes found**, tell the user:

> "No archetypes installed yet. Archetypes define team work patterns (deliverable, coding, research, etc.). Install one from the marketplace:
> ```bash
> copilot plugin marketplace add lygav/vladi-plugins-marketplace
> copilot plugin install squad-archetype-deliverable@vladi-plugins-marketplace
> ```
> Then run federation setup again."

**If archetypes found**, present the discovered list:

**Ask:** "What kind of work will your first team do?"

**Present the formatted archetype list** from `formatArchetypeChoices()`. This shows:
- Archetype name
- Description (what the team does)
- Lifecycle states (the workflow)

**Example output:**
```
Available archetypes:
  1. deliverable — Iterative teams that scan sources, distill artifacts, learn from feedback
     States: preparing → scanning → distilling → aggregating
  2. coding — Implementation teams that write code and open PRs
     States: preparing → implementing → testing → pr-open → pr-review → pr-approved → merged
  3. consultant — Domain expert teams that index codebases and answer questions on demand
     States: onboarding → indexing → ready → researching → waiting-for-feedback
```

**Say:** "This installs the archetype for your first team. You can add different types of teams later — each team picks its own archetype when onboarded."

**Also mention:** "Your teams will build knowledge over time in five channels: a learning log, agent histories, team decisions, distilled wisdom, and reusable skills. The longer they run, the smarter they get — patterns discovered in run 1 inform run 2."

**Store the selection internally** — it determines which archetype plugin to install. The archetype name does NOT go into core config.

### Step 3: Install archetype (if not already installed)

If the selected archetype is not already installed, install it.

**First, check if the marketplace is registered:**

```bash
copilot plugin marketplace list
```

If `vladi-plugins-marketplace` is not listed:

```bash
copilot plugin marketplace add lygav/vladi-plugins-marketplace
```

**Then install the archetype:**

```bash
copilot plugin install {archetype-name}@vladi-plugins-marketplace
```

Use the full archetype name from the discovery (e.g., `squad-archetype-deliverable`).

**Confirm success** before proceeding. If install fails, show the error and offer to retry or skip.

**After successful install, say:**

> "Archetype installed. When we onboard your first team, the archetype's setup wizard will ask team-specific questions (like deliverable filename or PR conventions)."

This is important: the archetype owns its own setup concerns. Core federation doesn't ask archetype-specific questions.

### Step 4: Data sources (MCP stack)

**Ask:** "What data sources or tools do your teams need access to?"

**Explain:** MCP servers provide tools to headless agent sessions running in each team's worktree. Common examples:

- `filesystem` — read/write files in the worktree
- `fetch` — make HTTP requests to external APIs
- `otel` — emit traces, metrics, and logs
- Custom servers you've built

**Default:** empty array `[]` — teams use whatever tools are available in the project's MCP configuration.

**Say:** "If you're not sure, start with an empty list. Teams inherit whatever MCP servers are configured in the project. You can always add more later by editing the config."

**Store as:** `mcpStack` array in config.

### Step 5: Telemetry

**Context:** Copilot CLI has no built-in telemetry — headless team sessions are black boxes by default. This plugin includes a special OTel integration that bridges this gap: a custom MCP server that gives agents trace, metric, event, and log tools, feeding into a central dashboard where you can watch all teams in real time.

**Ask:** "Your teams will run in headless sessions. Want me to set up a central monitoring dashboard? You'll see real-time traces, metrics, and logs from every team — it's the only way to observe what's happening inside headless sessions."

**Default logic:**
- Docker available → default **yes**
- Docker not available → default **no**, explain: "Docker is needed for the Aspire dashboard. You can enable this later with `npx tsx scripts/dashboard.ts start`."

**If yes and Docker is available**, start the dashboard immediately:

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/dashboard.ts start
```

Confirm it's running: "✅ Monitoring dashboard live at http://localhost:18888. All teams will report telemetry here automatically."

**Store as:**

```json
{
  "telemetry": {
    "enabled": true
  }
}
```

No endpoint, port, or service name in config. The runtime uses sensible defaults. The OTel MCP server auto-starts with each team session via the plugin's `.mcp.json`.

### Step 5.5: Branch prefix

**Ask:** "Team worktrees use git branches. The default prefix is `squad/` (e.g., `squad/frontend-team`, `squad/payments`). Want to change it?"

**Default:** `squad/`

Most users keep the default. Only change if there's a naming conflict or organizational convention.

### Step 5.6: Worktree location

**Ask:** "Where should team worktrees live?"

**Choices:**
- **Parallel** *(default)* — next to your project: `../your-project-team-name/`
- **Inside** — inside your project: `.worktrees/team-name/`
- **Custom path** — you specify a directory

**Default:** `parallel`

**Parallel** keeps worktrees visible as sibling folders — easy to find and open separately. **Inside** keeps everything contained in the project but adds clutter. Suggest parallel unless the user has a reason to contain them.

### Step 6: Generate config

Assemble `federate.config.json` at the repository root with **only** core fields:

```json
{
  "description": "...",
  "branchPrefix": "squad/",
  "worktreeDir": "parallel",
  "mcpStack": [],
  "telemetry": {
    "enabled": true
  }
}
```

**Rules for this config:**
- `description` — from Step 1, verbatim
- `branchPrefix` — from Step 5.5, default `"squad/"`
- `worktreeDir` — from Step 5.6, default `"parallel"`
- `mcpStack` — from Step 4, or empty array
- `telemetry.enabled` — from Step 5

**Nothing else goes in this file.** No deliverable, no schema, no universe, no importHook, no steps, no roles, no team definitions. Those are archetype or team-level concerns.

**Show the generated config to the user.** Ask them to confirm or adjust.

If the user wants to change something, make the edit and show the updated config. Loop until they confirm.

**Write the file:**

```bash
cat > federate.config.json << 'EOF'
{
  "description": "...",
  "branchPrefix": "squad/",
  "mcpStack": [],
  "telemetry": {
    "enabled": true
  }
}
EOF
```

### Step 7: Cast the meta-squad

Check if the meta-squad actually has members:

```bash
grep -c "| .* | .* | .* | Active |" .squad/team.md
```

**If members exist (count > 0):** Skip casting.
> "Your meta-squad has [N] members. Moving on."

**If team.md exists but Members table is empty (count = 0):** The scaffold exists but no team was cast. This is NOT "already set up" — it's incomplete. Proceed with casting:

> "Squad is initialized but your leadership team hasn't been cast yet. Let's do that now — for a federation, your meta-squad typically needs a Lead (architecture + coordination) and optionally a few specialists. Describe what you need, or I'll propose a small leadership team based on your goal."

Use the user's description from Step 1 to inform the casting proposal. The meta-squad MUST have at least one active member before proceeding — without members, Squad stays in Init Mode and federation commands won't work.

**If team.md doesn't exist:** Run `squad init` first, then cast.

Don't prescribe specific roles. Let Squad's casting handle composition. But ensure casting COMPLETES — verify at least one member appears in the Members table before moving to Step 8.

### Step 8: Onboard first team

**Ask:** "Ready to spin up your first team? What should it work on?"

**If yes:** Delegate to the onboard flow. Pass the user's description of what the team should work on. The onboard agent handles branch creation, worktree setup, and team casting.

**If no:** That's fine. Close out with:

> "No problem. When you're ready, just say **'spin up a team for X'** or **'@federation onboard a team'**."

Don't push. Setup is complete once the config exists and the meta-squad is cast. Onboarding teams is a separate concern.

---

## Post-Setup

After the config is written and confirmed, provide these reference notes:

### Adding teams

> Say **"spin up a team for X"** anytime to onboard a new team. Each team gets its own branch, worktree, and agent crew — cast automatically by Squad based on what the team needs to do.

### Changing configuration

> Edit `federate.config.json` directly. The schema is minimal — `description`, `branchPrefix`, `mcpStack`, and `telemetry`. Changes take effect on the next team onboard or launch.

### Adding archetypes

> Need a different work pattern? Install another archetype:
> ```bash
> copilot plugin install squad-archetype-{type}@vladi-plugins-marketplace
> ```
> Available: `deliverable`, `coding`, `research`, `task`.

### Archetype-specific configuration

> Each archetype has its own settings (deliverable filenames, pipeline steps, schemas, hooks). Those live with the team, not in the core config. Check the archetype's playbook skill for details.

---

## Config Schema

```typescript
interface FederateConfig {
  /** What this federation is trying to accomplish */
  description: string;

  /** Branch prefix for team worktrees (default: "squad/") */
  branchPrefix: string;

  /** MCP servers available to team sessions */
  mcpStack: string[];

  /** Observability settings */
  telemetry: {
    enabled: boolean;
  };
}
```

No other fields in core config. Archetype-specific settings live in the team's worktree, managed by the archetype plugin.

### Example

```json
{
  "description": "Inventory all Azure services across the organization",
  "branchPrefix": "squad/",
  "mcpStack": ["filesystem", "fetch"],
  "telemetry": {
    "enabled": true
  }
}
```

---

## Error Handling

### During Prerequisites
- **git not found:** Stop. Provide install instructions for the detected OS.
- **Node.js too old:** Stop. Recommend `nvm install 20` or platform-specific upgrade.
- **Squad not installed:** Stop. Provide install command.
- **Squad not initialized:** Stop. Tell user to run `squad init` first.
- **Docker not found:** Note the limitation, continue. Default telemetry to disabled.
- **Uncommitted changes:** Warn, offer to commit or stash, but don't block.

### During Setup
- **Archetype install fails:** Show the error. Offer to retry, skip (proceed without archetype), or abort.
- **Config file already exists:** Show current config. Ask: "Update the existing config or start fresh?"
- **User gives ambiguous archetype choice:** Ask a clarifying follow-up. Don't guess.

### During Onboarding
- **Onboard agent not available:** Provide manual instructions (branch, worktree, agent setup).
- **Branch prefix conflicts:** If `squad/*` branches already exist, list them and ask if the user wants to incorporate or ignore them.

---

## What This Skill Does NOT Do

To keep the boundary clean, this skill explicitly avoids:

- **Asking for team rosters or roles** — Squad's casting handles composition
- **Collecting deliverable filenames or schemas** — that's archetype config
- **Defining pipeline steps** — archetype concern
- **Setting up import hooks** — archetype concern
- **Asking users to list all teams upfront** — teams onboard one at a time
- **Prescribing team sizes** — casting decides based on the work
- **Configuring telemetry endpoints or ports** — runtime defaults handle this

If the user asks about any of these during setup, point them to the right place:
- Team composition → "Squad's casting will handle that when you onboard a team"
- Deliverable config → "The archetype plugin manages that — check its playbook skill"
- Pipeline steps → "Those are defined by the archetype, not core federation"
- Telemetry details → "The runtime uses sensible defaults. Override via environment variables if needed"
