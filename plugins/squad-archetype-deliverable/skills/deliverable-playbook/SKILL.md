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

1. **Discovery** — Identify the domain and its boundaries. Read any prior
   deliverable or raw fragments already present. Understand the full scope
   before diving in.

2. **Analysis** — Perform a breadth-first survey of all relevant sources within
   the domain. Catalog what exists, flag gaps, and prioritize deep-dive targets.

3. **Deep-Dives** — Investigate each high-priority area in depth. Produce
   structured findings and write them to `raw/` as intermediate fragments.

4. **Validation** — Cross-reference findings against the domain's source of
   truth. Confirm accuracy, resolve conflicts, and discard stale data.

5. **Distillation** — Merge validated fragments into the final
   `deliverable.json` at the worktree root. Produce a human-readable
   `SCAN_SUMMARY.md` alongside it.

## Completion Criteria

The squad's work is complete when:

- `deliverable.json` exists at the worktree root with all validated findings
- `SCAN_SUMMARY.md` exists with a human-readable summary
- All items in `raw/` have been incorporated or explicitly excluded with rationale

## Aggregation

After all domain squads finish, the meta-squad runs:

```bash
npx tsx scripts/aggregate.ts
```

This collects every domain's `deliverable.json`, writes them to
`.squad/aggregation/collected/`, runs any configured import hook, and produces a
manifest at `.squad/aggregation/manifest.json`.

See `scripts/aggregate.ts` for CLI flags (`--list`, `--dry-run`, `--teams`).
