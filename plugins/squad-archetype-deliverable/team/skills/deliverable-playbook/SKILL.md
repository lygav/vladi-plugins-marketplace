---
name: deliverable-playbook
description: This skill activates when a team needs to produce a file deliverable using the scatter-gather pattern — discovery, analysis, validation, and distillation into a structured output file.
version: 0.1.0
---

# Deliverable Playbook

> How deliverable squads work — produce fragments, merge into a deliverable artifact, meta-squad aggregates.

## Triggers

- "deliverable"
- "artifact"
- "scatter-gather"
- "aggregate"
- "produce file"

## Overview

The **deliverable archetype** implements a scatter-gather pattern for squads that
produce file artifacts. Each domain expert squad works independently in its own
worktree branch, producing a structured deliverable file (e.g. `deliverable.json`).
The meta-squad then aggregates all domain deliverables into a single consolidated
artifact using `scripts/aggregate.ts`.

### Flow

```
  ┌─────────┐   ┌─────────┐   ┌─────────┐
  │ Domain A │   │ Domain B │   │ Domain C │   ← scatter (parallel)
  └────┬─────┘   └────┬─────┘   └────┬─────┘
       │              │              │
       ▼              ▼              ▼
  deliverable.json  deliverable.json  deliverable.json
       │              │              │
       └──────────────┼──────────────┘
                      ▼
              aggregate.ts              ← gather
                      │
                      ▼
             .squad/aggregation/        ← merged output
```

## Progress Reporting

Report progress at major milestones so meta and the user can track your work. Use the ProgressReporter from the SDK, or use OTel MCP tools directly.

### Using MCP tools (in skill context):
```
otel_event name="team.progress.discovery_complete" attributes='{"team.domain": "{domain}", "progress.percent": 20, "progress.message": "Data sources identified"}'
otel_event name="team.progress.analysis_complete" attributes='{"team.domain": "{domain}", "progress.percent": 40, "progress.message": "Breadth-first survey complete"}'
otel_event name="team.progress.deep_dives_done" attributes='{"team.domain": "{domain}", "progress.percent": 60, "progress.message": "Deep-dive investigations complete"}'
otel_event name="team.progress.validation_done" attributes='{"team.domain": "{domain}", "progress.percent": 80, "progress.message": "Validation complete"}'
otel_event name="team.complete" attributes='{"team.domain": "{domain}", "summary": "Deliverable ready — distillation complete"}'
```

### Milestone guidelines for deliverable teams:
- **20%**: Discovery complete, data sources identified
- **40%**: Analysis complete, breadth-first survey done
- **60%**: Deep-dives complete, fragments produced
- **80%**: Validation complete, conflicts resolved
- **100%**: Distillation complete, deliverable ready

### Also write progress signals to outbox:
Write a JSON file to `.squad/signals/outbox/` for meta relay to pick up:
```bash
echo '{"type":"progress","from":"{domain}","subject":"analysis_complete","body":"Surveyed 200 items across 5 data sources","metadata":{"percent":40}}' > .squad/signals/outbox/$(date +%s)-progress-analysis.json
```

**Important**: Only report major milestones. Don't spam with every file read.

---

## Steps

1. **Discovery** — Identify the domain boundaries AND the data sources available
   to you. Enumerate where information lives: APIs, databases, repos, wikis,
   documentation sites, telemetry systems, org charts, issue trackers. Read any
   prior deliverable or raw fragments already present. Map what data sources
   exist before deciding how to analyze them. Write a data source inventory
   to `raw/data-sources.json`.
   
   **Knowledge:** Record data source patterns and domain boundaries you discover to `.squad/learnings/log.jsonl`. Log as type "discovery" or "pattern".

2. **Analysis** — Perform a breadth-first survey of all relevant sources within
   the domain. Catalog what exists, flag gaps, and prioritize deep-dive targets.
   
   **Knowledge:** As you catalog items, log structural patterns. "Resource type X always has fields Y and Z." "Gap pattern: missing documentation for all pre-2023 items."

