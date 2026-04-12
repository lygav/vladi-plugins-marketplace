---
name: deliverable-setup
description: "Configure a deliverable archetype team — set up output filename, schema, aggregation hooks, and playbook steps. Triggers on: configure deliverable, deliverable setup, set up deliverable team, configure artifact output."
version: 0.1.0
---

# Deliverable Setup Wizard

You are configuring a **deliverable archetype** team. This skill runs after the core federation setup has installed the deliverable archetype plugin. Core config (description, MCP stack, telemetry) is already in `federate.config.json` — don't touch it. Your job is to collect archetype-specific settings and write them to the team's `.squad/archetype-config.json`.

## Triggers

- "configure deliverable"
- "deliverable setup"
- "set up deliverable team"
- "configure artifact output"
- "deliverable archetype config"

## When This Runs

This skill is a **handoff target** from `federation-setup`. The core setup:

1. Walks through generic federation config
2. Installs the deliverable archetype plugin
3. Hands off to this skill for archetype-specific questions

You can also be invoked directly if a user wants to reconfigure an existing deliverable team.

## Prerequisites

Before asking questions, verify:

```bash
test -f federate.config.json
```

If missing:

> "No federation config found. Run the federation setup first — say **'set up federation'** to start."

Check for an existing archetype config:

```bash
test -f .squad/archetype-config.json
```

If it exists, load it and show the current settings:

> "I found existing deliverable settings:
> - **Output file**: `deliverable.json`
> - **Schema**: `deliverable.schema.json`
> - **Steps**: discovery → analysis → deep-dives → validation → distillation
> - **Import hook**: none
>
> Want to update these or start fresh?"

If starting fresh or no config exists, proceed with the questions below.

---

## Step 1: Deliverable Filename

Ask:

> "What should each team's output file be called? This is the file every domain team produces in its worktree root.
>
> Default: `deliverable.json`"

Accept any valid filename. If the user says "default" or skips, use `deliverable.json`.

Validate:
- Must end in `.json`, `.yaml`, `.yml`, `.md`, or `.txt`. Other extensions are fine but confirm: "That's an unusual extension — sure you want `report.csv`?"
- No path separators — this is a filename, not a path.
- No spaces (warn but allow if the user insists).

Store as `outputFilename`.

## Step 2: Schema

Ask:

> "Do you have a JSON schema for the deliverable? Teams will validate their output against it.
>
> Options:
> - **Path to a schema file** (e.g., `schemas/deliverable.schema.json`)
> - **skip** — teams will create one on their first run based on what they discover
>
> Skipping is fine for new projects. The schema emerges from the first iteration and gets refined over time."

If the user provides a path:
- Verify the file exists. If not, warn: "That file doesn't exist yet. Should I record the path anyway (you'll create it later), or skip for now?"
- Store the path as `schemaPath`.

If the user skips:
- Set `schemaPath` to `null`.
- Note that teams will auto-generate a schema during their first distillation phase.

## Step 3: Playbook Steps

Ask:

> "What steps should teams follow when producing their deliverable?
>
> Default workflow:
> 1. **discovery** — Identify domain boundaries and data sources
> 2. **analysis** — Breadth-first survey of relevant sources
> 3. **deep-dives** — In-depth investigation of priority areas
> 4. **validation** — Cross-reference findings, confirm accuracy
> 5. **distillation** — Merge into final deliverable file
>
> You can:
> - **Accept the defaults** (just say 'yes' or 'default')
> - **Add steps** (e.g., 'add a peer-review step after validation')
> - **Remove steps** (e.g., 'skip deep-dives, go straight from analysis to validation')
> - **Reorder steps** (e.g., 'put validation before deep-dives')
> - **Provide a completely custom list**"

Parse the user's response:
- "yes", "default", "looks good", "fine" → use defaults
- Modifications → apply them to the default list
- Custom list → use as-is, but confirm if fewer than 3 steps: "That's a pretty short pipeline. Are you sure, or did you want to add more?"

