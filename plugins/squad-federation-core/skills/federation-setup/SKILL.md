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

### Step 2: Work pattern (archetype selection)

**Ask:** "What kind of work will your teams do?"

**Present choices:**

| Archetype | What it means |
|-----------|---------------|
| **Deliverable** | Teams produce file artifacts — reports, inventories, audit results |
| **Coding** | Teams write code and open PRs |
| **Research** | Teams investigate topics and produce documents |
| **Task** | Teams execute discrete work items |
| **Mixed** | Different teams do different things |

**Say:** "You can always add more team types later."

**Store the selection internally** — it determines which archetype plugin to install. The archetype name does NOT go into core config.

**If Mixed:** Ask which archetypes they need right now. Install all of them in Step 3.

### Step 3: Install archetype

Based on the selection, install the corresponding archetype plugin.

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
copilot plugin install squad-archetype-{choice}@vladi-plugins-marketplace
```

Archetype name mapping:
- Deliverable → `squad-archetype-deliverable`
- Coding → `squad-archetype-coding`
- Research → `squad-archetype-research`
- Task → `squad-archetype-task`

For **Mixed**: install each selected archetype in sequence.

**Confirm success** before proceeding. If install fails, show the error and offer to retry or skip.

**After successful install, say:**

> "Archetype installed. It may have its own configuration — check its playbook skill when you're setting up your first team."

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

### Step 6: Generate config

Assemble `federate.config.json` at the repository root with **only** core fields:

```json
{
  "description": "...",
  "branchPrefix": "squad/",
  "mcpStack": [],
  "telemetry": {
    "enabled": true
  }
}
```

**Rules for this config:**
- `description` — from Step 1, verbatim
- `branchPrefix` — always `"squad/"` (don't ask the user unless they bring it up)
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

**Say:** "Now let's cast your leadership team. This is the meta-squad — it coordinates all your teams."

Delegate to Squad's casting system. The simplest path:

> "Describe what you need your leadership team to handle, and Squad's casting will assemble the right agents. Or just run `squad init` to set up a default meta-squad."

Don't prescribe roles. Don't suggest specific team compositions. Let the casting system do its job based on the user's description from Step 1.

If Squad is already initialized (detected in prerequisites), skip this step and note:

> "Your meta-squad is already set up. Moving on."

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