3. **Deep-Dives** — Investigate each high-priority area in depth. Produce
   structured findings and write them to `raw/` as intermediate fragments.
   As you produce fragments, observe the natural structure of the data. What
   fields recur? What patterns emerge? This shapes the deliverable schema.
   
   **Knowledge:** Log investigation techniques that work. "API endpoint /v2/details provides more complete data than /v1/summary." "YAML configs require manual validation — JSON Schema doesn't catch edge case X." Record gotchas immediately when you hit them.

4. **Validation** — Cross-reference findings against the domain's source of
   truth. Confirm accuracy, resolve conflicts, and discard stale data.
   
   **Knowledge:** Log corrections when you find errors. Use `supersedes` field to replace earlier learnings that were wrong. "Initial assumption about field X was incorrect — actually means Y, not Z."

5. **Distillation** — Merge validated fragments into the final
   `deliverable.json` at the worktree root. Produce a human-readable
   `SCAN_SUMMARY.md` alongside it. If no schema exists yet, formalize one
   based on the structure you've discovered. Write it as
   `deliverable.schema.json`. Validate your deliverable against it. If a
   schema exists, validate your output against it and propose amendments if
   needed.
   
   **Knowledge:** After completing distillation, update `.squad/agents/*/history.md` with what you learned about this domain. Update `.squad/identity/wisdom.md` if structural patterns emerged that will apply to future runs. If you developed reusable validation or transformation logic, consider extracting it to `.squad/skills/` for next time.

## Schema Evolution

The schema isn't designed upfront — it **emerges** from the domain squad's first
iteration and gets formalized progressively.

### First run (no schema exists)

1. Team runs discovery + analysis as normal.
2. During distillation, team proposes an initial schema based on what they found.
3. Write the schema as a JSON Schema file alongside the deliverable
   (`deliverable.schema.json`).
4. Log the schema rationale as a learning entry
   (`type: "pattern"`, `tags: ["schema"]`).
5. Report schema creation to outbox for meta-squad review.

### Subsequent runs (schema exists)

1. Team reads the existing schema before starting.
2. If discoveries don't fit the schema, propose amendments.
3. Write amendments as learning entries tagged `"schema-evolution"`.
4. Meta-squad reviews and approves schema changes.
5. Updated schema synced to all teams via `sync-skills.ts`.

> **The schema is a living contract** — it evolves with domain understanding.
> First-run output may not perfectly match a later-refined schema, and that's
> expected.

## Completion Criteria

The squad's work is complete when:

- `deliverable.json` exists at the worktree root with all validated findings
- `SCAN_SUMMARY.md` exists with a human-readable summary
- All items in `raw/` have been incorporated or explicitly excluded with rationale
- `deliverable.schema.json` exists (created on first run, updated when structure evolves)

## What Happens After Completion

Once status is `complete`, the **meta-squad** (not this team) handles what comes next:
- Collects your deliverable (see `deliverable-aggregation` skill)
- Validates against the schema
- Runs any project-specific import pipeline

Your job is to produce a high-quality deliverable and report completion. The leadership team takes it from there.

## Schema as Skill

Once a schema stabilizes, the meta-squad should create a **project-level skill**
that documents:

- **Schema structure and field meanings** — what each field represents, its type,
  and why it exists.
- **Data quality expectations per field** — required precision, completeness
  thresholds, acceptable formats.
- **Common pitfalls and edge cases** — patterns that look valid but aren't,
  fields that interact in non-obvious ways.
- **Validation rules beyond JSON Schema** — business-logic constraints,
  cross-field invariants, temporal rules that can't be expressed in static
  schema definitions.

This skill becomes institutional knowledge — new teams that onboard later
inherit it, so domain understanding compounds across iterations rather than
being rediscovered each time.
