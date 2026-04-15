---
title: Archetype System
description: Work patterns, state machines, meta/team split, and archetype extensibility
---

# Archetype System

Archetypes define **what a squad does** — the work pattern, deliverable structure, playbook, cleanup behavior, and lifecycle state machine. Core defines **how squads operate** — git mechanics, signals, telemetry, knowledge flow.

Archetypes own their lifecycle state definitions. Core validates state transitions at runtime but never interprets state semantics. This is **Dependency Inversion** — both core and archetype layers depend on the `states` schema abstraction, not on each other's implementations.

## On-Demand Skill Acquisition

Archetype plugins teach the federation new capabilities on install. When the meta-squad installs `squad-archetype-deliverable`, it gains:

- **Team-facing skills**: the deliverable playbook (discovery → distillation, schema evolution)
- **Meta-squad-facing skills**: aggregation workflow (collect, validate, import)
- **Agents**: aggregator agent for autonomous collection
- **Templates**: prompt templates, cleanup hooks, merge tools

No configuration needed — Copilot auto-discovers skills from installed plugins.

Archetypes provide skills for **both actors**:

| Actor | Gets | Example |
|-------|------|---------|
| **Team** | Playbook, prompt templates, cleanup hook | "How to produce a deliverable" |
| **Meta-squad** | Aggregation, validation, review guidance | "How to collect and validate team output" |

Multiple archetypes can coexist — a meta-squad managing coding teams AND deliverable teams has skills from both archetypes available simultaneously.

## Marketplace Skill Discovery at Onboarding

During team onboarding, core browses installed marketplaces for skills relevant to the new team's domain. Keywords from the team description are matched against plugin names:

```
User: "Spin off a backend team for the payments API"
                    │
                    ▼
    Core browses installed marketplaces
    Keywords: "backend", "payments", "API"
                    │
                    ▼
    "Found 'api-testing' and 'security-guidance'
     in awesome-copilot marketplace.
     Install for this team?"
```

Marketplace skills are team-scoped — installed into the team's workspace. Meta-squad skills come exclusively from archetype plugin installs (global).

## Meta vs Team Directory Convention

Archetypes organize code by audience and deployment location:

```
squad-archetype-backend/
  ├── meta/                   # Stays in plugin, orchestration code
  │   ├── agents/
  │   │   └── aggregator.md
  │   ├── skills/
  │   │   ├── aggregate-results.md
  │   │   ├── monitor-dashboard.md
  │   │   └── triage-teams.md
  │   ├── scripts/
  │   │   ├── monitor.ts
  │   │   ├── triage.ts
  │   │   └── recovery.ts
  │   └── commands/
  │       └── deploy-backend.md
  │
  └── team/                   # Copied to team workspace at onboarding
      ├── skills/
      │   ├── backend-playbook.md
      │   ├── testing-guide.md
      │   └── deployment-checklist.md
      ├── templates/
      │   ├── api-endpoint.ts.template
      │   └── test-spec.ts.template
      └── hooks/
          └── cleanup-hook.sh
```

**Meta directory** — Orchestration layer (meta-squad POV):
- Runs in plugin, has access to full Node.js environment
- Can import SDK: `import { MonitorCollector } from '@squad/federation-core/sdk'`
- Implements monitoring, triage, recovery, aggregation
- Never copied to team workspaces

**Team directory** — Execution layer (team agent POV):
- Copied to team workspace during onboarding
- Becomes `.squad/archetype/*` in team's workspace
- Skills, templates, hooks for the team agent to use
- No imports, pure markdown/shell/templates

## archetype.json Schema

Installed into each team workspace by the archetype plugin's setup skill:

```json
{
  "archetype": "squad-archetype-inventory",
  "version": "0.2.0",
  "installed_at": "2025-07-20T10:00:00Z",
  "playbook_skill": "service-onboarding-playbook",
  "deliverable_schema": "docs/schemas/domain.schema.json",
  "cleanup_hook": ".squad/cleanup-hook.sh",
  "states": {
    "lifecycle": [
      "preparing",
      "scanning",
      "distilling",
      "aggregating",
      "reviewing"
    ],
    "terminal": ["complete", "failed"],
    "pauseable": true
  }
}
```

### State Machine Schema

- `lifecycle`: Ordered array of progression states
- `terminal`: Final states that end the team's work
- `pauseable`: Whether teams can pause mid-lifecycle and resume

