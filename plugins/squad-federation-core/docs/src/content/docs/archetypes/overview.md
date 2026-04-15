---
title: Archetypes Overview
description: Team templates that define behavior, lifecycle, and skills
---

# Archetypes Overview

An **archetype** is a team template—it defines a team's purpose, lifecycle states, skills, and agent configuration. Archetypes are the blueprints for creating specialized teams.

## What is an Archetype?

Think of an archetype as a job description combined with operational instructions:

- **What** the team does (purpose, outputs)
- **How** the team works (agents, tools, temperature)
- **When** states transition (lifecycle state machine)
- **What it knows** (skills, conventions, patterns)

Squad Federation ships with three built-in archetypes:

1. **Coding** — Implements features, fixes bugs, writes tests
2. **Deliverable** — Creates docs, reports, analysis (no code changes)
3. **Consultant** — Provides recommendations without modifying code

You can also create custom archetypes for specialized workflows.

## Archetype Structure

Every archetype has two layers:

### 1. Root Archetype Plugin

Located in `plugins/squad-archetype-{name}/`, this is the archetype definition installed in your Copilot workspace.

**Structure:**
```
plugins/squad-archetype-coding/
  ├── plugin.json              ← Plugin metadata
  ├── archetype.json           ← Archetype definition (meta-level)
  ├── meta/                    ← Skills for the meta squad
  │   └── skills/
  │       └── coding-conventions.md
  └── team/                    ← Files seeded to team workspaces
      ├── archetype.json       ← Team state machine
      ├── system-prompt.md     ← Agent instructions
      └── skills/
          ├── git-workflow.md
          └── testing-standards.md
```

**Root `archetype.json`** (meta-level):
```json
{
  "id": "coding",
  "name": "Coding Team",
  "description": "Teams that write and modify code",
  "version": "1.0.0",
  "defaultAgents": {
    "lead": {
      "model": "claude-sonnet-4",
      "temperature": 0.1,
      "tools": ["bash", "edit", "view", "grep", "glob"]
    }
  }
}
```

This defines the archetype metadata but doesn't specify the runtime state machine.

### 2. Team Archetype Runtime

When you onboard a team, files from `team/` are copied to the team's workspace. The **team `archetype.json`** defines the runtime state machine.

**Team workspace:**
```
.squad/worktrees/backend-api/   (or .squad/teams/backend-api/)
  ├── .squad/
  │   ├── archetype.json        ← Runtime state machine
  │   ├── system-prompt.md      ← Team-specific instructions
  │   ├── skills/               ← Team skills
  │   ├── signals/              ← Inbox/outbox
  │   └── deliverable.md        ← Output
```

**Team `archetype.json`** (runtime state machine):
```json
{
  "states": {
    "preparing": {
      "description": "Reading mission, planning work",
      "transitions": ["implementing", "failed"]
    },
    "implementing": {
      "description": "Writing code, making changes",
      "transitions": ["testing", "failed"]
    },
    "testing": {
      "description": "Running tests, validating changes",
      "transitions": ["pr-open", "implementing", "failed"]
    },
    "pr-open": {
      "description": "Pull request opened, awaiting review",
      "transitions": ["pr-review", "failed"]
    },
    "pr-review": {
      "description": "Addressing review comments",
      "transitions": ["pr-approved", "implementing", "failed"]
    },
    "pr-approved": {
      "description": "PR approved, ready to merge",
      "transitions": ["merged", "failed"]
    },
    "merged": {
      "description": "Changes merged to main",
      "transitions": ["complete"]
    },
    "complete": {
      "description": "Work finished",
      "terminal": true
    },
    "failed": {
      "description": "Error occurred",
      "terminal": true
    }
  },
  "initialState": "preparing",
  "pauseable": true
}
```

This state machine drives the team's lifecycle. Agents transition between states as work progresses.

## meta/ vs team/

