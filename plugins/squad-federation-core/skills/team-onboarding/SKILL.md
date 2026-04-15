---
name: "team-onboarding"
description: "Interactive wizard for onboarding a new team to the federation. Asks mission, discovers archetype, selects placement, then executes mechanical setup autonomously."
version: "0.2.0"
---

## Purpose

Thin conversational wrapper over `scripts/onboard.ts` (ADR-001: Script-Drives-Skill). This skill collects user input conversationally, then delegates ALL logic to the script via `--non-interactive --output-format json`. No decision logic lives here.

## Trigger Phrases

- "onboard a team"
- "spin up a team"
- "add a team for X"
- "create a team"
- "onboard a team for X"

## Prerequisites

Before starting, verify federation is configured:

```bash
test -f federate.config.json
```

If the file doesn't exist, redirect to federation-setup:

> "Federation isn't configured yet. Let me run the setup wizard first."

Then invoke the `federation-setup` skill.

### Bootstrap (run first)

Before running any scripts, ensure the plugin environment is ready:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/bootstrap.mjs
```

## Conversational Flow

This is the CONVERSATIONAL phase — ask questions, collect parameters, then execute the mechanical script.

**🔭 Observability:** This skill emits OpenTelemetry spans and events to track onboarding progress. Call the OTel tools at each step.

**Start onboarding span:**
```tool-call
otel_span action=start name="team.onboard"
```

### Step 1: Understand the Mission

**Ask:** "What should this team work on? Describe their mission."

**Why:** This seeds the team charter and guides archetype selection.

**Examples of good answers:**
- "Audit the payments API for security issues"
- "Migrate the auth service to OAuth2"
- "Document the data pipeline architecture"

**Store as:** mission description (will become team description and context)

**Emit event:**
```tool-call
otel_event name="team.mission.defined" attributes={"mission": "<mission-text>"}
```

### Step 2: Derive Team Name

From the mission, suggest a short team name (lowercase, hyphenated).

**Ask:** "I'll call this team **payments** — sound good, or prefer a different name?"

**Validation:**
- Must be lowercase alphanumeric with hyphens only
- No spaces, no special characters
- Valid git branch segment
- Regex: `^[a-z0-9][a-z0-9-]*$`

**Store as:** team name

### Step 3: Discover and Select Archetype

This is the CRITICAL step — archetype selection happens here, during onboarding.

**Ask guiding questions based on the mission:**

**Question 1:** "Will this team write code, or produce file artifacts like reports or inventories?"

**Question 2 (if coding):** "Will they open pull requests with their changes?"

**Question 3 (if not coding):** "Will they produce structured data (JSON/YAML), documents (markdown), or both?"

**Based on answers, recommend an archetype:**

| Archetype | When to use |
|-----------|-------------|
| **deliverable** | Team produces file artifacts — reports, inventories, audit results, JSON/YAML deliverables |
| **coding** | Team writes code and opens PRs |
| **research** | Team investigates topics and produces documents |
| **task** | Team executes discrete work items |

**Present the recommendation:**

> "Based on your description, I recommend the **deliverable** archetype. This team will produce file artifacts as outputs. Sound right?"

**If user agrees:**
- Proceed with that archetype.

**If user disagrees or is unsure:**
- Show all available archetypes and let them choose.

**Check if the archetype plugin is installed (use the specific archetype name, not placeholder):**

```bash
copilot plugin list | grep squad-archetype-deliverable
```

**If not installed:**

1. Check if the marketplace is registered:
   ```bash
   copilot plugin marketplace list
   ```

2. If `vladi-plugins-marketplace` is not listed:
   ```bash
   copilot plugin marketplace add lygav/vladi-plugins-marketplace
   ```

3. Install the archetype (replace with the actual archetype name):
   ```bash
   copilot plugin install squad-archetype-deliverable@vladi-plugins-marketplace
   ```

**Store as:** archetype name (e.g., `squad-archetype-deliverable`)

**Emit event:**
```tool-call
otel_event name="team.archetype.selected" attributes={"archetype": "<archetype-name>"}
```

### Step 4: Team Placement

**Note:** This step determines WHERE the team's workspace lives. Communication type is inherited from `federate.config.json` and is not asked during onboarding.

**Ask:** "Where should this team's workspace live?"

**Explain the choices:**

- **worktree** *(recommended)* — Git worktree with dedicated branch. Best for most teams. Provides version control and parallel work isolation.
- **directory** — Standalone directory without git branching. Use when the team doesn't need version control or git integration.

**Default:** worktree

**If user chooses worktree, ask:** "Where should the worktree be placed?"

**Explain worktree placement options:**

- **Inside repo** *(recommended)* — `.worktrees/NAME` directory within the repository. Standard Squad convention. Best for most cases.
- **Sibling directory** — Parallel to the repo (e.g., `../NAME/`). Use when you need to keep team workspaces separate from the main repository tree.

**Default:** Inside repo at `.worktrees/NAME`

**If user chooses "sibling directory":** Ask for the base path (e.g., `../` to place sibling to repo, or custom path). The team name will be appended to this path.

**If user chooses directory placement, ask:** "Where should the directory be created? (provide a path, or I'll use `.teams/NAME`)"

**Store as:**
- Placement type: `worktree` or `directory`
- Worktree directory (if worktree): `.worktrees` (default inside repo) or custom base path for sibling
- Path (if directory): custom path or default to `.teams/NAME`

**Emit event:**
```tool-call
otel_event name="team.placement.selected" attributes={"placement": "<worktree|directory>", "location": "<path>"}
```

### Step 5: Confirm Summary

Present a summary of all collected parameters:

```
📋 Team Setup Summary:
   Name: payments
   Mission: Audit the payments API for security issues
   Archetype: deliverable
   Placement: worktree (inside repo)
   Location: .worktrees/payments
   Communication: file-signal (from federate.config.json)
   Branch: squad/payments