If `states` is missing, core falls back to generic defaults (preparing, working, complete, failed, paused, waiting for feedback, finished).

### Example State Progressions

**Deliverable:** `preparing → scanning → distilling → aggregating → reviewing → complete/failed`

**Coding:** `preparing → implementing → testing → pr-open → pr-review → pr-approved → merged → complete/failed`

**Pipeline (ETL):** `preparing → extracting → transforming → loading → validating → complete/failed`

**Research:** `preparing → exploring → synthesizing → validating → documenting → complete/failed`

## Prompt Template Resolution

Archetypes may provide `.squad/launch-prompt.md` in the workspace. This template is tier 3 in the [prompt resolution chain](/vladi-plugins-marketplace/reference/launch-mechanics#prompt-resolution-chain).

If the archetype does not provide a launch prompt, the generic fallback (tier 4) is used.

## Cleanup Hooks

On `--reset`, `launch.ts` checks for and runs cleanup hooks:

```
.squad/cleanup-hook.sh   ← tried first (run with bash)
.squad/cleanup-hook.ts   ← tried second (run with npx tsx)
```

Only the first found hook runs. The archetype provides these hooks to clear archetype-specific state (deliverables, raw data, caches) while core handles clearing signal state and inbox acknowledgments.

## Setup Skill Auto-Installation

An archetype plugin declares a setup skill that `squad init` executes:

1. Copies archetype-specific skills into `.squad/skills/`
2. Writes `.squad/archetype.json` metadata
3. Optionally provides `.squad/launch-prompt.md`
4. Optionally provides `.squad/cleanup-hook.sh`
5. Seeds any archetype-specific directory structure

## Non-Homogeneous Federations

A single federation can contain teams with **different** archetypes:

```
squad/team-alpha  →  archetype: squad-archetype-inventory
squad/team-beta   →  archetype: squad-archetype-audit
squad/team-gamma  →  archetype: squad-archetype-inventory
```

Core operations (launch, sync, signals, learnings) work identically regardless of archetype. The archetype only affects:
- Which prompt template is used
- Which playbook skill the team follows
- What cleanup hook runs on reset
- What deliverable schema is expected

## Monitor + Triage + Recovery Pattern

Each archetype provides three components via SDK base classes:

**MonitorCollector** — Mechanical data collection:
```typescript
export class BackendMonitor extends MonitorCollector {
  async collect(team: TeamContext): Promise<StatusData> {
    const status = await this.readStatus(team);
    const signals = await this.readInboxSignals(team);
    const learnings = await this.readLearnings(team);
    return { status, signals, learnings, custom: { /* archetype-specific */ } };
  }
}
```

**TriageAnalyzer** — Diagnose issues:
```typescript
export class BackendTriage extends TriageAnalyzer {
  async diagnose(team: TeamContext, data: StatusData): Promise<DiagnosisResult> {
    const issues: Issue[] = [];
    if (this.isStalled(data.status, 30)) {
      issues.push({ severity: 'high', title: `Team stalled`, category: 'state-machine' });
    }
    return { issues, healthy: issues.length === 0 };
  }
}
```

**RecoveryEngine** — Suggest/execute fixes:
```typescript
export class BackendRecovery extends RecoveryEngine {
  async suggestActions(diagnosis: DiagnosisResult): Promise<RecoveryAction[]> {
    // Map issues to recovery actions
  }
}
```

Archetypes declare monitoring components in `archetype.json`:
```json
{
  "monitoring": {
    "collector": "meta/scripts/monitor.ts",
    "triage": "meta/scripts/triage.ts",
    "recovery": "meta/scripts/recovery.ts",
    "skills": ["meta/skills/monitor-dashboard.md"]
  }
}
```

For more on monitoring, see [Monitoring Guide](/vladi-plugins-marketplace/guides/monitoring).

## Related Pages

- [Architecture Overview](/vladi-plugins-marketplace/reference/architecture) — Three-layer design
- [SDK Types](/vladi-plugins-marketplace/reference/sdk-types) — MonitorCollector, TriageAnalyzer, RecoveryEngine interfaces
- [Creating Archetypes](/vladi-plugins-marketplace/archetypes/creating-archetypes) — Step-by-step guide
- [Archetypes Overview](/vladi-plugins-marketplace/archetypes/overview) — Available archetype types
