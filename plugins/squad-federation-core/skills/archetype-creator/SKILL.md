---
name: archetype-creator
description: "Guide archetype design through conversational discovery — derive state machines, skills, and scripts from purpose, outputs, lifecycle phases, and failure modes. Triggers on: create archetype, design archetype, build new archetype, archetype creator, scaffold archetype."
version: 0.1.0
---

# Archetype Creator — Design Guide

You are helping someone design a new archetype for the squad federation system. An archetype is a **reusable work pattern** that defines how teams operate — what they produce, how they progress through work, and how the meta-squad monitors and supports them.

## Triggers

- "create archetype"
- "design archetype"
- "build new archetype"
- "archetype creator"
- "scaffold archetype"
- "new work pattern"

## Overview

This skill uses **conversational discovery** to help users design well-rounded archetypes. You'll ask a series of questions to understand the work pattern, then derive the technical components needed (state machine, skills, scripts).

After completing the discovery, you'll provide the user with:
1. A recommended state machine (lifecycle + terminal states)
2. Meta skills needed (setup, monitoring, triage, optional aggregation)
3. Team skills needed (playbook, optional recovery)
4. Script requirements (monitor, triage extending SDK base classes)
5. Command to run `create-archetype.ts` with the right parameters

---

## Discovery Questions

Walk through these questions in order. Be conversational — explain why you're asking each question and how it influences the archetype design.

### 1. Purpose & Identity

**Ask:**

> "Let's start with the basics. What's the archetype's purpose in one sentence?
>
> Example: 'Teams that produce file artifacts' or 'Teams that write code and open pull requests' or 'Teams that extract, transform, and load data pipelines'"

**Capture:** A concise `description` for the archetype manifest.

**Why it matters:** The purpose defines the archetype's identity and helps determine appropriate states and outputs.

---

### 2. Team Output

**Ask:**

> "What kind of output do teams using this archetype produce?
>
> Options:
> - **File artifacts** (JSON, YAML, reports, schemas)
> - **Code changes** (commits, PRs, branches)
> - **Data** (database records, API responses, transformed datasets)
> - **Analysis/insights** (findings, recommendations, no persistent artifact)
> - **Infrastructure** (deployed resources, configured systems)
> - **Multiple types** (describe the combination)
> - **No persistent output** (ephemeral work like testing, validation)"

**Capture:** Output type — determines whether aggregation is needed.

**Derive:**
- If **file artifacts**: likely needs aggregation skill + script
- If **code changes**: likely no aggregation (PRs are already aggregated by GitHub)
- If **data**: might need aggregation depending on data destination
- If **no output**: definitely no aggregation

---

### 3. Lifecycle Phases

**Ask:**

> "Walk me through a team's typical workflow step-by-step. What phases does the work go through from start to finish?
>
> Example for deliverable archetype: 'preparing → scanning → distilling → aggregating'
>
> Example for coding archetype: 'planning → implementing → testing → reviewing → merging'
>
> Be specific — these become your lifecycle states."

**Capture:** Ordered list of lifecycle states (minimum 2, no maximum).

**Validate:**
- Each state should represent a meaningful phase where work happens
- States should be **verbs or gerunds** (not nouns)
- States should flow in a logical sequence
- Avoid redundant states that could be combined

**Why it matters:** These become the archetype's `states.lifecycle` array. The state machine is the heart of the archetype — it defines how teams progress and how the meta-squad monitors them.

---

### 4. Meta-Squad Visibility

**Ask:**

> "Which phases need meta-squad monitoring? Not every state needs visibility — some are internal team transitions.
>
> For example, in coding archetype, meta-squad cares about 'testing' (shows PR build status) but probably doesn't need to track 'editing files' vs 'committing changes' as separate states.
>
> Review your lifecycle states and mark which ones the meta-squad should actively monitor."

**Capture:** Subset of lifecycle states that appear in monitoring dashboards.

**Derive:** Influences what data the monitor script collects and what insights the monitoring skill interprets.

---

### 5. Terminal States

**Ask:**

