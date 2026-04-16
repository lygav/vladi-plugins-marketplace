---
name: "federation-setup"
description: "The user wants to CREATE a new federation from scratch — no federate.config.json exists yet. Triggers on: federate this project, set up federation, go multi-team, I need multiple teams, I need a team org, create a meta-squad, configure federation, federate init, initialize federation, new federation, team organization, I want teams. Should NOT activate if federation is already configured — use federation-orchestration instead."
version: "0.3.0"
---

## Purpose

Thin conversational wrapper around `scripts/setup.ts` (ADR-001 script-drives-skill model). This skill collects user preferences conversationally and delegates all mechanical work — config validation, file writing, prerequisite checks — to the setup script.

**Skill owns:** conversational flow, casting framing, presenting results.
**Script owns:** config generation, file writing, prerequisite validation, OTel events.

Core config covers *only* what the federation runtime needs. Archetype-specific settings live with the archetype — not here.

Team composition is handled by Squad's casting system. Don't ask for roles, team size, or member lists.

## Bootstrap

Before running any scripts, ensure the plugin environment is ready:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/bootstrap.mjs
```

## Conversational Setup Flow

Walk through each step in order. One question at a time. Provide sensible defaults. Keep it conversational.

### Step 1: What are you building?

**Ask:** "What's the goal for your team organization? Describe what you're trying to accomplish."

**Why:** This seeds agent charters and gives casting context. It's the first thing anyone reading the config will see.

**Store as:** `--description` flag for `setup.ts`.

**Examples of good responses:**
- "Inventory all Azure services across our org"
- "Build a multi-team code review pipeline"
- "Coordinate security audits across 12 microservices"

Accept whatever the user gives. Don't try to normalize it.

### Step 1½: Federation Persona Name

Based on the user's mission description, **generate a short, memorable persona name** for the meta-squad leadership. This is how the user will address the squad in Teams and conversation.

**Guidelines for name generation:**
- Single word, lowercase, easy to type
- Evocative of the mission (e.g., "sentinel" for security, "atlas" for infrastructure, "scout" for discovery)
- Not a common command or tool name (avoid "build", "test", "deploy")

**Ask:** "Your leadership squad needs a name — I'm thinking **<generated name>** based on your mission. Sound good, or want something different?"

**Store as:** `--federation-name <name>` flag for `setup.ts`.

### Step 2: Telemetry

**Context:** Copilot CLI has no built-in telemetry — headless team sessions are black boxes by default. This plugin includes OTel integration feeding into a central dashboard.

**Ask:** "Your teams will run in headless sessions. Want me to set up a central monitoring dashboard? You'll see real-time traces, metrics, and logs from every team."

**Default logic:**
- Docker available → default **yes**
- Docker not available → default **no**, explain: "Docker is needed for the Aspire dashboard. You can enable this later."

**Store as:** `--telemetry` or `--no-telemetry` flag. If yes and user provides endpoint: `--telemetry-endpoint <url>`.

**If yes and Docker is available**, after the script runs, start the dashboard:

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/dashboard.ts start
```

### Step 3: Teams Notifications (Optional)

**Ask:** "Want to get updates and interact with the leadership team via a Teams channel? (optional — you can always add this later)"

**Default:** No.

**If yes:** Ask for Teams team ID and channel ID. Help them find these if needed.

**Then ask:** "What command do you use to start Copilot CLI? The Teams bridge needs to run a persistent session in the background."
- Offer choices: "copilot (default)", "Custom command"
- If custom: accept the full command string

**Store as:** `--teams-notification --teams-team-id <id> --teams-channel-id <id>` flags. If custom copilot command: `--copilot-command "<command>"`. If custom poll interval: `--presence-interval <seconds>`.

### Step 4: Run setup.ts

Once all preferences are collected, call the script:

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/setup.ts \
  --description "<user's description>" \
  --federation-name "<persona name>" \
  --telemetry \
  --telemetry-endpoint "http://localhost:4318" \
  --non-interactive \
  --output-format json
