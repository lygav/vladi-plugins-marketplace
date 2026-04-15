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

### Bootstrap (run first)

Before running any scripts, ensure the plugin environment is ready:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/bootstrap.mjs
```

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

Must be 2.20+ for modern git features. If missing or too old, stop with install/upgrade instructions.

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

Must be inside a git repo. Warn (don't block) on uncommitted changes — a clean state is recommended.

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

**After all prerequisites are validated successfully**, emit an OTel event:

Use the `otel_event` tool with: name="prerequisites.validated", attributes='{"git": true, "squad": true, "node": true, "docker": <docker_available>}'
Use the `otel_log` tool with: level="info", message="All prerequisites validated — ready to configure federation"

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

### Step 2: Telemetry

**Context:** Copilot CLI has no built-in telemetry — headless team sessions are black boxes by default. This plugin includes a special OTel integration that bridges this gap: a custom MCP server that gives agents trace, metric, event, and log tools, feeding into a central dashboard where you can watch all teams in real time.

**Ask:** "Your teams will run in headless sessions. Want me to set up a central monitoring dashboard? You'll see real-time traces, metrics, and logs from every team — it's the only way to observe what's happening inside headless sessions."

**Default logic:**
- Docker available → default **yes**
- Docker not available → default **no**, explain: "Docker is needed for the Aspire dashboard. You can enable this later with `npx tsx scripts/dashboard.ts start`."

**When the user confirms telemetry should be enabled**, emit OTel immediately so the dashboard lights up:

Use the `otel_span` tool with: action="start", name="federation.setup"
Use the `otel_event` tool with: name="telemetry.enabled"
Use the `otel_log` tool with: level="info", message="Federation setup started — telemetry active"

This ensures the dashboard shows activity the moment the user enables telemetry.

**If yes and Docker is available**, start the dashboard immediately:

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/dashboard.ts start
```

Confirm it's running: "✅ Monitoring dashboard live at http://localhost:18888. All teams will report telemetry here automatically."

