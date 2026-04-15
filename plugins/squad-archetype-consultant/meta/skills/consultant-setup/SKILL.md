---
name: consultant-setup
description: "Configure a consultant archetype team. Triggers on: configure consultant, consultant setup, set up consultant team."
version: 0.1.0
---

# Consultant Setup Wizard

You are configuring a **consultant archetype** team. This skill runs after team onboarding has selected the consultant archetype and completed the mechanical workspace setup. Core federation config (description, MCP stack, telemetry) is in `federate.config.json` — don't touch it. Your job is to collect archetype-specific settings and write them to the team's `.squad/archetype-config.json`.

## Triggers

- "configure consultant"
- "consultant setup"
- "set up consultant team"

## When This Runs

This skill is a **handoff target** from the **team-onboarding skill**. The onboarding flow:

1. Asks about the team's mission
2. Discovers and selects the consultant archetype
3. Installs the archetype plugin if needed
4. Runs onboard.ts to create the workspace and seed archetype templates
5. Hands off to this skill for archetype-specific configuration questions

You can also be invoked directly if a user wants to reconfigure an existing consultant team.

## Prerequisites

Before asking questions, verify:

```bash
test -f federate.config.json
```

If missing:

> "No federation config found. Run the federation setup first — say **'set up federation'** to start."

## Configuration Questions

Walk through these questions to collect archetype-specific settings:

### Question 1: Domain Coverage

Ask:

> "What domain or codebase will this consultant cover? (e.g., 'authentication system', 'payment APIs', 'infrastructure documentation')"

Capture: `domain` — The specific area of expertise

### Question 2: Codebase Location

Ask:

> "Where is the codebase or documentation set?
> - Provide a repository URL (e.g., 'https://github.com/org/repo')
> - Local path (e.g., '/path/to/codebase')
> - Documentation URL (e.g., 'https://docs.example.com')"

Capture: `codebaseLocation` — Where the consultant indexes knowledge from

### Question 3: Question Types

Ask:

> "What kinds of questions should this consultant handle? (select all that apply)
> - Architecture and design decisions
> - API usage and integration patterns
> - Debugging and troubleshooting
> - Code conventions and best practices
> - Other (specify)"

Capture: `questionTypes` — Array of question categories

### Question 4: Indexing Depth

Ask:

> "How deep should the initial indexing go?
> - **surface**: Quick overview, key files only (~5-10 min)
> - **moderate**: Core functionality and patterns (~15-30 min)
> - **deep**: Comprehensive analysis with edge cases (~1+ hour)"

Capture: `indexingDepth` — Controls how much time is spent on initial analysis

### Question 5: Proactive Mode

Ask:

> "Should the consultant proactively share insights when it discovers important patterns, or only answer when asked?"

Capture: `proactiveInsights` — Boolean flag for unsolicited knowledge sharing

## Write Configuration

After collecting settings, write to `.squad/archetype-config.json`:

```json
{
  "archetype": "consultant",
  "version": "0.1.0",
  "settings": {
    "domain": "<collected>",
    "codebaseLocation": "<collected>",
    "questionTypes": ["<collected>"],
    "indexingDepth": "<surface|moderate|deep>",
    "proactiveInsights": false
  }
}
```

Confirm:

> "✅ Consultant archetype configured! Teams can now be onboarded with `npx tsx scripts/onboard.ts`"
