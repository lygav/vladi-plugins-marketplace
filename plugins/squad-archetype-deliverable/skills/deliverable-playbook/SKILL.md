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

## Steps

1. **Discovery** — Identify the domain boundaries AND the data sources available
   to you. Enumerate where information lives: APIs, databases, repos, wikis,
   documentation sites, telemetry systems, org charts, issue trackers. Read any
   prior deliverable or raw fragments already present. Map what data sources
   exist before deciding how to analyze them. Write a data source inventory
   to `raw/data-sources.json`.

2. **Analysis** — Perform a breadth-first survey of all relevant sources within
   the domain. Catalog what exists, flag gaps, and prioritize deep-dive targets.

3. **Deep-Dives** — Investigate each high-priority area in depth. Produce
   structured findings and write them to `raw/` as intermediate fragments.
   As you produce fragments, observe the natural structure of the data. What
   fields recur? What patterns emerge? This shapes the deliverable schema.

4. **Validation** — Cross-reference findings against the domain's source of
   truth. Confirm accuracy, resolve conflicts, and discard stale data.

5. **Distillation** — Merge validated fragments into the final
   `deliverable.json` at the worktree root. Produce a human-readable
   `SCAN_SUMMARY.md` alongside it. If no schema exists yet, formalize one
   based on the structure you've discovered. Write it as
   `deliverable.schema.json`. Validate your deliverable against it. If a
   schema exists, validate your output against it and propose amendments if
   needed.

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

## Aggregation

After all domain squads finish, the meta-squad runs:

```bash
npx tsx scripts/aggregate.ts
```

This collects every domain's `deliverable.json`, writes them to
`.squad/aggregation/collected/`, runs any configured import hook, and produces a
manifest at `.squad/aggregation/manifest.json`.

See `scripts/aggregate.ts` for CLI flags (`--list`, `--dry-run`, `--teams`).

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
