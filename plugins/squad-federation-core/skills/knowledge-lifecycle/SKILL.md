---
name: "knowledge-lifecycle"
description: "The user wants to manage knowledge flows in the federation — seeding skills to new domains, syncing skill updates across domains, graduating domain learnings into reusable skills, sweeping cross-domain patterns, or querying the learning log. Triggers on: knowledge, learning, seed skills, sync skills, graduate learning, knowledge flow, sweep learnings, learning log, pattern detection."
version: "0.2.0"
---

## Purpose

Thin conversational wrapper around knowledge management scripts (ADR-001 script-drives-skill model). This skill identifies what the user wants, collects any missing parameters, then delegates ALL mechanical work to scripts via `--non-interactive --output-format json`.

**Skill owns:** conversational flow, parameter collection, presenting results.
**Scripts own:** all logic — syncing skills, sweeping learnings, graduating knowledge, querying logs.

## Bootstrap

Before running any scripts:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/bootstrap.mjs
```

## Knowledge Flows

Knowledge moves in three directions:
1. **Seed** — main to new domain at onboarding (automatic, handled by `onboard.ts`)
2. **Sync** — main to all domains periodically (via `sync-skills.ts`)
3. **Graduate** — domain to main via review (via `graduate-learning.ts`)

## Operations

### Sync Skills

When the user says "sync skills", "push skill updates to teams", "propagate changes":

1. Optionally ask which skill or team to target (defaults: all skills, all teams)

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/bootstrap.mjs && npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/sync-skills.ts --non-interactive --output-format json
```

Variants:
```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/sync-skills.ts --skill <name> --non-interactive --output-format json
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/sync-skills.ts --team <name> --non-interactive --output-format json
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/sync-skills.ts --dry-run --non-interactive --output-format json
```

Parse JSON output and present: teams processed, teams synced, conflicts if any.

### Sweep Learnings

When the user says "sweep learnings", "find patterns", "what have teams learned":

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/bootstrap.mjs && npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/sweep-learnings.ts --non-interactive --output-format json
```

Variants:
```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/sweep-learnings.ts --min-occurrences 3 --non-interactive --output-format json
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/sweep-learnings.ts --tags "ci,deployment" --non-interactive --output-format json
```

Parse JSON output and present: domains scanned, patterns found, graduation candidates.

To save a markdown report for manual review:
```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/sweep-learnings.ts --output .squad/decisions/inbox/sweep-report.md
```

### Graduate a Learning

When the user says "graduate this learning", "promote learning to skill", "show graduation candidates":

**Show candidates:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/bootstrap.mjs && npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/graduate-learning.ts --candidates --non-interactive --output-format json
```

Parse JSON and present: learning ID, domain, title, confidence, score, related skill.

**Graduate a specific learning:**
```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/graduate-learning.ts --id <learning-id> --target-skill <skill-name>
```

**Graduate from sweep report:**
```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/graduate-learning.ts --from-sweep .squad/decisions/inbox/sweep-report.md
```

### Query Learnings

When the user says "show learnings", "what did the team learn", "search learning log":

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/bootstrap.mjs && npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/query-learnings.ts --json
```

Variants:
```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/query-learnings.ts --type pattern --confidence high --json
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/query-learnings.ts --tags "auth,security" --json
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/query-learnings.ts --since "2024-01-15" --json
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/query-learnings.ts --squad squad/payments --json
```

## Learning Log Format

Domain agents record learnings in `.squad/learnings/log.jsonl` (append-only JSONL). Each entry has:
- **id** — auto-generated timestamp-based ID
- **type** — discovery, correction, pattern, technique, gotcha
- **confidence** — low, medium, high
- **domain** — "local" (domain-specific) or "generalizable" (cross-domain)
- **tags** — free-form tags for filtering
- **title/body** — the learning content

Only `generalizable` + `high` confidence entries auto-qualify for graduation.

## Lifecycle Flow

```
Domain agent records learning
  -> sweep-learnings.ts detects cross-domain patterns
  -> Operator reviews sweep report
  -> graduate-learning.ts promotes to skill on main
  -> sync-skills.ts propagates updated skill to all domains
  -> All domains benefit from graduated knowledge
```

## Best Practices

- Run sweeps after each batch of domain scans completes
- Set `--min-occurrences` to at least 2 for graduation candidates
- Review sweep reports before graduating
- Sync skills promptly after graduation
- Use `--dry-run` on sync to verify changes before propagating