**Then start the meta relay** to see team updates in your console:

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/meta-relay.ts
```

This relay polls team signal outboxes and delivers curated summaries to you in the console. The relay runs continuously, watching for team updates. You can stop it with Ctrl+C.

**Store as:**

```json
{
  "telemetry": {
    "enabled": true,
    "endpoint": "http://localhost:4318"
  }
}
```

The `endpoint` field tells scripts where to send OTel data (traces, metrics, logs). If Aspire dashboard is running, this is its OTLP receiver. If omitted, telemetry is silent.

### Step 3: Teams Notifications (Optional)

**Context:** The meta-squad can post summaries and poll for your directives via a Microsoft Teams channel. This is optional — without it, everything works via the console.

**Ask:** "Want to get updates and interact with the leadership team via a Teams channel? (optional — you can always add this later)"

**Default:** No (console-only is simplest).

**If yes:**

Ask for the Teams team ID and channel ID. Help them find these if needed:

> "To set up Teams notifications, I need two pieces of information:
> 1. **Teams team ID** (GUID) — the ID of your Microsoft Teams workspace
> 2. **Channel ID** — the ID of the specific channel for meta-squad updates
>
> You can find these by running:
> - List your Teams workspaces: `teams-list_workspaces`
> - List channels in a workspace: `teams-list_channels --workspace-id <GUID>`
>
> Or provide the IDs if you already have them."

Once you have both values, validate they're non-empty GUIDs (basic format check). Store them in the config.

**Store as:**

If yes:
```json
{
  "teamsConfig": {
    "teamId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "channelId": "19:xxxxx@thread.tacv2"
  }
}
```

If no: omit `teamsConfig` entirely.

**After the user makes their choice**, emit an OTel event:

Use the `otel_event` tool with: name="teams.notification.configured", attributes='{"enabled": <true|false>}'
Use the `otel_log` tool with: level="info", message="Teams notification channel: <enabled|disabled>"

### Step 4: Generate config

Assemble `federate.config.json` at the repository root with **only** core fields:

Without Teams notifications:
```json
{
  "description": "...",
  "telemetry": {
    "enabled": true,
      "endpoint": "http://localhost:4318"
  }
}
```

With Teams notifications:
```json
{
  "description": "...",
  "telemetry": {
    "enabled": true,
      "endpoint": "http://localhost:4318"
  },
  "teamsConfig": {
    "teamId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "channelId": "19:xxxxx@thread.tacv2"
  }
}
```

**Rules for this config:**
- `description` — from Step 1, verbatim
- `telemetry.enabled` — from Step 2
- `teamsConfig` — only if user opted into Teams notifications in Step 3

**Nothing else goes in this file.** No deliverable, no schema, no universe, no importHook, no steps, no roles, no team definitions. Those are archetype or team-level concerns. MCP servers are configured via `.mcp.json` at the project level and teams inherit automatically.

**Show the generated config to the user.** Ask them to confirm or adjust.

If the user wants to change something, make the edit and show the updated config. Loop until they confirm.

**Write the file:**

```bash
cat > federate.config.json << 'EOF'
{
  "description": "...",
  "telemetry": {
    "enabled": true,
      "endpoint": "http://localhost:4318"
  }
}
EOF
```

**After writing the config file**, emit an OTel event:

Use the `otel_event` tool with: name="config.written", attributes='{"path": "federate.config.json"}'
Use the `otel_log` tool with: level="info", message="Federation config written to federate.config.json"

### Step 5: Cast the meta-squad

Check if the meta-squad actually has members:

```bash
grep -c "| .* | .* | .* | Active |" .squad/team.md
```

**If members exist (count > 0):** Skip casting.
> "Your meta-squad has [N] members. Moving on."

**If team.md exists but Members table is empty (count = 0):** The scaffold exists but no team was cast. This is NOT "already set up" — it's incomplete. Proceed with casting:

> "Squad is initialized but your leadership team hasn't been cast yet. Let's do that now — for a federation, your meta-squad typically needs a Lead (architecture + coordination) and optionally a few specialists. Describe what you need, or I'll propose a small leadership team based on your goal."

Use the user's description from Step 1 to inform the casting proposal. The meta-squad is a **leadership team** — it governs, delegates, sets standards, and gives feedback. It does NOT directly produce work or orchestrate individual Squad agents. Its job is to instruct and coordinate the domain teams beneath it. Frame the casting proposal around leadership roles (strategy, architecture, quality, coordination) not implementation roles (frontend dev, backend dev, tester).

The meta-squad MUST have at least one active member before proceeding — without members, Squad stays in Init Mode and federation commands won't work.

**Agent charter seeding:** When Squad casts the meta-squad, each agent's charter (history.md) MUST include this delegation rule:
> "You are part of the meta-squad — a leadership team. When users request work (building features, writing code, producing deliverables), you delegate to domain teams via launch + directives. You do NOT do domain work yourself. Your outputs are: instructions, feedback, standards, and coordination."

This ensures every meta-squad agent understands its role from day 1.

**If team.md doesn't exist:** Run `squad init` first, then cast.

Don't prescribe specific roles. Let Squad's casting handle composition. But ensure casting COMPLETES — verify at least one member appears in the Members table before moving to Step 6.

**After the meta-squad is successfully cast**, emit an OTel event:

Use the `otel_event` tool with: name="meta.squad.cast", attributes='{"team_size": <member_count>}'
Use the `otel_log` tool with: level="info", message="Meta-squad cast with <member_count> members"

### Step 6: Onboard first team

**Ask:** "Ready to spin up your first team? What should it work on?"

**Explain:** "Each team has its own work pattern (deliverable, coding, research, or task). When we onboard, I'll help you pick the right archetype based on what the team needs to do."

**If yes:** Continue the conversation using the `team-onboarding` skill flow. Pass the user's description of what the team should work on. The team-onboarding skill handles mission clarification, archetype discovery, transport selection, and delegates to the mechanical `onboard.ts` script for branch/worktree creation.

**If no:** That's fine. Close out with:

> "No problem. When you're ready, just say **'spin up a team for X'** or **'onboard a team'**. Each team gets to pick its own archetype during onboarding."

Don't push. Setup is complete once the config exists and the meta-squad is cast. Onboarding teams is a separate concern — and that's where archetype selection happens.

**When setup is complete** (config written and meta-squad cast), emit final OTel events:

Use the `otel_span` tool with: action="end", name="federation.setup", status="ok"
Use the `otel_event` tool with: name="federation.setup.complete"
Use the `otel_log` tool with: level="info", message="Federation setup complete — ready to onboard teams"

---

## Post-Setup

After the config is written and confirmed, provide these reference notes:

### Adding teams

> Say **"spin up a team for X"** anytime to onboard a new team. Each team gets its own workspace and agent crew — transport (worktree or directory) is chosen during onboarding, and the crew is cast automatically by Squad based on what the team needs to do.

### Changing configuration

> Edit `federate.config.json` directly. The schema is minimal — `description`, `telemetry`, and optionally `teamsConfig`. Changes take effect on the next team onboard or launch.

### Adding archetypes

> Each team picks its own archetype during onboarding based on what it needs to do. The onboard wizard discovers available archetypes and recommends one, or you can install additional archetypes from the marketplace:
> ```bash
> copilot plugin marketplace add lygav/vladi-plugins-marketplace
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

  /** Observability settings */
  telemetry: {
    enabled: boolean;
  };

  /** Teams channel for meta-squad notifications (optional) */
  teamsConfig?: {
    teamId: string;
    channelId: string;
  };
}
```

No other fields in core config. Archetype-specific settings live in the team's workspace, managed by the archetype plugin. MCP servers are configured via `.mcp.json` at the project level and teams inherit automatically.

### Examples

**Minimal config:**
```json
{
  "description": "Inventory all Azure services across the organization",
  "telemetry": {
    "enabled": true,
      "endpoint": "http://localhost:4318"
  }
}
```

**With Teams notifications:**
```json
{
  "description": "Coordinate security audits across 12 microservices",
  "telemetry": {
    "enabled": true,
      "endpoint": "http://localhost:4318"
  },
  "teamsConfig": {
    "teamId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "channelId": "19:xxxxx@thread.tacv2"
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
- **Onboard agent not available:** Provide manual instructions (workspace setup, agent configuration).
- **Transport conflicts:** Defer to onboarding agent to handle transport-specific issues.

---

## What This Skill Does NOT Do

To keep the boundary clean, this skill explicitly avoids:

- **Asking for team rosters or roles** — Squad's casting handles composition
- **Selecting archetypes** — archetype is a team property, chosen during onboarding
- **Selecting transport mechanisms** — transport (worktree or directory) is chosen per-team during onboarding
- **Collecting deliverable filenames or schemas** — that's archetype config, handled by the archetype's setup skill during onboarding
- **Defining pipeline steps** — archetype concern
- **Setting up import hooks** — archetype concern
- **Asking users to list all teams upfront** — teams onboard one at a time, each choosing its own archetype
- **Prescribing team sizes** — casting decides based on the work
- **Configuring telemetry endpoints or ports** — runtime defaults handle this

If the user asks about any of these during setup, point them to the right place:
- Team composition → "Squad's casting will handle that when you onboard a team"
- Archetype selection → "Each team picks its archetype during onboarding, based on what it needs to do"
- Deliverable config → "The archetype plugin's setup skill handles that during onboarding"
- Pipeline steps → "Those are defined by the archetype, not core federation"
- Telemetry details → "The runtime uses sensible defaults. Override via environment variables if needed"