```

Add `--teams-notification --teams-team-id <id> --teams-channel-id <id>` if Teams was enabled.
Add `--copilot-command "<command>"` if user specified a custom copilot command.
Add `--presence-interval <seconds>` if user chose a custom Teams poll interval.
Add `--no-telemetry` if telemetry was disabled.

**Parse the JSON output** and present results to the user:

- Show the generated config
- Show prerequisite results (the script validates everything)
- Report any warnings

If the script reports errors, show them and help the user fix the issues.

If the user wants to change something, re-run `setup.ts` with adjusted flags. Loop until they confirm.

### Step 4½: Teams Introduction (if Teams enabled)

If Teams was enabled, **immediately post an introduction message** to the configured channel so the user knows the federation is listening:

```
Tool: PostChannelMessage
Parameters:
  teamId: <from federate.config.json → teamsConfig.teamId>
  channelId: <from federate.config.json → teamsConfig.channelId>
  content: "👋 Hi! I'm **<federationName>** — your leadership squad for: *<mission description>*.\n\nAddress me as **@<federationName>** in this channel to give instructions. Examples:\n- `@<name> launch the frontend team`\n- `@<name> pause backend`\n- `@<name> show me status`\n\nI'll post periodic status updates here automatically."
```

This makes the federation immediately discoverable in Teams.

### Step 5: Cast the meta-squad

This stays in the skill — it's Squad framework interaction, not mechanical.

Check if the meta-squad actually has members:

```bash
grep -c "| .* | .* | .* | Active |" .squad/team.md
```

**If members exist (count > 0):** Skip casting.
> "Your meta-squad has [N] members. Moving on."

**If team.md exists but Members table is empty (count = 0):** Proceed with casting:

> "Squad is initialized but your leadership team hasn't been cast yet. Let's do that now."

Frame the casting with this context so Squad generates delegation-aware charters naturally:

> "This is a **federation meta-squad** — a leadership team that governs and coordinates multiple autonomous domain teams. The meta-squad does NOT produce work directly. Its role is to:
> - Set standards and enforce consistency across teams
> - Delegate work by launching domain teams and sending directives
> - Monitor progress, give feedback, and resolve cross-team dependencies
> - Manage knowledge flows between teams
>
> Cast leadership roles (strategy, architecture, quality, coordination) — NOT implementation roles. Those belong to domain teams."

Don't prescribe specific roles. Let Squad's casting handle composition. But ensure casting COMPLETES — verify at least one member appears.

**If team.md doesn't exist:** The setup script should have run `squad init`. If it still doesn't exist, run `squad init` manually, then cast.

**After the meta-squad is successfully cast**, emit an OTel event:

Use the `otel_event` tool with: name="meta.squad.cast", attributes='{"team_size": <member_count>}'

### Step 6: Onboard first team

**Ask:** "Ready to spin up your first team? What should it work on?"

**If yes:** Continue using the `team-onboarding` skill flow.

**If no:** Close out with:
> "No problem. When you're ready, just say **'spin up a team for X'** or **'onboard a team'**."

**When setup is complete** (config written and meta-squad cast), emit final OTel events:

Use the `otel_span` tool with: action="end", name="federation.setup", status="ok"
Use the `otel_event` tool with: name="federation.setup.complete"

---

## Post-Setup

After the config is written and confirmed, provide these reference notes:

### Adding teams

> Say **"spin up a team for X"** anytime to onboard a new team.

### Changing configuration

> Edit `federate.config.json` directly. The schema is minimal — `description`, `telemetry`, and optionally `teamsConfig`. Changes take effect on the next team onboard or launch.

### Adding archetypes

> Each team picks its own archetype during onboarding. Install additional archetypes from the marketplace:
> ```bash
> copilot plugin marketplace add lygav/vladi-plugins-marketplace
> copilot plugin install squad-archetype-{type}@vladi-plugins-marketplace
> ```

---

## Error Handling

### Script Failures
If `setup.ts` returns `success: false`, check the `errors` array in JSON output. Common issues:
- **git not found:** Provide install instructions.
- **Node.js too old:** Recommend `nvm install 20`.
- **Not in git repo:** Tell user to run `git init`.

### During Setup
- **Config file already exists:** The script will overwrite. Warn the user and show current config first.

### During Casting
- **Squad not initialized:** Run `squad init` first, then cast.

---

## What This Skill Does NOT Do

- **Asking for team rosters or roles** — Squad's casting handles composition
- **Selecting archetypes** — chosen during onboarding
- **Selecting transport mechanisms** — chosen per-team during onboarding
- **Collecting deliverable filenames or schemas** — archetype config
- **Writing files directly** — `setup.ts` handles all file I/O

If the user asks about any of these during setup, point them to the right place:
- Team composition → "Squad's casting will handle that when you onboard a team"
- Archetype selection → "Each team picks its archetype during onboarding"
- Deliverable config → "The archetype plugin handles that during onboarding"