> "Every archetype needs terminal states — states where work definitively ends. Standard terminals are 'complete' and 'failed'.
>
> Does your archetype need any additional terminal states?
>
> Examples:
> - **cancelled** — work abandoned by choice (not failure)
> - **blocked** — permanently stuck (different from paused/stalled)
> - **delegated** — handed off to another system/team
>
> Most archetypes stick with 'complete' and 'failed' — only add custom terminals if there's a clear distinction."

**Capture:** Terminal states array.

**Default:** `["complete", "failed"]`

**Why it matters:** Terminal states determine when a team's work is done and when monitoring should stop.

---

### 6. Aggregation Needs

**Ask:**

> "Does the meta-squad need to aggregate/merge results from all teams?
>
> This is about **combining outputs**, not just monitoring. Examples:
>
> - **Yes**: Deliverable archetype merges all teams' JSON files into a unified report
> - **Yes**: ETL archetype combines data from all pipelines into a warehouse
> - **No**: Coding archetype — each team's PRs are independent, no merging needed
> - **No**: Testing archetype — test results are consumed individually
>
> If yes: what does the aggregated output look like? (file type, structure, location)"

**Capture:** Boolean `hasAggregation`.

**If yes, also capture:**
- Aggregation output format (JSON, YAML, etc.)
- Aggregation script logic (how to merge)

**Derive:**
- If yes → create meta aggregation skill + aggregation script
- If no → skip aggregation components

---

### 7. Failure Modes & Triage

**Ask:**

> "What can go wrong during this work? Think about common failure modes or stuck states.
>
> Examples:
> - Deliverable: 'team scanned but produced empty deliverable'
> - Coding: 'PR build failing for 3+ days'
> - ETL: 'pipeline stuck extracting (timeout or API failure)'
> - Testing: 'tests failing consistently (code regression)'
>
> List 2-4 common problems you want the meta-squad to detect and diagnose."

**Capture:** List of failure patterns.

**Derive:** Triage skill content — diagnostic decision trees and problem detection logic.

**Why it matters:** Good triage catches problems early. Identifying failure modes upfront makes the archetype more robust.

---

### 8. Recovery Actions

**Ask:**

> "Can teams recover from failures automatically or semi-automatically?
>
> Examples:
> - **Automated**: ETL pipeline can retry with backoff
> - **Semi-automated**: Coding team can run 'git reset --hard' + re-clone to fix corrupted state
> - **Manual-only**: Deliverable team needs human judgment to fix schema mismatches
>
> If you have recovery actions (automated or scripted guidance), we'll create a recovery skill. Otherwise, skip it."

**Capture:** Boolean `hasRecovery`.

**If yes, also capture:**
- List of recovery action types
- Which are automated vs manual

**Derive:**
- If yes → create team recovery skill
- If no → skip recovery components

---

### 9. Human-in-the-Loop

**Ask:**

> "Do teams need to pause and wait for human feedback at any point?
>
> Examples:
> - Coding archetype: yes — 'waiting-for-review' state pauses until PR approved
> - ETL archetype: maybe — manual validation before loading production data
> - Deliverable archetype: no — teams run autonomously end-to-end
>
> If yes: which state(s) involve waiting?"

**Capture:** Boolean `hasHumanLoop` and which states are pauseable.

