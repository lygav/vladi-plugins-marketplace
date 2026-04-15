---
title: Archetype Overview
description: What archetypes are and how they define team behavior
---

# Archetype Overview

**Archetypes** define the lifecycle, states, and skills for different types of teams in Squad Federation. Think of them as templates or roles that teams adopt.

## What is an Archetype?

An archetype specifies:

1. **States** - Valid lifecycle phases (e.g., `scanning`, `complete`)
2. **Skills** - Knowledge base files teams can access
3. **Agents** (optional) - Specialized sub-agents for the archetype
4. **Monitors** (optional) - Custom monitoring logic

## Built-In Archetypes

Squad Federation provides three built-in archetypes:

| Archetype | Purpose | Use Case |
|-----------|---------|----------|
| **coding** | Write code, implement features | Feature development, bug fixes |
| **deliverable** | Create documents, reports | Documentation, analysis reports |
| **consultant** | Provide recommendations | Architecture review, code review |

## Archetype Directory Structure

```
archetypes/
├── archetype.json                              ← Root manifest
└── plugins/
    ├── squad-archetype-coding/
    │   ├── archetype.json                      ← Coding archetype config
    │   └── team/
    │       ├── agents/                         ← Custom agents
    │       │   ├── lead.md
    │       │   └── assistant.md
    │       ├── monitors/                       ← Custom monitors
    │       │   └── coding-monitor.ts
    │       └── skills/                         ← Archetype skills
    │           ├── git-workflow.md
    │           └── testing-standards.md
    ├── squad-archetype-deliverable/
    │   ├── archetype.json
    │   └── team/
    │       ├── agents/
    │       └── skills/
    └── squad-archetype-consultant/
        ├── archetype.json
        └── team/
            ├── agents/
            └── skills/
```

## Root Manifest

**File:** `archetypes/archetype.json`

```json
{
  "archetypes": {
    "coding": {
      "path": "./plugins/squad-archetype-coding",
      "archetypeJson": "./plugins/squad-archetype-coding/archetype.json"
    },
    "deliverable": {
      "path": "./plugins/squad-archetype-deliverable",
      "archetypeJson": "./plugins/squad-archetype-deliverable/archetype.json"
    },
    "consultant": {
      "path": "./plugins/squad-archetype-consultant",
      "archetypeJson": "./plugins/squad-archetype-consultant/archetype.json"
    }
  }
}
```

**Purpose:** Central registry of all available archetypes

**Fields:**
- `archetypes` - Map of archetype ID → paths
- `path` - Directory containing archetype files
- `archetypeJson` - Path to archetype config file

## Archetype Config

**File:** `{archetype-path}/archetype.json`

**Example (coding):**

```json
{
  "archetypeId": "coding",
  "name": "Coding Team",
  "states": [
    "initializing",
    "scanning",
    "distilling",
    "complete",
    "failed",
    "paused"
  ],
  "skills": [
    "team/skills/git-workflow.md",
    "team/skills/testing-standards.md",
    "team/skills/code-review.md"
  ]
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `archetypeId` | string | Unique identifier (matches root manifest key) |
| `name` | string | Display name |
| `states` | string[] | Valid lifecycle states |
| `skills` | string[] | Skill file paths (relative to archetype dir) |

## States

States represent team lifecycle phases.

### Common States

| State | Description | Transitions |
|-------|-------------|-------------|
| `initializing` | Team starting up | → `scanning` |
| `scanning` | Analyzing codebase | → `distilling`, `failed`, `paused` |
| `distilling` | Processing findings | → `complete`, `failed`, `paused` |
| `complete` | Work finished | (terminal) |
| `failed` | Error occurred | (terminal) |
| `paused` | Manually paused | → any previous state |

### State Machine Example (Coding)

```
initializing
    ↓
scanning ←→ paused
    ↓
distilling ←→ paused
    ↓
complete (✓)

(any state) → failed (✗)
```

### Custom States

Archetypes can define custom states:

```json
{
  "states": [
    "initializing",
    "requirements-gathering",
    "design",
    "implementation",
    "testing",
    "deployment",
    "complete",
    "failed"
  ]
}
```

Teams track their current state in `.squad/status.json`:

```json
{
  "state": "scanning",
  "step": "analyzing authentication module",
  "updated_at": "2025-01-30T12:30:00Z"
}
```

## Skills

Skills are markdown files containing knowledge, patterns, or guidelines.

**Structure:**

```markdown
---
tags: [testing, performance]
category: pattern
source: frontend
promoted: 2025-01-30
---

