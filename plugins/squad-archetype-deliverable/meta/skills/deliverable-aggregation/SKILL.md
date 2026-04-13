---
name: deliverable-aggregation
description: This skill activates for the META-SQUAD (leadership team) when they need to collect, validate, and aggregate deliverables from multiple domain teams. Triggers on "aggregate", "collect results", "gather deliverables", "merge team outputs", "validate deliverables".
version: 0.1.0
---

# Deliverable Aggregation (Meta-Squad)

> **Actor: Meta-squad / Leadership team.** This skill is NOT for domain teams — it's for the leadership team that coordinates across teams.

## When to Use

After one or more domain teams reach `state: "complete"` in their status.json, the meta-squad collects their deliverables into a unified result.

## Aggregation Flow

```
Meta-squad checks status → identifies complete teams
        │
        ▼
aggregate.ts --validate → collect + validate each deliverable
        │
        ▼
.squad/aggregation/collected/{team}/deliverable.json
        │
        ▼
(optional) import hook → project-specific post-processing
```

## Running Aggregation

```bash
# Collect from all complete teams
npx tsx scripts/aggregate.ts

# Preview what's available without collecting
npx tsx scripts/aggregate.ts --list

# Collect and validate against schema
npx tsx scripts/aggregate.ts --validate

# Collect from specific teams only
npx tsx scripts/aggregate.ts --teams "team-alpha,team-beta"

# Dry run (collect to memory, don't write)
npx tsx scripts/aggregate.ts --dry-run
```

## Validation

When `--validate` is passed (or `deliverableSchema` is configured in `federate.config.json`):

1. Each team's deliverable is checked against the JSON Schema
2. Results reported per team: `✅ valid (16 items)` or `⚠️ invalid — missing field "name"`
3. Invalid deliverables are still collected but flagged in the manifest
4. Summary: "Validated 3/4 teams. 1 validation warning."

**Important:** If a team's deliverable fails validation, don't reject it silently. Send a directive to the team's inbox explaining what's wrong so they can fix it on their next run.

## Output

Aggregation produces:
- `.squad/aggregation/collected/{team}/` — each team's deliverable
- `.squad/aggregation/manifest.json` — metadata (team, timestamp, validation status)

## Import Hook

If `importHook` is configured in `federate.config.json`, the script runs it after collection. This is where project-specific logic lives (e.g., importing into a database, generating reports, merging into a unified file).

## When NOT to Aggregate

- Team status is not `complete` — wait or send a directive asking for status
- Schema doesn't exist yet — first-run teams need to produce it before validation makes sense
- Only one team exists — aggregation is for cross-team collection; single-team output is just the deliverable itself