**Derive:**
- If yes → mark those states as `pauseable` in state schema
- Affects monitoring (don't flag paused teams as stalled)

---

### 10. External Tools & APIs

**Ask:**

> "Does this archetype integrate with external tools or APIs?
>
> Examples:
> - GitHub API (for PR status, code search)
> - Databases (Postgres, MongoDB)
> - Cloud services (AWS, Azure)
> - Telemetry systems (Aspire, Application Insights)
> - CI/CD platforms (Azure DevOps, CircleCI)
>
> List any that apply. These will go in the archetype's MCP recommendations."

**Capture:** List of external integrations.

**Derive:** Add MCP server recommendations to generated README.

---

## Synthesis: Deriving Components

After completing discovery, synthesize the answers into technical requirements.

### State Machine

**Lifecycle states:** Use the user's phases verbatim (from question 3).

**Terminal states:** Use the user's terminals or default to `["complete", "failed"]` (from question 5).

**Pauseable:** If human-in-the-loop (question 9), mark those states as pauseable:

```json
{
  "states": {
    "lifecycle": ["planning", "implementing", "testing", "reviewing", "merging"],
    "terminal": ["complete", "failed"],
    "pauseable": ["reviewing"]
  }
}
```

**Transitions (optional):** For simple linear flows, omit. For complex flows with branches/loops, define explicit transitions.

---

### Meta Skills

**Always include:**

1. **{name}-setup** — Archetype-specific configuration wizard
   - Collects archetype-specific settings (output format, schema, hooks, etc.)
   - Writes to `.squad/archetype-config.json`
   - Hands off from core `federation-setup` skill

2. **{name}-monitoring** — Interprets monitoring data for human understanding
   - Reads monitor script output (JSON)
   - Explains what each team is doing, health status, progress
   - Highlights stalled/failed teams
   - Provides actionable insights

3. **{name}-triage** — Diagnoses problems and root causes
   - Reads triage script output (detected problems)
   - Walks through diagnostic decision trees
   - Recommends recovery actions or manual intervention
   - Logs triage findings to meta-squad learning log

**Conditionally include:**

4. **{name}-aggregation** (if question 6 = yes)
   - Orchestrates aggregation of team outputs
   - Validates merged result
   - Publishes aggregated artifact
   - Handles schema conflicts

---

### Team Skills

**Always include:**

1. **{name}-playbook** — Team execution guide
   - Step-by-step workflow for lifecycle phases
   - What to produce at each step
   - Completion criteria for each phase
   - References to archetype-specific tools/APIs

**Conditionally include:**

2. **{name}-recovery** (if question 8 = yes)
   - Recovery action catalog
   - Automated recovery procedures
   - Manual recovery instructions
   - State rollback guidance

---

### Scripts

**Always include:**

1. **{name}-monitor.ts** (extends `MonitorBase`)
   - Collects mechanical monitoring data
   - Reads team status files
   - Checks health indicators (from question 7 failure modes)
   - Outputs JSON for monitoring skill to interpret

2. **{name}-triage.ts** (extends `TriageBase`)
   - Detects stalled/failed teams
   - Checks failure patterns (from question 7)
   - Outputs structured problem list
   - Triage skill reads and diagnoses

**Conditionally include:**

3. **{name}-aggregate.ts** (if question 6 = yes)
   - Reads all team outputs
   - Merges/combines them
   - Validates merged result
   - Writes to `.squad/aggregation/`

---

## Final Output

After synthesis, provide the user with:

### 1. Summary

```
📋 Archetype Design Summary

**Name:** {name}
**Description:** {description}

**Lifecycle States:** {lifecycle array}
**Terminal States:** {terminal array}
**Pauseable States:** {pauseable array if any}

**Meta Skills:**
- {name}-setup (configuration wizard)
- {name}-monitoring (interpret monitoring data)
- {name}-triage (diagnose problems)
{- {name}-aggregation (merge team outputs) — only if applicable}

**Team Skills:**
- {name}-playbook (execution workflow)
{- {name}-recovery (automated recovery) — only if applicable}

**Scripts:**
- {name}-monitor.ts (data collection)
- {name}-triage.ts (problem detection)
{- {name}-aggregate.ts (merge outputs) — only if applicable}
```

### 2. Create-Archetype Command

Generate the full command with all required flags:

```bash
cd plugins/squad-federation-core
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/create-archetype.ts \
  --name "{name}" \
  --states "{lifecycle.join(',')}" \
  --description "{description}" \
  {--has-aggregation if applicable} \
  {--has-recovery if applicable} \
  --dry-run
```

**Explain:**

> "This command will scaffold the archetype plugin structure. Run with `--dry-run` first to preview what it creates. Remove `--dry-run` to actually generate the files."

### 3. Next Steps

> "After scaffolding:
>
> 1. **Review generated files** — especially skill templates and script skeletons
> 2. **Customize monitor script** — add archetype-specific health checks
> 3. **Flesh out playbook skill** — add detailed workflow steps
> 4. **Write setup skill questions** — tailor configuration wizard
> 5. **Test contract validation** — run `npm test {name}.contract.test.ts`
> 6. **Document in README** — explain the archetype's purpose and design
>
> The scaffolding gives you a working foundation — customize it to match your specific work pattern."

---

## Edge Cases & Validation

### Too few lifecycle states

If user provides < 2 states:

> "An archetype needs at least 2 lifecycle states to represent meaningful progression. Can you break the work into more granular phases?
>
> Example: Instead of just 'working', split into 'planning → executing → validating'."

### Overlapping states

If states seem redundant:

> "I notice '{state1}' and '{state2}' sound similar. Can you clarify the distinction, or should we combine them into one state?"

### Missing terminal state

If user forgets to define terminals:

> "Every archetype needs at least one way to end. I'll default to 'complete' and 'failed' — does that work for your use case?"

### Aggregation without file output

If user wants aggregation but output type isn't file artifacts:

> "You mentioned aggregation, but the output type isn't file-based. How should the meta-squad combine results? (API calls, database writes, etc.)"

---

## Examples

### Example 1: ETL Pipeline Archetype

**User answers:**
1. Purpose: "Teams that extract, transform, and load data pipelines"
2. Output: Data (database records, transformed datasets)
3. Lifecycle: extracting → transforming → validating → loading
4. Meta visibility: All phases (want full pipeline monitoring)
5. Terminals: complete, failed
6. Aggregation: Yes — merge all pipeline metrics into consolidated report
7. Failures: stuck extracting (API timeout), transform errors (bad schema), load failures (DB constraint violation)
8. Recovery: Yes — retry with backoff, skip bad records, rollback transaction
9. Human loop: No
10. External: Database APIs, data source APIs

**Derived components:**

- **Lifecycle:** `["extracting", "transforming", "validating", "loading"]`
- **Terminals:** `["complete", "failed"]`
- **Meta skills:** setup, monitoring, triage, aggregation
- **Team skills:** playbook, recovery
- **Scripts:** monitor, triage, aggregate

**Command:**

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/create-archetype.ts \
  --name "etl-pipeline" \
  --states "extracting,transforming,validating,loading" \
  --description "Teams that extract, transform, and load data pipelines" \
  --has-aggregation \
  --has-recovery
```

---

### Example 2: Research Archetype

**User answers:**
1. Purpose: "Teams that conduct research and produce findings reports"
2. Output: File artifacts (markdown reports)
3. Lifecycle: scoping → researching → analyzing → drafting → reviewing
4. Meta visibility: researching, reviewing (others are internal)
5. Terminals: complete, failed, abandoned
6. Aggregation: Yes — merge all research reports into unified knowledge base
7. Failures: scope creep (researching too long), no findings (empty report), review stalled (waiting > 7 days)
8. Recovery: No — requires human judgment
9. Human loop: Yes — reviewing state pauses for human approval
10. External: Web search, academic databases, internal wikis

**Derived components:**

- **Lifecycle:** `["scoping", "researching", "analyzing", "drafting", "reviewing"]`
- **Terminals:** `["complete", "failed", "abandoned"]`
- **Pauseable:** `["reviewing"]`
- **Meta skills:** setup, monitoring, triage, aggregation
- **Team skills:** playbook (no recovery)
- **Scripts:** monitor, triage, aggregate

**Command:**

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/create-archetype.ts \
  --name "research" \
  --states "scoping,researching,analyzing,drafting,reviewing" \
  --description "Teams that conduct research and produce findings reports" \
  --has-aggregation \
  --terminals "complete,failed,abandoned"
```

---

## Summary

This skill guides users through **designing archetypes** by understanding:

- **What** the work produces (outputs)
- **How** the work progresses (lifecycle phases)
- **When** things go wrong (failure modes)
- **Whether** the meta-squad needs to combine results (aggregation)

From those answers, you **derive**:

- State machine configuration
- Required skills (meta + team)
- Required scripts (monitor, triage, aggregation)

Then provide a **ready-to-run command** to scaffold the archetype.

The goal is to make archetype creation **easy and guided**, so developers don't need to understand federation internals — they just describe their work pattern, and the system generates the right structure.
