# Creating Archetypes

A comprehensive guide for building custom work patterns for federated teams.

## Table of Contents

- [Introduction](#introduction)
- [Quick Start](#quick-start)
- [Anatomy of an Archetype](#anatomy-of-an-archetype)
- [Design Guide](#design-guide)
- [Customization](#customization)
- [Testing](#testing)
- [Reference Implementations](#reference-implementations)
- [CLI Reference](#cli-reference)

---

## Introduction

### What is an archetype?

An **archetype** is a reusable work pattern definition for federated teams. It defines:

- **What** teams produce (file artifacts, code changes, data pipelines, research reports)
- **How** work progresses (lifecycle states: planning → implementing → testing → reviewing)
- **When** things go wrong (failure modes and diagnostics)
- **Whether** the meta-squad aggregates results (merging outputs from all teams)

Archetypes sit in the middle layer of the three-layer composition model:

```
┌────────────────────────────────────────────────────┐
│  PROJECT LAYER                                     │
│  Domain playbook · schemas · import hooks          │  ← Your expertise
├────────────────────────────────────────────────────┤
│  ARCHETYPE LAYER                                   │
│  Team playbook · state machine · aggregation       │  ← Work pattern
│  Examples: deliverable, coding, research, ETL      │
├────────────────────────────────────────────────────┤
│  CORE LAYER                                        │
│  Worktrees · signals · knowledge · launch          │  ← Infrastructure
└────────────────────────────────────────────────────┘
```

**Core** provides infrastructure (archetype-unaware). **Archetypes** define work patterns. **Your project** brings domain expertise.

### Why create an archetype?

Create a new archetype when existing archetypes don't fit your teams' work pattern:

- **Deliverable archetype** — teams that produce file artifacts (JSON, YAML, reports)
- **Coding archetype** — teams that write code and open pull requests
- **Research archetype** — teams that conduct research and produce findings
- **ETL archetype** — teams that extract, transform, and load data pipelines
- **Testing archetype** — teams that validate systems and report results
- **Infrastructure archetype** — teams that deploy and configure resources

If your work pattern is fundamentally different from these, create your own archetype.

### The three-layer model explained

Each layer installs separately and owns its config:

| Layer | Installs as | Owns | Example |
|-------|-------------|------|---------|
| **Core** | Plugin: `squad-federation-core` | `federate.config.json` | Branch prefix, MCP stack, telemetry, worktree location |
| **Archetype** | Plugin: `squad-archetype-{name}` | `.squad/archetype-config.json` (per team) | State machine, playbook, aggregation logic |
| **Project** | Your `.squad/` dir | Domain playbook skills, schemas, import hooks | Domain-specific workflows, validation rules |

**Key principle:** Core doesn't know what teams produce. Archetypes define the work pattern. Projects bring domain expertise.

### The archetype spectrum

Archetypes exist on a spectrum based on team lifecycle and interaction pattern:

```
Batch ←―――――――――――――― Spectrum ―――――――――――――→ Service

Deliverable        Coding           Consultant
│                  │                │
│                  │                │
One-shot scan     Iterative dev    Always-on Q&A
Complete → done   PR → feedback    Index → answer loop
No long-term      State persists   Long-running
interaction       across PRs       knowledge base
```

**Batch archetypes** (deliverable, research, analysis):
- Teams complete a discrete task and reach a terminal state (`complete`, `failed`)
- Work is comprehensive and delivered all at once
- Future runs are separate invocations (refresh, reset, or new scope)

**Iterative archetypes** (coding, testing, infrastructure):
- Teams work in cycles with external feedback loops
- State persists across iterations (PR feedback, test failures, deployment validation)
- Work accumulates over time through multiple contributions

**Service archetypes** (consultant, monitoring, validation):
- Teams run continuously in a steady state
- Respond to requests or events rather than completing a fixed scope
- Knowledge base grows indefinitely as questions are answered or events are processed

Choose your archetype position on this spectrum when designing. It affects:
- Terminal states (batch = complete/failed, service = rarely terminates)
- Refresh semantics (batch = delta scan, iterative = handle feedback, service = update knowledge)
- Reset behavior (batch = full re-scan, iterative = clear branches but keep learnings, service = re-index)

### Knowledge Architecture

**CRITICAL:** Every archetype MUST explicitly instruct teams to build knowledge over time. This is not implied — it must be woven into launch prompts, playbook steps, and recovery procedures.

#### The Five Knowledge Channels

All teams — regardless of archetype — use these five channels:

1. **Learning Log** (`.squad/learnings/log.jsonl`)
   - Append-only JSONL of discoveries, corrections, patterns, techniques, gotchas
   - Schema: `{id, ts, type, agent, domain, tags, title, body, confidence, source?, supersedes?, graduated_to_skill?}`
   - Types: `discovery`, `correction`, `pattern`, `technique`, `gotcha`
   - Domain: `local` (specific to this project) or `generalizable` (applies broadly)
   - Confidence: `low`, `medium`, `high`

2. **Agent History** (`.squad/agents/*/history.md`)
   - Personal markdown journal per agent
   - Updated after each work session
   - What was learned, what approaches worked, what to remember

3. **Team Decisions** (`.squad/decisions.md`)
   - Markdown log of significant choices with rationale
   - "Why we chose X over Y", "What tradeoffs we accepted"
   - Helps future teams understand intent behind structure

4. **Team Wisdom** (`.squad/identity/wisdom.md`)
   - Distilled principles that emerge from repeated patterns
   - Higher-level than individual learnings
   - "This domain always has X structure", "Approach Y works best for Z"

5. **Reusable Skills** (`.squad/skills/`)
   - Extracted patterns that proved useful 3+ times
   - Domain-specific validation logic, transformation patterns, investigation techniques
   - Codified as markdown skills for reuse

#### Integration Requirements for Archetypes

When creating an archetype, you MUST:

**In launch prompt templates:**
- Include a dedicated "Knowledge Accumulation" section explaining all five channels
- Describe when and how to use each channel
- Make it explicit that "the team gets smarter over time"

**In playbook skills:**
- Weave knowledge instructions into each workflow phase — not as an afterthought section
- After discovery/indexing: "Record what you found in the learning log"
- After receiving feedback: "Capture the feedback as a correction"
- After completing work: "Update your history with what you learned"
- When spotting reusable patterns: "Extract to a skill when validated 3+ times"

**In recovery skills (if archetype has them):**
- After fixing issues: "Record what went wrong and the fix as a 'gotcha' learning"
- After recovery: "Update decisions.md with why the failure occurred and how to prevent it"

**In setup/scaffolding:**
- Mention that this team will build knowledge over time in the five channels
- Emphasize that the longer it runs, the better it gets

#### Archetype-Specific Adaptations

While all five channels apply to all archetypes, emphasis varies:

**Batch archetypes (deliverable, research):**
- Heavy use of learning log during investigation phases
- Wisdom captures structural patterns about the domain
- Skills often focus on data transformation and validation

**Iterative archetypes (coding, testing):**
- Decisions.md critical for tracking technical choices
- Learning log captures codebase patterns and review feedback
- Skills extract refactoring techniques and test patterns

**Service archetypes (consultant, monitoring):**
- Learning log becomes Q&A knowledge base
- Wisdom distills architectural understanding
- Skills codify investigation and diagnostic techniques

---

## Quick Start

### Guided creation (recommended)

The fastest path is the conversational skill. It asks 10 guiding questions about your work pattern, then generates the scaffold command.

Start a Copilot session and say:

```
> I want to create a new archetype
```

The skill will walk you through:

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

After answering, the skill provides:

- **Design summary** — states, skills, scripts
- **Ready-to-run command** — scaffold the archetype structure
- **Next steps** — what to customize after scaffolding

### Direct scaffolding

Or run the script directly if you already know your design:

```bash
cd plugins/squad-federation-core

# Preview what will be created
npx tsx scripts/create-archetype.ts \
  --name my-archetype \
  --states "phase1,phase2,phase3" \
  --description "Teams that do X" \
  --dry-run

# Actually create it
npx tsx scripts/create-archetype.ts \
  --name my-archetype \
  --states "phase1,phase2,phase3" \
  --description "Teams that do X"
```

**With aggregation and recovery:**

```bash
npx tsx scripts/create-archetype.ts \
  --name etl-pipeline \
  --states "extracting,transforming,loading" \
  --description "Teams that extract, transform, and load data pipelines" \
  --has-aggregation \
  --has-recovery
```

**Custom terminal states:**

```bash
npx tsx scripts/create-archetype.ts \
  --name research \
  --states "scoping,researching,analyzing,drafting" \
  --terminals "complete,failed,abandoned" \
  --has-aggregation
```

**Output directory:**

By default, archetypes are created in `../../plugins/squad-archetype-{name}/`. Use `--output` to change the location.

### Automatic discovery

**Your archetype is automatically discovered by the federation setup wizard.** No manual registration needed — just install the plugin and it appears in the setup options.

The setup wizard uses dynamic archetype discovery that:
1. Reads `.github/plugin/marketplace.json` to find plugins with `category: "archetype"`
2. Falls back to filesystem scan of `plugins/` directory if marketplace.json is missing
3. Presents all discovered archetypes with their descriptions and lifecycle states

This means:
- ✅ New archetypes appear immediately in setup wizard after installation
- ✅ No config files to update or manifests to edit
- ✅ Third-party archetypes from other marketplaces work automatically
- ✅ Custom archetypes in development show up for testing

---

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

### Meta vs Team explained

**Meta resources** run in the meta-squad's context:

- Skills for the meta-squad (setup wizard, monitoring, triage, aggregation)
- Scripts that collect data from all teams
- Agents that orchestrate multi-team operations

**Team resources** run in each team's context:

- Playbook skill (how to execute work)
- Recovery skill (how to fix problems)
- Launch prompt templates (what to tell teams when starting)
- `archetype.json` manifest (copied to `.squad/` during setup)

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

### archetype.json manifest explained

**Root manifest** (tells core where to find resources):

```json
{
  "name": "squad-archetype-deliverable",
  "version": "0.1.0",
  "description": "Teams that produce file artifacts",
  "coreCompatibility": ">=0.5.0",
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

**Team manifest** (copied to `.squad/archetype-config.json` during setup):

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

- `states.lifecycle` — ordered phases work progresses through
- `states.terminal` — how work definitively ends (complete, failed, cancelled, blocked)
- `states.pauseable` — which states can pause waiting for human input (e.g., "waiting-for-review")
- `schemas` — archetype-specific validation schemas (optional)
- `coreCompatibility` — minimum core version required (semver)

---

## Design Guide

### How to design good lifecycle states

**Principles:**

1. **Observable** — you can tell when a team is in this state by looking at files, git history, or external APIs
2. **Actionable** — teams know what to do while in this state
3. **Not too granular** — avoid micro-states like "opening file" vs "editing file" vs "saving file"
4. **Meaningful progression** — each state represents a distinct phase of work

**Good examples:**

- Deliverable: `preparing → scanning → distilling → aggregating`
- Coding: `planning → implementing → testing → reviewing → merging`
- ETL: `extracting → transforming → validating → loading`
- Research: `scoping → researching → analyzing → drafting → reviewing`

**Bad examples:**

- Too granular: `opening-editor → writing-code → saving-file → committing`
- Unobservable: `thinking → deciding → planning` (how do you detect these?)
- Redundant: `coding → writing-code → implementing` (all the same thing)

**How many states?**

- **Minimum:** 2 (work is linear)
- **Typical:** 3-5 (most archetypes)
- **Maximum:** 7-8 (complex workflows with branching)

If you need more than 8 states, consider whether some can be combined or moved to team-internal decisions.

### Meta skills: what the meta-squad needs

**Always include:**

1. **{name}-setup** — Archetype-specific configuration wizard
   - Collects archetype-specific settings (schemas, output format, hooks)
   - Writes to `.squad/archetype-config.json` in team worktree
   - Hands off from core `federation-setup` skill after team basics are configured

2. **{name}-monitoring** — Interprets monitoring data for human understanding
   - Reads monitor script output (JSON)
   - Explains what each team is doing, health status, progress
   - Highlights stalled/failed teams with actionable insights
   - Answers questions like "how are my teams doing?"

3. **{name}-triage** — Diagnoses problems and root causes
   - Reads triage script output (detected problems)
   - Walks through diagnostic decision trees
   - Recommends recovery actions or manual intervention
   - Logs triage findings to meta-squad learning log

**Conditionally include:**

4. **{name}-aggregation** — Orchestrates merging team outputs (only if archetype aggregates)
   - Coordinates aggregation of team deliverables
   - Validates merged result against schema
   - Publishes aggregated artifact
   - Handles schema conflicts or missing data

### Team skills: what teams need

**Always include:**

1. **{name}-playbook** — Team execution guide
   - Step-by-step workflow for each lifecycle phase
   - What to produce at each step
   - Completion criteria for each phase
   - References to archetype-specific tools/APIs
   - Examples and templates

**Conditionally include:**

2. **{name}-recovery** — Recovery action catalog (only if archetype has automated/semi-automated recovery)
   - Recovery procedures for each failure mode
   - Automated recovery scripts (retry with backoff, rollback transaction)
   - Manual recovery instructions (when automation isn't possible)
   - State rollback guidance (reset to last known good state)

### The hybrid pattern: scripts collect, skills interpret

**Design principle:** Scripts are mechanical, skills are intelligent.

**Scripts do:**
- Collect data from files, git, APIs
- Detect problems mechanically (stalled for > N days, empty output, error logs)
- Output structured JSON for skills to consume

**Skills do:**
- Interpret what the data means in context
- Explain to humans what's happening
- Recommend actions based on context
- Learn from patterns and improve over time

**Example:**

```typescript
// Script: meta/scripts/deliverable-monitor.ts (extends MonitorBase)
class DeliverableMonitor extends MonitorBase {
  async collectTeamData(teamName: string): Promise<TeamMonitorData> {
    // Mechanical data collection
    const deliverableExists = await fs.exists(`.squad/output/deliverable.json`);
    const state = await this.readStateFile(teamName);
    const lastActivity = await this.getLastCommitTimestamp(teamName);
    
    return {
      teamName,
      state: state.current,
      hasOutput: deliverableExists,
      stalledFor: Date.now() - lastActivity,
      health: deliverableExists ? 'healthy' : 'warning'
    };
  }
}
```

```markdown
<!-- Skill: meta/skills/deliverable-monitoring/SKILL.md -->

You interpret monitoring data from the deliverable archetype.

**When activated:** User asks "how are my teams?", "what's the status?", "any problems?"

**What you do:**

1. Run `deliverable-monitor.ts` to get structured data
2. Explain in human terms:
   - "Frontend team just finished distilling — deliverable looks good"
   - "Backend team is stalled in scanning phase for 3 days — might need triage"
   - "API team completed successfully — deliverable schema validated"
3. Highlight actionable issues (not just data dumps)
```

This separation keeps scripts simple and skills intelligent.

### State machine design tips

**Linear flows** (most common):

```json
{
  "states": {
    "lifecycle": ["phase1", "phase2", "phase3"],
    "terminal": ["complete", "failed"]
  }
}
```

No explicit transitions needed — teams progress sequentially.

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

Pauseable states don't get flagged as stalled — monitoring knows they're waiting.

**Multiple terminals** (different end conditions):

```json
{
  "states": {
    "lifecycle": ["scoping", "researching", "analyzing"],
    "terminal": ["complete", "failed", "abandoned", "delegated"]
  }
}
```

Use when work can end in fundamentally different ways:
- `complete` — work finished successfully
- `failed` — work failed and cannot continue
- `abandoned` — work stopped by choice (not failure)
- `delegated` — handed off to another system/team

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

Only define explicit transitions if your workflow has loops or branches. Most archetypes don't need this.

---

## Customization

After scaffolding, customize these files to match your specific work pattern.

### 1. Playbook skill (always customize)

**File:** `team/skills/{name}-playbook/SKILL.md`

**What to customize:**

- **Lifecycle workflows** — detailed step-by-step for each phase
- **Completion criteria** — how teams know when to transition
- **Tools and APIs** — which MCP servers to use, how to call them
- **Examples and templates** — show teams what good output looks like
- **Error handling** — what to do when things go wrong

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

**File:** `meta/scripts/{name}-monitor.ts`

**Extends:** `MonitorBase` from SDK

**What to customize:**

```typescript
class MyArchetypeMonitor extends MonitorBase {
  // Customize: Collect archetype-specific data
  async collectArchetypeData(teamName: string): Promise<any> {
    // Example: Check if output file exists
    const outputExists = await fs.exists(
      path.join(this.getTeamPath(teamName), '.squad/output/result.json')
    );
    
    // Example: Read custom state metadata
    const metadata = await this.readJSON(
      path.join(this.getTeamPath(teamName), '.squad/state-metadata.json')
    );
    
    // Example: Check external API status
    const apiHealth = await this.checkExternalAPI(metadata.apiEndpoint);
    
    return {
      hasOutput: outputExists,
      apiHealth,
      customMetric: metadata.someValue
    };
  }
}
```

**Contract requirements:**

- Must extend `MonitorBase`
- Must implement `collectArchetypeData(teamName: string): Promise<any>`
- Output gets merged with base monitoring data (state, timestamps, git info)

### 3. Triage script (always customize)

**File:** `meta/scripts/{name}-triage.ts`

**Extends:** `TriageBase` from SDK

**What to customize:**

```typescript
class MyArchetypeTriage extends TriageBase {
  // Customize: Detect archetype-specific problems
  async detectProblems(teamName: string): Promise<Problem[]> {
    const problems: Problem[] = [];
    
    // Example: Detect empty output
    const outputPath = path.join(this.getTeamPath(teamName), '.squad/output/result.json');
    if (await fs.exists(outputPath)) {
      const output = await this.readJSON(outputPath);
      if (Object.keys(output).length === 0) {
        problems.push({
          severity: 'warning',
          category: 'empty-output',
          message: `${teamName} produced an empty result`,
          suggestedAction: 'Check scan criteria — might be too restrictive'
        });
      }
    }
    
    // Example: Detect stalled API calls
    const state = await this.getTeamState(teamName);
    if (state.current === 'extracting') {
      const stalledFor = Date.now() - state.lastTransition;
      if (stalledFor > 30 * 60 * 1000) { // 30 minutes
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

**Contract requirements:**

- Must extend `TriageBase`
- Must implement `detectProblems(teamName: string): Promise<Problem[]>`
- Each problem must have: severity, category, message, suggestedAction

### 4. Setup skill (customize questions)

**File:** `meta/skills/{name}-setup/SKILL.md`

**What to customize:**

- **Configuration questions** — what settings does this archetype need?
- **Schema generation** — build archetype-specific validation schemas
- **MCP recommendations** — suggest external tools based on team purpose
- **Validation rules** — check that configuration makes sense

**Example:**

```markdown
## Configuration Questions

Ask these questions to configure the archetype:

### 1. Output Format

> "What format should teams use for deliverables? JSON, YAML, Markdown, or custom?"

**Capture:** `outputFormat` (default: "json")

**Derive:** Generate schema template based on format

### 2. Validation Rules

> "Should deliverables be validated against a schema? If yes, provide the schema path or I'll generate a starter."

**Capture:** `schemaPath` (optional)

**Derive:** 
- If provided, copy to `.squad/schemas/`
- If not provided, generate basic schema from output format

### 3. External APIs

> "Does this team call external APIs? List them (comma-separated) or say none."

**Capture:** `externalAPIs` (array)

**Derive:** Recommend MCP servers for each API type
```

### 5. Aggregation script (if has-aggregation)

**File:** `meta/scripts/{name}-aggregate.ts`

**What to customize:**

```typescript
async function aggregate(teamNames: string[]): Promise<AggregatedResult> {
  const results = [];
  
  // 1. Collect outputs from all teams
  for (const team of teamNames) {
    const outputPath = path.join(getTeamPath(team), '.squad/output/deliverable.json');
    if (await fs.exists(outputPath)) {
      const data = await fs.readFile(outputPath, 'utf-8');
      results.push(JSON.parse(data));
    }
  }
  
  // 2. Merge (archetype-specific logic)
  const merged = mergeDeliverables(results);
  
  // 3. Validate against schema
  const schema = await loadSchema('.squad/schemas/deliverable.schema.json');
  const valid = validate(merged, schema);
  
  if (!valid) {
    throw new Error(`Aggregation failed schema validation: ${validate.errors}`);
  }
  
  // 4. Write result
  await fs.writeFile(
    '.squad/aggregation/unified-deliverable.json',
    JSON.stringify(merged, null, 2)
  );
  
  return { success: true, teamCount: results.length, outputPath: '.squad/aggregation/unified-deliverable.json' };
}

// Archetype-specific merge logic
function mergeDeliverables(deliverables: any[]): any {
  // Example: Deep merge all JSON objects
  return deliverables.reduce((acc, curr) => {
    return deepMerge(acc, curr);
  }, {});
}
```

---

## Testing

Every archetype includes contract tests that validate against SDK interfaces.

### Running tests

```bash
cd plugins/squad-archetype-{name}
npx vitest run __tests__/
```

### What contract tests verify

The scaffold generates a contract test that validates:

1. **Archetype manifest** (`archetype.json`)
   - Required fields present (name, version, description, coreCompatibility)
   - Meta and team paths are valid
   - Version follows semver

2. **Team manifest** (`team/archetype.json`)
   - State machine is valid
   - Lifecycle states are non-empty
   - Terminal states exist
   - Pauseable states (if any) are subset of lifecycle

3. **Required skills exist**
   - `{name}-setup` (meta)
   - `{name}-monitoring` (meta)
   - `{name}-triage` (meta)
   - `{name}-playbook` (team)
   - `{name}-aggregation` (meta, if has-aggregation)
   - `{name}-recovery` (team, if has-recovery)

4. **Required scripts exist and extend SDK base classes**
   - `{name}-monitor.ts` extends `MonitorBase`
   - `{name}-triage.ts` extends `TriageBase`
   - `{name}-aggregate.ts` exists (if has-aggregation)

5. **Launch prompt templates exist**
   - `launch-prompt-first.md`
   - `launch-prompt-refresh.md`
   - `launch-prompt-reset.md`

**Pass criteria:** All tests must pass before archetype is considered valid for use.

---

## Reference Implementations

Study these archetypes to see how the same concepts map differently:

### Deliverable Archetype

**Location:** `plugins/squad-archetype-deliverable/`

**Purpose:** Teams that produce file artifacts (JSON, YAML, reports, schemas)

**States:** `preparing → scanning → distilling → aggregating`

**Key features:**

- Aggregation skill + script (merges all teams' JSON deliverables)
- Schema validation (JSON Schema for deliverables)
- Dedicated aggregator agent (optional meta agent)
- No recovery skill (failures need human judgment)

**Best for:**

- Documentation generation teams
- Schema extraction teams
- Report generation teams
- API surface scanning teams

**Study this for:**

- How to implement aggregation
- How to validate JSON against schemas
- How to design artifact-producing workflows

### Coding Archetype

**Location:** `plugins/squad-archetype-coding/`

**Purpose:** Teams that write code and open pull requests

**States:** `planning → implementing → testing → waiting-for-review → merging`

**Key features:**

- Pauseable state (`waiting-for-review`) — teams pause until PR approved
- No aggregation (each PR is independent)
- PR review coordination skill (meta)
- Task assignment skill (meta)
- GitHub integration (PR status, code search)

**Best for:**

- Feature development teams
- Bug fix teams
- Refactoring teams
- Library implementation teams

**Study this for:**

- How to handle human-in-the-loop workflows
- How to integrate with GitHub API
- How to design pauseable state machines
- How to coordinate code review

### Comparison table

| Aspect | Deliverable | Coding |
|--------|-------------|--------|
| **Output** | File artifacts | Code changes (PRs) |
| **Lifecycle** | 4 states (linear) | 5 states (linear with pause) |
| **Aggregation** | Yes (merge JSON files) | No (PRs are independent) |
| **Recovery** | No (manual only) | No (manual only) |
| **Pauseable** | No | Yes (`waiting-for-review`) |
| **External APIs** | None | GitHub API |
| **Meta agents** | Aggregator (optional) | None |
| **Complexity** | Medium | Medium-High |

---

## CLI Reference

### create-archetype.ts

Full command-line interface for scaffolding archetypes.

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

### Required Flags

**`--name <name>`**

Archetype name in kebab-case (e.g., `etl-pipeline`, `research`, `testing`).

- Must be unique (not conflict with existing archetypes)
- Will be used as plugin name: `squad-archetype-{name}`
- Will be used in skill names: `{name}-setup`, `{name}-playbook`

**`--states <state1,state2,state3>`**

Comma-separated list of lifecycle states (minimum 2).

- Use verbs or gerunds: `extracting,transforming,loading`
- Represent meaningful phases: `planning,implementing,testing`
- Ordered sequence: teams progress from first to last
- No spaces in state names (use hyphens: `waiting-for-review`)

### Optional Flags

**`--description "One-line description"`**

Human-readable description of the archetype's purpose.

- Defaults to: `"Teams that follow the {name} work pattern"`
- Examples:
  - `"Teams that produce file artifacts"`
  - `"Teams that extract, transform, and load data pipelines"`
  - `"Teams that conduct research and produce findings reports"`

**`--terminals "complete,failed"`**

Comma-separated list of terminal states.

- Defaults to: `"complete,failed"`
- Common additions:
  - `"complete,failed,abandoned"` — work stopped by choice
  - `"complete,failed,blocked"` — permanently stuck
  - `"complete,failed,delegated"` — handed off to another system

**`--has-aggregation`**

Include aggregation components:

- Meta skill: `{name}-aggregation`
- Meta script: `{name}-aggregate.ts`

Use when: Meta-squad needs to merge outputs from all teams.

**`--has-recovery`**

Include recovery components:

- Team skill: `{name}-recovery`

Use when: Teams can recover from failures automatically or semi-automatically.

**`--output /path/to/output`**

Output directory for the generated archetype.

- Defaults to: `../squad-archetype-{name}` (sibling to core plugin)
- Use absolute or relative path

**`--dry-run`**

Preview what will be created without writing files.

- Shows directory structure
- Shows file list
- Shows content of key files
- Validates arguments

### Examples

**Minimal archetype:**

```bash
npx tsx scripts/create-archetype.ts \
  --name simple-workflow \
  --states "start,middle,end"
```

**With aggregation:**

```bash
npx tsx scripts/create-archetype.ts \
  --name etl-pipeline \
  --states "extracting,transforming,loading" \
  --description "Teams that extract, transform, and load data pipelines" \
  --has-aggregation
```

**With recovery:**

```bash
npx tsx scripts/create-archetype.ts \
  --name resilient-process \
  --states "preparing,executing,validating" \
  --has-recovery
```

**With custom terminals:**

```bash
npx tsx scripts/create-archetype.ts \
  --name research \
  --states "scoping,researching,analyzing,drafting" \
  --terminals "complete,failed,abandoned" \
  --has-aggregation
```

**Full example (ETL):**

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

**Preview first, then create:**

```bash
# 1. Preview
npx tsx scripts/create-archetype.ts \
  --name my-archetype \
  --states "phase1,phase2,phase3" \
  --dry-run

# 2. If looks good, remove --dry-run
npx tsx scripts/create-archetype.ts \
  --name my-archetype \
  --states "phase1,phase2,phase3"
```

---

## Next Steps

After scaffolding your archetype:

1. **Review generated files** — especially skill templates and script skeletons
2. **Customize monitor script** — add archetype-specific health checks
3. **Flesh out playbook skill** — add detailed workflow steps and examples
4. **Write setup skill questions** — tailor configuration wizard to your needs
5. **Implement aggregation logic** (if applicable) — define how to merge team outputs
6. **Run contract tests** — ensure archetype implements required interfaces
7. **Document in README** — explain the archetype's purpose, design, and usage
8. **Install and test** — use `copilot plugin install` to try it in a test project

**Resources:**

- [Squad Federation Core README](README.md) — understand the core layer
- [Example: Deliverable Archetype](../squad-archetype-deliverable/) — artifact-producing teams
- [Example: Coding Archetype](../squad-archetype-coding/) — code-producing teams
- [Architecture Deep Dive](ARCHITECTURE.md) — schemas, protocols, and flows

The scaffolding gives you a working foundation — customize it to match your specific work pattern and team needs.