Store as `playbookSteps` — an ordered array of step names.

Each step object has:
```json
{
  "name": "discovery",
  "description": "Identify domain boundaries and data sources"
}
```

If the user provides custom steps without descriptions, generate brief descriptions based on the step name. Show them for confirmation.

## Step 4: Import Hook

Ask:

> "After the meta-squad collects deliverables from all teams, should it run a custom script to process them?
>
> This is optional. Use it for things like:
> - Transforming the aggregated output into a different format
> - Pushing results to an external system
> - Running custom validation logic
>
> Options:
> - **Path to a script** (e.g., `scripts/post-aggregate.sh`)
> - **skip** — no post-aggregation processing"

If the user provides a path:
- Check if the file exists. If not, warn: "That script doesn't exist yet. Should I record the path anyway, or skip?"
- Check if it's executable (if it exists). If not, note: "Found the file but it's not executable. You may need to `chmod +x` it later."
- Store as `importHook`.

If the user skips:
- Set `importHook` to `null`.

## Step 5: Summary and Confirm

Show the complete configuration:

> "Here's your deliverable archetype configuration:
>
> | Setting | Value |
> |---------|-------|
> | **Output file** | `deliverable.json` |
> | **Schema** | *auto-generate on first run* |
> | **Playbook steps** | discovery → analysis → deep-dives → validation → distillation |
> | **Import hook** | *none* |
>
> This will be written to `.squad/archetype-config.json` in each team's worktree.
>
> **Confirm?** (yes / edit [setting name] / start over)"

Handle responses:
- "yes", "confirm", "looks good" → write the config
- "edit X" → go back to that specific step
- "start over" → restart from Step 1

---

## Write Config

Create `.squad/archetype-config.json`:

```json
{
  "archetype": "deliverable",
  "version": "0.1.0",
  "outputFilename": "deliverable.json",
  "schemaPath": null,
  "playbookSteps": [
    { "name": "discovery", "description": "Identify domain boundaries and data sources" },
    { "name": "analysis", "description": "Breadth-first survey of relevant sources" },
    { "name": "deep-dives", "description": "In-depth investigation of priority areas" },
    { "name": "validation", "description": "Cross-reference findings, confirm accuracy" },
    { "name": "distillation", "description": "Merge into final deliverable file" }
  ],
  "importHook": null,
  "configuredAt": "<ISO-8601>"
}
```

Ensure `.squad/` directory exists first:

```bash
mkdir -p .squad
```

After writing, confirm:

> "Deliverable archetype configured. Teams onboarded with this archetype will use these settings.
>
> **Next steps:**
> - Say **'spin up a team for X'** to onboard your first domain team
> - The team's playbook will follow the steps you defined
> - If you set a schema path, make sure the file exists before the first team runs
> - To change these settings later, say **'configure deliverable'** again"

---

## What This Skill Does NOT Do

- **Core federation config** — that's `federation-setup`
- **Team casting or composition** — Squad handles that
- **Aggregation logic** — that's the `deliverable-aggregation` skill
- **Running the playbook** — that's the `deliverable-playbook` skill
- **Onboarding teams** — that's the onboard agent

If the user asks about these during setup, redirect:

- "How many teams?" → "Squad's casting decides when you onboard. Just say 'spin up a team for X'."
- "How does aggregation work?" → "Check the deliverable-aggregation skill after setup."
- "Can I change the playbook later?" → "Yes — edit `.squad/archetype-config.json` or run this setup again."

---

## Error Handling

- **Permission denied writing config**: Check directory permissions. Suggest `mkdir -p .squad` if the directory doesn't exist.
- **Invalid JSON in existing config**: Warn the user, offer to back up the broken file and start fresh.
- **User provides conflicting settings**: Ask for clarification. Don't guess.
- **Ctrl+C / abort**: No partial config is written. The user can restart cleanly.