```
plugins/squad-archetype-coding/
  ├── meta/                   ← Files for meta squad
  │   └── skills/
  │       └── coding-conventions.md    ← Meta reads this
  └── team/                   ← Files seeded to teams
      ├── archetype.json               ← Team state machine
      ├── system-prompt.md             ← Team agent instructions
      └── skills/
          ├── git-workflow.md          ← Team reads this
          └── testing-standards.md
```

**meta/ skills:**
- Used by the meta squad when coordinating
- Example: "What archetypes are available?" → reads `meta/skills/`

**team/ files:**
- Copied to team workspace on onboard
- Team agents read these during execution
- Example: Team reads `team/skills/git-workflow.md` when committing code

## Built-In Archetypes

### Coding

**Purpose:** Write and modify code

**Outputs:** Code changes, commits, pull requests

**States:** preparing → implementing → testing → pr-open → pr-review → pr-approved → merged → complete

**Use when:** Building features, fixing bugs, refactoring

[View coding archetype →](/vladi-plugins-marketplace/archetypes/coding)

---

### Deliverable

**Purpose:** Create documentation and reports

**Outputs:** Markdown documents, analysis reports

**States:** preparing → scanning → distilling → aggregating → complete

**Use when:** Writing docs, creating architecture diagrams, generating reports

[View deliverable archetype →](/vladi-plugins-marketplace/archetypes/deliverable)

---

### Consultant

**Purpose:** Provide recommendations without code changes

**Outputs:** Code reviews, architecture recommendations

**States:** onboarding → indexing → ready → researching → waiting-for-feedback → retired

**Use when:** Code reviews, architecture analysis, security audits

[View consultant archetype →](/vladi-plugins-marketplace/archetypes/consultant)

## Lifecycle States

All archetypes share common state patterns:

### Work States

States where the team is actively progressing:
- `preparing` / `initializing` / `onboarding`
- `scanning` / `implementing` / `researching`
- `distilling` / `testing` / `composing`

### Terminal States

States where work has concluded:
- `complete` — Work successfully finished
- `failed` — Error occurred, cannot proceed

### Optional States

- `paused` — Manually paused (if `pauseable: true`)

### State Transitions

Defined in `archetype.json`:

```json
{
  "states": {
    "scanning": {
      "description": "Analyzing codebase",
      "transitions": ["distilling", "failed"]
    }
  }
}
```

**Rules:**
- A state can only transition to states in its `transitions` array
- Terminal states (`terminal: true`) have no outgoing transitions
- Pauseable archetypes allow `paused` from any non-terminal state

## Skills in Archetypes

Skills are markdown files with YAML frontmatter that teams read for context-specific knowledge.

**Example:** `team/skills/git-workflow.md`

```markdown
---
tags: [git, workflow, conventions]
category: convention
---

# Git Workflow

## Branching

- Feature branches: `squad/{domain}/{feature}`
- Never commit to `main` directly

## Commits

- Use conventional commits: `feat:`, `fix:`, `refactor:`
- Keep commits focused (one logical change)
- Write descriptive messages

## Pull Requests

- Link to issue
- Include description
- Add attribution: `Co-authored-by: {TeamName} (Squad) <noreply@squad.ai>`
```

Teams automatically load skills from `.squad/skills/` when executing.

## Creating Custom Archetypes

You can build archetypes tailored to your workflows. Use the **archetype-creator** skill to guide you through the process conversationally.

**Via Copilot:** "Create a custom archetype for database migrations"

This will walk you through:
1. Defining purpose and outputs
2. Designing lifecycle states
3. Specifying agent tools and temperature
4. Generating skills
5. Writing the archetype manifest

[Learn more about creating archetypes →](/vladi-plugins-marketplace/archetypes/creating-archetypes)

## Next Steps

- [View coding archetype](/vladi-plugins-marketplace/archetypes/coding)
- [View deliverable archetype](/vladi-plugins-marketplace/archetypes/deliverable)
- [View consultant archetype](/vladi-plugins-marketplace/archetypes/consultant)
- [Create custom archetypes](/vladi-plugins-marketplace/archetypes/creating-archetypes)