# Parallel Test Execution

Run tests in parallel to reduce CI time.

## Implementation

jest.config.js:
\`\`\`javascript
module.exports = {
  maxWorkers: '50%'
};
\`\`\`

## Impact
- CI time: 8m → 3m
- No flakiness observed
```

**Metadata:**

- `tags` - Keywords for search
- `category` - Skill type (`pattern`, `discovery`, `convention`, `gotcha`)
- `source` - Originating team (if graduated from learning)
- `promoted` - Graduation date

**Purpose:**

- Provide team-specific knowledge base
- Share best practices across teams
- Document conventions and patterns

## Agents

Archetypes can include custom agents for specialized tasks.

**Example:** `team/agents/lead.md`

```markdown
---
name: Lead
temperature: 0.1
description: Primary architect and planner
tools: [bash, edit, view]
---

You are the lead agent for this coding team. Your role is to:

1. Scan the codebase for relevant files
2. Create a plan of attack
3. Delegate tasks to assistant agents
4. Review and integrate results

Focus on architecture and high-level decisions.
```

**Purpose:**

- Delegate work to specialized agents
- Customize agent behavior per archetype
- Provide role-specific instructions

## Monitors

Archetypes can provide custom monitoring logic.

**Example:** `team/monitors/coding-monitor.ts`

```typescript
import { MonitorBase, MonitorResult } from '@squad/sdk';

export class CodingMonitor extends MonitorBase {
  async monitor(teamId: string): Promise<MonitorResult> {
    const files = await this.listChangedFiles(teamId);
    const tests = await this.countTests(files);
    
    this.emitMetrics('code.files_changed', files.length, { domain: teamId });
    
    if (tests < files.length * 0.5) {
      return {
        health: 'warning',
        message: 'Test coverage may be low'
      };
    }
    
    return { health: 'healthy', message: 'On track' };
  }
}
```

**Purpose:**

- Validate team progress
- Emit custom metrics
- Provide archetype-specific health checks

## Choosing an Archetype

### When to use `coding`

- Implementing features
- Fixing bugs
- Refactoring code
- Writing tests

**Output:** Code changes, commits

### When to use `deliverable`

- Writing documentation
- Creating reports
- Generating analysis
- Producing artifacts (non-code)

**Output:** Markdown files, reports, documentation

### When to use `consultant`

- Reviewing code
- Providing recommendations
- Architecture guidance
- Answering questions

**Output:** Recommendations, findings, advice (no changes)

## Creating Custom Archetypes

See [Creating Archetypes](/archetypes/creating-archetypes) for a full guide.

**Quick example:**

1. Create directory: `archetypes/plugins/my-archetype/`
2. Add `archetype.json`:
   ```json
   {
     "archetypeId": "my-archetype",
     "name": "My Custom Archetype",
     "states": ["initializing", "working", "complete", "failed"],
     "skills": []
   }
   ```
3. Register in `archetypes/archetype.json`:
   ```json
   {
     "archetypes": {
       "my-archetype": {
         "path": "./plugins/my-archetype",
         "archetypeJson": "./plugins/my-archetype/archetype.json"
       }
     }
   }
   ```
4. Onboard team:
   ```bash
   npx tsx scripts/onboard.ts \
     --archetype my-archetype \
     ...
   ```

## Team Initialization

When a team is onboarded, the archetype files are copied to the team's workspace:

**Before onboarding:**
```
.worktrees/frontend/    (empty or doesn't exist)
```

**After onboarding:**
```
.worktrees/frontend/
├── .squad/
│   ├── status.json
│   ├── signals/
│   └── learnings/
├── team/
│   ├── agents/
│   │   ├── lead.md
│   │   └── assistant.md
│   └── skills/
│       ├── git-workflow.md
│       └── testing-standards.md
└── ... (user's code)
```

**Purpose:** Give each team a fresh copy of the archetype files.

## Archetype vs Team

| Concept | Scope | Purpose |
|---------|-------|---------|
| **Archetype** | Template | Defines what a type of team can do |
| **Team** | Instance | A specific team using an archetype |

**Analogy:**
- Archetype = Class definition
- Team = Instance of that class

**Example:**
- Archetype: `coding` (template for code-writing teams)
- Team: `frontend` (specific team using `coding` archetype)

## Next Steps

- [Create custom archetypes](/archetypes/creating-archetypes)
- [Learn about the coding archetype](/archetypes/coding)
- [Learn about the deliverable archetype](/archetypes/deliverable)
- [Learn about the consultant archetype](/archetypes/consultant)