Ready to create this team? [Y/n]
```

(Adjust the summary based on the actual placement choice — show "worktree (sibling)" or "directory" as appropriate)

**If user confirms:** Proceed to Step 6.

**If user wants to change something:** Loop back to the relevant step.

### Step 6: Execute Mechanical Setup

Now that we have all parameters, call the mechanical script with fully resolved values and `--non-interactive --output-format json`.

The onboard script is located at `scripts/onboard.ts` relative to the plugin root.

**Build the command:**
```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/onboard.ts \
  --name "<team-name>" \
  --mission "<mission>" \
  --archetype "<archetype>" \
  --placement "<placement>" \
  --non-interactive \
  --output-format json
```

Add optional flags as needed:
- `--domain-id "<uuid>"` — omit to auto-generate
- `--worktree-dir "<path>"` — only if user chose non-default worktree location
- `--path "<path>"` — only if directory placement

**Parse the JSON output.** The script returns an `OnboardResult`:
- If `success: true` — show the team details from the JSON
- If `success: false` — show the `errors` array and offer recovery

### Step 7: Run Archetype Setup Skill (if applicable)

After the mechanical onboarding completes, the archetype may have its own setup wizard for team-specific configuration.

**Check if archetype has a setup skill:**

```bash
copilot skill list | grep -E "archetype.*setup|deliverable.*setup|coding.*setup"
```

**If found, invoke it:**

> "Workspace is ready. Now let's configure the {archetype} archetype settings for this team."

For example, for deliverable archetype, invoke the `deliverable-setup` skill.

For coding archetype, invoke the `coding-setup` skill.

**If no setup skill exists:** Skip this step.

### Step 8: Suggest Next Steps

Tell the user the team is ready and how to launch it (use the actual team name, not placeholder):

```
✅ Team 'payments' onboarded successfully!

📍 Location: .worktrees/payments
🌿 Branch: squad/payments
🎯 Archetype: deliverable

📚 Next steps:
   1. Launch the team: npx tsx scripts/launch.ts --team payments
   2. Monitor progress: npx tsx scripts/monitor.ts
   3. Send directives: npx tsx scripts/directive.ts --team payments --message "..."
```

**End onboarding span:**
```tool-call
otel_span action=end name="team.onboard" status=ok
```

## Error Handling

All validation and error handling lives in the script. The skill reads the JSON `errors` array and presents them conversationally. Do NOT duplicate validation logic here.

## What This Skill Does NOT Do

- **No decision logic** — The script validates archetypes, placements, and names
- **No sub-agents** — We stay in the user's session
- **No filesystem operations** — The script handles all I/O
- **No team roster/role decisions** — Squad casting handles composition

If the user asks about these during onboarding:
- Team composition → "Squad's casting will handle that when you launch the team"
- Multiple teams → "Let's onboard one team first, then repeat"

## Integration with Other Skills

**Called by:**
- `federation-setup` skill (Step 6: onboard first team)
- `federation-orchestration` skill (when user says "spin up a team")

**Calls:**
- Archetype setup skills (e.g., `deliverable-setup`, `coding-setup`) for archetype-specific configuration

**Does NOT call:**
- `onboard` agent (we ARE the conversational onboard flow)
- Any sub-agents (we stay in the user's session)
