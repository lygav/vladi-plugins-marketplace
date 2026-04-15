---
title: Creating Custom Archetypes
description: Design and build reusable work patterns for federated teams
---

An **archetype** is a reusable work pattern definition for federated teams. It defines:

- **What** teams produce (file artifacts, code changes, data pipelines, reports)
- **How** work progresses (lifecycle states: planning → implementing → testing → reviewing)
- **When** things go wrong (failure modes and diagnostics)
- **Whether** the meta-squad aggregates results (merging outputs from all teams)

Create a new archetype when the [built-in archetypes](/vladi-plugins-marketplace/archetypes/overview#built-in-archetypes) don't fit your team's work pattern. Examples of custom archetypes:

- **ETL pipeline** — teams that extract, transform, and load data
- **Infrastructure** — teams that deploy and configure resources
- **Security audit** — teams that perform threat modeling and penetration testing
- **API design** — teams that produce OpenAPI specs and contract validation
- **Database migration** — teams that apply schema changes safely

## The Archetype Spectrum

Archetypes exist on a spectrum based on team lifecycle and interaction pattern:

```
Batch ←―――――――――――――― Spectrum ―――――――――――――→ Service

Deliverable        Coding           Consultant
│                  │                │
One-shot scan     Iterative dev    Always-on Q&A
Complete → done   PR → feedback    Index → answer loop
No long-term      State persists   Long-running
interaction       across PRs       knowledge base
```

**Batch archetypes** (deliverable, research, analysis):
- Teams complete a discrete task and reach a terminal state (`complete`, `failed`)
- Future runs are separate invocations (refresh, reset, or new scope)

**Iterative archetypes** (coding, testing, infrastructure):
- Teams work in cycles with external feedback loops
- State persists across iterations (PR feedback, test failures, deployment validation)

**Service archetypes** (consultant, monitoring, validation):
- Teams run continuously in a steady state
- Respond to requests or events rather than completing a fixed scope

Choose your archetype position on this spectrum when designing. It affects:
- **Terminal states** — batch = `complete`/`failed`, service = rarely terminates
- **Refresh semantics** — batch = delta scan, iterative = handle feedback, service = update knowledge
- **Reset behavior** — batch = full re-scan, iterative = clear branches but keep learnings, service = re-index

## Getting Started

### Conversational design (recommended)

The **archetype-creator** skill guides you through conversational archetype design. Start a Copilot session and say:

```
> I want to create a new archetype
```

The skill walks you through ten guiding questions:

1. **Purpose & identity** — What is this archetype for?
2. **Team output** — File artifacts, code changes, data, insights, infrastructure?
3. **Lifecycle phases** — What phases does work go through?
4. **Meta-squad visibility** — Which phases need monitoring?
5. **Terminal states** — How does work end? (complete, failed, cancelled, blocked)
6. **Aggregation needs** — Does meta-squad merge outputs from all teams?
7. **Failure modes** — What can go wrong? How to detect it?
8. **Recovery actions** — Can teams recover automatically or semi-automatically?
9. **Human-in-the-loop** — Do teams pause and wait for human feedback?
10. **External tools & APIs** — GitHub, databases, cloud services, CI/CD platforms?

After answering, the skill provides a design summary, a ready-to-run scaffold command, and next steps for customization.

### Automatic discovery

Your archetype is automatically discovered by the federation setup wizard — no manual registration needed. Install the archetype plugin and it appears in setup options.

The wizard uses dynamic discovery that:
1. Reads `.github/plugin/marketplace.json` to find plugins with `category: "archetype"`
2. Falls back to filesystem scan of `plugins/` directory
3. Presents all discovered archetypes with descriptions and lifecycle states

## Anatomy of an Archetype

### Directory structure

```
plugins/squad-archetype-{name}/
├── plugin.json                    # Plugin manifest (Copilot CLI)
├── archetype.json                 # Archetype manifest (federation core)
├── README.md                      # Documentation
│
├── meta/                          # Meta-squad resources
│   ├── skills/
│   │   ├── {name}-setup/          # Configuration wizard
│   │   ├── {name}-monitoring/     # Interpret monitoring data
│   │   ├── {name}-triage/         # Diagnose problems
│   │   └── {name}-aggregation/    # Merge team outputs (optional)
│   │
│   ├── agents/                    # Optional meta agents
│   │   └── aggregator.agent.md
│   │
│   └── scripts/                   # Data collection scripts
│       ├── {name}-monitor.ts      # Collects monitoring data
│       ├── {name}-triage.ts       # Detects problems
│       └── {name}-aggregate.ts    # Merges outputs (optional)
│
├── team/                          # Team resources
│   ├── skills/
│   │   ├── {name}-playbook/       # Team execution guide
│   │   └── {name}-recovery/       # Recovery actions (optional)
│   │
│   ├── templates/
│   │   ├── launch-prompt-first.md  # First launch prompt
│   │   ├── launch-prompt-refresh.md # Subsequent launches
│   │   └── launch-prompt-reset.md   # Reset after problems
│   │
│   └── archetype.json             # Team-side manifest (copied to team .squad/)
│
└── __tests__/
    └── {name}.contract.test.ts    # Contract validation
```

### Meta vs team resources

**Meta resources** run in the meta-squad's context — skills for setup, monitoring, triage, and aggregation; scripts that collect data from all teams; agents that orchestrate multi-team operations.

**Team resources** run in each team's context — the playbook skill (how to execute work), recovery skill (how to fix problems), launch prompt templates (what to tell teams when starting), and the `archetype.json` manifest (copied to `.squad/` during setup).

For more on the meta/team split, see [Archetypes Overview — meta/ vs team/](/vladi-plugins-marketplace/archetypes/overview#meta-vs-team).

### What each file does

| File | Purpose | Who uses it |
|------|---------|-------------|
| `plugin.json` | Copilot CLI plugin manifest | Copilot CLI (installation, discovery) |
| `archetype.json` (root) | Archetype manifest — paths to meta/team resources, compatibility | Federation core (archetype discovery) |
| `archetype.json` (team/) | Team-side manifest — state machine, schemas | Teams (copied to `.squad/` during setup) |
| `meta/skills/{name}-setup/` | Archetype-specific configuration wizard | Meta-squad (during onboarding) |
| `meta/skills/{name}-monitoring/` | Interprets monitoring data for humans | Meta-squad (answers "how are my teams?") |
| `meta/skills/{name}-triage/` | Diagnoses problems and root causes | Meta-squad (answers "why is X failing?") |
| `meta/skills/{name}-aggregation/` | Orchestrates merging team outputs | Meta-squad (optional, only if archetype aggregates) |
| `meta/scripts/{name}-monitor.ts` | Collects mechanical monitoring data | Runs periodically, outputs JSON |
| `meta/scripts/{name}-triage.ts` | Detects stalled/failed teams | Runs periodically, outputs problem list |
| `meta/scripts/{name}-aggregate.ts` | Merges team outputs into unified result | Runs on-demand, writes to `.squad/aggregation/` |
| `team/skills/{name}-playbook/` | Step-by-step execution workflow | Teams (answers "what do I do next?") |
| `team/skills/{name}-recovery/` | Recovery action catalog | Teams (optional, answers "how do I fix this?") |
| `team/templates/launch-prompt-*.md` | What to tell teams when launching | Core (loads during headless launch) |
| `__tests__/{name}.contract.test.ts` | Validates archetype against SDK | CI/CD (ensures archetype implements required interfaces) |

## archetype.json Manifests

### Root manifest

The root manifest tells core where to find resources:

```json
{
  "name": "squad-archetype-deliverable",
  "version": "0.1.0",
  "description": "Teams that produce file artifacts",
  "coreCompatibility": ">=0.6.0",
  "meta": {
    "skills": "meta/skills/",
    "agents": "meta/agents/",
    "scripts": "meta/scripts/"
  },
  "team": {
    "skills": "team/skills/",
    "templates": "team/templates/"
  }
}
```

### Team manifest

The team manifest is copied to `.squad/archetype-config.json` during setup:

```json
{
  "archetype": "deliverable",
  "version": "0.1.0",
  "states": {
    "lifecycle": ["preparing", "scanning", "distilling", "aggregating"],
    "terminal": ["complete", "failed"],
    "pauseable": []
  },
  "schemas": {
    "deliverable": ".squad/schemas/deliverable.schema.json"
  }
}
```

**Key fields:**

| Field | Description |
|-------|-------------|
| `states.lifecycle` | Ordered phases work progresses through |
| `states.terminal` | How work definitively ends (complete, failed, cancelled, blocked) |
| `states.pauseable` | Which states can pause waiting for human input (e.g., `waiting-for-review`) |
| `schemas` | Archetype-specific validation schemas (optional) |
| `coreCompatibility` | Minimum core version required (semver) |

## Design Guide

### Designing lifecycle states

**Principles:**

1. **Observable** — you can tell when a team is in this state by looking at files, git history, or external APIs
2. **Actionable** — teams know what to do while in this state
3. **Not too granular** — avoid micro-states like "opening file" vs "editing file" vs "saving file"
4. **Meaningful progression** — each state represents a distinct phase of work

**Good examples:**

| Archetype | States |
|-----------|--------|
| Deliverable | `preparing → scanning → distilling → aggregating` |
| Coding | `planning → implementing → testing → reviewing → merging` |
| ETL | `extracting → transforming → validating → loading` |
| Research | `scoping → researching → analyzing → drafting → reviewing` |

**Bad examples:**

- Too granular: `opening-editor → writing-code → saving-file → committing`
- Unobservable: `thinking → deciding → planning` (how do you detect these?)
- Redundant: `coding → writing-code → implementing` (all the same thing)

**How many states?** Minimum 2, typical 3–5, maximum 7–8. If you need more than 8, consider combining states or moving detail to team-internal decisions.

### Meta skills: what the meta-squad needs

**Always include:**

1. **{name}-setup** — Collects archetype-specific settings, writes to `.squad/archetype-config.json`, hands off from core `federation-setup` skill after team basics are configured.

2. **{name}-monitoring** — Reads monitor script output (JSON), explains team health/progress, highlights stalled/failed teams with actionable insights.

3. **{name}-triage** — Reads triage script output, walks through diagnostic decision trees, recommends recovery actions or manual intervention.

**Conditionally include:**

4. **{name}-aggregation** — Orchestrates merging team outputs, validates against schema, handles conflicts. Only needed if the archetype aggregates results from multiple teams.

### Team skills: what teams need

**Always include:**

1. **{name}-playbook** — Step-by-step workflow for each lifecycle phase, completion criteria, tool references, examples, and error handling.

**Conditionally include:**

2. **{name}-recovery** — Recovery procedures for each failure mode, automated recovery scripts, manual recovery instructions, state rollback guidance. Only needed if teams can recover automatically or semi-automatically.

### The hybrid pattern: scripts collect, skills interpret

**Scripts** are mechanical — they collect data from files, git, and APIs; detect problems mechanically (stalled for > N days, empty output, error logs); and output structured JSON.

**Skills** are intelligent — they interpret what the data means in context, explain to humans what's happening, recommend actions, and learn from patterns over time.

This separation keeps scripts simple and testable while skills provide contextual intelligence.

### State machine patterns

**Linear flows** (most common — no explicit transitions needed):

```json
{
  "states": {
    "lifecycle": ["phase1", "phase2", "phase3"],
    "terminal": ["complete", "failed"]
  }
}
```

**Pauseable states** (human-in-the-loop):

```json
{
  "states": {
    "lifecycle": ["planning", "implementing", "waiting-for-review", "merging"],
    "terminal": ["complete", "failed"],
    "pauseable": ["waiting-for-review"]
  }
}
```

Pauseable states aren't flagged as stalled — monitoring knows they're waiting for human input.

**Multiple terminals** (different end conditions):

```json
{
  "states": {
    "lifecycle": ["scoping", "researching", "analyzing"],
    "terminal": ["complete", "failed", "abandoned", "delegated"]
  }
}
```

Use when work can end in fundamentally different ways — `abandoned` (stopped by choice), `delegated` (handed off to another system/team).

**Branching flows** (advanced, rare):

```json
{
  "states": {
    "lifecycle": ["preparing", "scanning", "distilling", "aggregating"],
    "terminal": ["complete", "failed"],
    "transitions": {
      "preparing": ["scanning"],
      "scanning": ["distilling", "failed"],
      "distilling": ["aggregating", "scanning"],
      "aggregating": ["complete", "failed"]
    }
  }
}
```

Only define explicit transitions if your workflow has loops or branches.

## Knowledge Integration

Every archetype must explicitly instruct teams to build knowledge over time through the [five knowledge channels](/vladi-plugins-marketplace/guides/knowledge-lifecycle). This is not implied — weave it into launch prompts, playbook steps, and recovery procedures.

**In launch prompt templates:** Include a dedicated "Knowledge Accumulation" section explaining all five channels (learning log, agent history, team decisions, team wisdom, reusable skills).

**In playbook skills:** After discovery/indexing: "Record what you found in the learning log." After receiving feedback: "Capture as a correction." After completing work: "Update your history." When spotting reusable patterns: "Extract to a skill when validated 3+ times."

**In recovery skills:** After fixing issues: "Record what went wrong as a 'gotcha' learning." After recovery: "Update decisions.md with why the failure occurred and how to prevent it."

Knowledge emphasis varies by archetype position on the spectrum:

| Archetype type | Primary channels | Typical skills |
|----------------|-----------------|----------------|
| Batch (deliverable, research) | Learning log during investigation, wisdom for structural patterns | Data transformation, validation |
| Iterative (coding, testing) | Decisions for technical choices, learning log for codebase patterns | Refactoring techniques, test patterns |
| Service (consultant, monitoring) | Learning log as Q&A knowledge base, wisdom for architectural understanding | Investigation, diagnostic techniques |

## Customization

After scaffolding, customize these files to match your specific work pattern.

### 1. Playbook skill (always customize)

**File:** `team/skills/{name}-playbook/SKILL.md`

Add detailed step-by-step workflows for each phase, completion criteria, tool references, examples, and error handling.

**Example:**

```markdown
## Phase 2: Scanning

**Goal:** Discover all relevant files, dependencies, and APIs in the codebase.

**Steps:**

1. **Identify entry points**
   - Find main files, routes, controllers
   - Use `grep -r "export default" src/` to find modules

2. **Map dependencies**
   - Parse package.json for external deps
   - Trace internal imports with LSP tools

3. **Extract schemas**
   - Find JSON schemas, TypeScript types, API contracts
   - Store in `.squad/scan-results/schemas/`

**Completion criteria:**

- [ ] All entry points documented in `scan-results/entry-points.json`
- [ ] Dependency graph complete
- [ ] At least 3 schemas extracted (or note if none found)

**Transition to next phase:** When all checkboxes are complete, transition to `distilling`.
```

### 2. Monitor script (always customize)

**File:** `meta/scripts/{name}-monitor.ts` — extends `MonitorBase` from SDK.

Implement `collectArchetypeData(teamName)` to collect archetype-specific health data. Output gets merged with base monitoring data (state, timestamps, git info).

```typescript
class MyArchetypeMonitor extends MonitorBase {
  async collectArchetypeData(teamName: string): Promise<any> {
    const outputExists = await fs.exists(
      path.join(this.getTeamPath(teamName), '.squad/output/result.json')
    );
    const metadata = await this.readJSON(
      path.join(this.getTeamPath(teamName), '.squad/state-metadata.json')
    );
    return { hasOutput: outputExists, customMetric: metadata.someValue };
  }
}
```

### 3. Triage script (always customize)

**File:** `meta/scripts/{name}-triage.ts` — extends `TriageBase` from SDK.

Implement `detectProblems(teamName)` to detect archetype-specific problems. Each problem must have `severity`, `category`, `message`, and `suggestedAction`.

```typescript
class MyArchetypeTriage extends TriageBase {
  async detectProblems(teamName: string): Promise<Problem[]> {
    const problems: Problem[] = [];
    const state = await this.getTeamState(teamName);
    if (state.current === 'extracting') {
      const stalledFor = Date.now() - state.lastTransition;
      if (stalledFor > 30 * 60 * 1000) {
        problems.push({
          severity: 'error',
          category: 'api-timeout',
          message: `${teamName} stuck extracting for 30+ minutes`,
          suggestedAction: 'Check API health or increase timeout'
        });
      }
    }
    return problems;
  }
}
```

### 4. Setup skill (customize questions)

**File:** `meta/skills/{name}-setup/SKILL.md`

Add archetype-specific configuration questions (output format, validation rules, external APIs), schema generation, MCP server recommendations, and validation rules.

### 5. Aggregation script (if has-aggregation)

**File:** `meta/scripts/{name}-aggregate.ts`

Implement collect → merge → validate → write logic:

```typescript
async function aggregate(teamNames: string[]): Promise<AggregatedResult> {
  // 1. Collect outputs from all teams
  const results = [];
  for (const team of teamNames) {
    const outputPath = path.join(getTeamPath(team), '.squad/output/deliverable.json');
    if (await fs.exists(outputPath)) {
      results.push(JSON.parse(await fs.readFile(outputPath, 'utf-8')));
    }
  }

  // 2. Merge (archetype-specific logic)
  const merged = mergeDeliverables(results);

  // 3. Validate against schema
  const schema = await loadSchema('.squad/schemas/deliverable.schema.json');
  if (!validate(merged, schema)) {
    throw new Error(`Aggregation failed schema validation`);
  }

  // 4. Write result
  await fs.writeFile(
    '.squad/aggregation/unified-deliverable.json',
    JSON.stringify(merged, null, 2)
  );
  return { success: true, teamCount: results.length };
}
```

## Contract Testing

Every archetype includes contract tests that validate against SDK interfaces.

Run tests with:

```bash
cd plugins/squad-archetype-{name}
npx vitest run __tests__/
```

**What contract tests verify:**

1. **Archetype manifest** — required fields, valid meta/team paths, semver version
2. **Team manifest** — valid state machine, non-empty lifecycle states, terminal states exist, pauseable states subset of lifecycle
3. **Required skills exist** — `{name}-setup`, `{name}-monitoring`, `{name}-triage`, `{name}-playbook`, and conditionally `{name}-aggregation` and `{name}-recovery`
4. **Required scripts** — `{name}-monitor.ts` extends `MonitorBase`, `{name}-triage.ts` extends `TriageBase`, `{name}-aggregate.ts` exists (if has-aggregation)
5. **Launch prompt templates** — `launch-prompt-first.md`, `launch-prompt-refresh.md`, `launch-prompt-reset.md`

All tests must pass before an archetype is considered valid for use.

## Reference Implementations

Study the built-in archetypes to see how the same concepts map differently:

| Aspect | [Deliverable](/vladi-plugins-marketplace/archetypes/deliverable) | [Coding](/vladi-plugins-marketplace/archetypes/coding) | [Consultant](/vladi-plugins-marketplace/archetypes/consultant) |
|--------|-------------|--------|------------|
| **Output** | File artifacts | Code changes (PRs) | Review reports |
| **Spectrum** | Batch | Iterative | Service |
| **Lifecycle** | 4 states (linear) | 5+ states (linear with pause) | 5 states (loop) |
| **Aggregation** | Yes (merge JSON files) | No (PRs are independent) | No |
| **Pauseable** | Yes | Yes (`pr-review`) | Yes (`waiting-for-feedback`) |
| **External APIs** | None | GitHub API | None |

## Best Practices

### Clear state names

Use verb phrases: ✅ `generating-ddl`, `validating-schema`, `applying-prod` — ❌ `gen`, `validate`, `apply`

### Explicit failure paths

Include `failed` in transitions from every state.

### Focused skills

Each skill covers one topic: ✅ `ddl-conventions.md`, `migration-testing.md` — ❌ `everything-about-migrations.md`

### Specific playbooks

Tell the agent exactly what to do in each state — list the steps, tools, files, and transition criteria.

### Realistic state durations

Estimate how long each state takes so users understand progress.

## Testing Your Archetype

1. **Onboard a test team:** "Onboard a db-migration team for test-migration"
2. **Send a sample mission:** "Send directive to test-migration: Add user_email column to users table"
3. **Monitor execution:** "Monitor test-migration team status"
4. **Review outputs** — check deliverable files, verify state transitions, confirm skills were used
5. **Iterate** — refine system prompt, add missing skills, adjust state transitions

## CLI Reference

The `create-archetype.ts` script provides direct scaffolding for advanced users:

```bash
npx tsx scripts/create-archetype.ts \
  --name <name> \
  --states <state1,state2,state3> \
  [--description "One-line description"] \
  [--terminals "complete,failed"] \
  [--has-aggregation] \
  [--has-recovery] \
  [--output /path/to/output] \
  [--dry-run]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--name` | Yes | Archetype name in kebab-case (becomes `squad-archetype-{name}`) |
| `--states` | Yes | Comma-separated lifecycle states (minimum 2, use verbs/gerunds) |
| `--description` | No | Human-readable purpose (default: "Teams that follow the {name} work pattern") |
| `--terminals` | No | Comma-separated terminal states (default: `complete,failed`) |
| `--has-aggregation` | No | Include aggregation skill + script |
| `--has-recovery` | No | Include recovery skill |
| `--output` | No | Output directory (default: `../squad-archetype-{name}`) |
| `--dry-run` | No | Preview generated structure without writing files |

**Example:**

```bash
npx tsx scripts/create-archetype.ts \
  --name etl-pipeline \
  --states "extracting,transforming,validating,loading" \
  --description "Teams that extract, transform, and load data pipelines" \
  --terminals "complete,failed,cancelled" \
  --has-aggregation \
  --has-recovery \
  --dry-run
```

## Next Steps

- [Archetypes Overview](/vladi-plugins-marketplace/archetypes/overview) — understand the archetype layer
- [Coding Archetype](/vladi-plugins-marketplace/archetypes/coding) — iterative work pattern example
- [Deliverable Archetype](/vladi-plugins-marketplace/archetypes/deliverable) — batch work pattern example
- [Consultant Archetype](/vladi-plugins-marketplace/archetypes/consultant) — service work pattern example
- [Knowledge Lifecycle](/vladi-plugins-marketplace/guides/knowledge-lifecycle) — how teams capture and share knowledge
