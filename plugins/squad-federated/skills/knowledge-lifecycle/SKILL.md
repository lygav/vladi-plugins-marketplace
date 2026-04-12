---
name: "knowledge-lifecycle"
description: "The user wants to manage knowledge flows in the federation — seeding skills to new domains, syncing skill updates across domains, graduating domain learnings into reusable skills, sweeping cross-domain patterns, or querying the learning log. Triggers on: knowledge, learning, seed skills, sync skills, graduate learning, knowledge flow, sweep learnings, learning log, pattern detection."
version: "0.1.0"
---

## Purpose

Manage the flow of knowledge through the federated squad system. Knowledge moves in three directions: **seed** (main → new domain at onboarding), **sync** (main → all domains periodically), and **graduate** (domain → main via review). This skill covers the scripts, formats, and processes that power each flow.

## The Three Knowledge Flows

### 1. Seed — Main → Domain at Onboarding

When a new domain is onboarded via `onboard.ts`, skills from the main branch are copied into the domain worktree. This gives the domain squad a starting set of skills and knowledge without requiring it to discover everything from scratch.

What gets seeded:
- All skills from `.squad/skills/` on main
- Template files from the `templates/` directory
- The current `federate.config.json` settings
- Agent charters generated for the domain's role configuration

Seeding is automatic during onboarding. No separate script invocation is needed for the initial seed.

### 2. Sync — Main → Domains Periodically

As skills evolve on main (through graduation, manual updates, or new skill creation), those improvements need to reach active domain squads. The sync flow propagates skill updates from main to all (or selected) domain worktrees.

```bash
# Sync all skills to all domains
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/sync-skills.ts

# Sync a specific skill to all domains
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/sync-skills.ts --skill domain-playbook

# Sync to a specific domain only
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/sync-skills.ts --team payments

# Preview what would change
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/sync-skills.ts --dry-run
```

How sync works:
1. Reads skills from `.squad/skills/` on the main branch
2. Discovers all domain worktrees via `git worktree list`
3. Compares each skill's content (hash-based) to detect changes
4. Copies changed skills to domain worktrees
5. Records sync state: source commit, timestamp, skills synced
6. Commits the sync on each domain branch

Sync state is tracked per-domain in `.squad/sync-state.json`:

```json
{
  "last_sync_from": "main",
  "last_sync_commit": "abc123",
  "last_sync_at": "2024-01-15T14:00:00.000Z",
  "skills_synced": ["domain-playbook", "data-validation"]
}
```

Conflict handling: if a domain has locally modified a skill that also changed on main, sync will **not** overwrite it. The conflict is logged and the operator must resolve it manually. Use `--dry-run` to preview conflicts before syncing.

### 3. Graduate — Domain → Main via Review

When a domain squad discovers something useful that applies beyond its domain, that knowledge can be **graduated** into a skill on main. This is the feedback loop that makes the federation smarter over time.

Graduation is a multi-step process:

#### Step 1: Domain squad records a learning

During normal operation, domain agents record learnings in the learning log (see Learning Log Format below). Learnings marked with `domain: "generalizable"` are candidates for graduation.

#### Step 2: Sweep for cross-domain patterns

```bash
# Find patterns across all domain logs
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/sweep-learnings.ts

# Require pattern to appear in 3+ domains
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/sweep-learnings.ts --min-occurrences 3

# Focus on specific tags
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/sweep-learnings.ts --tags "configuration,deployment"

# Write report to decisions inbox
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/sweep-learnings.ts --output .squad/decisions/inbox/sweep-report.md
```

The sweep engine reads learning logs from all domain branches (via `git show`, no worktree checkout needed). It groups learnings by topic, counts occurrences, and identifies patterns that appear across multiple domains.

Sweep output is a Markdown report listing each pattern with:
- Topic and occurrence count
- Which domains reported it
- Representative entries
- Suggested target skill for graduation

#### Step 3: Graduate specific learnings

```bash
# Show graduation candidates (high-confidence, generalizable, ungraduated)
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/graduate-learning.ts --candidates

# Graduate a specific learning into a skill
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/graduate-learning.ts \
  --id learn-1705312000-abc123 \
  --target-skill domain-playbook

# Graduate from a sweep report
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/graduate-learning.ts \
  --from-sweep .squad/decisions/inbox/sweep-report.md
```

What graduation does:
1. Reads the learning entry from the source domain's log
2. Appends the learning content to the target skill on main
3. Marks the original entry as graduated (sets `graduated_to_skill` field)
4. Commits the skill update on main
5. The next sync propagates the improved skill to all domains

Candidate scoring: learnings are ranked by confidence level (high > medium > low), generalizability domain tag, and cross-domain occurrence count. Only `generalizable` + `high` confidence entries auto-qualify.

## Learning Log Format

Each domain maintains a learning log at `.squad/learnings/log.jsonl`. It is an append-only JSONL file (one JSON object per line).

### LearningEntry Interface

```typescript
interface LearningEntry {
  id: string;               // Auto-generated: "learn-{timestamp}-{random}"
  ts: string;               // ISO 8601 timestamp, auto-generated
  type: LearningType;       // Category of the learning
  agent: string;            // Name of the agent that recorded it
  domain?: string;          // "local" (domain-specific) or "generalizable"
  tags: string[];           // Free-form tags for filtering
  title: string;            // One-line summary
  body: string;             // Detailed description (Markdown)
  confidence: 'low' | 'medium' | 'high';
  source?: string;          // Where the learning came from
  supersedes?: string;      // ID of a previous learning this replaces
  graduated_to_skill?: string; // Set by graduation engine
}
```

### Learning Types

| Type | When to Use | Example |
|------|-------------|---------|
| **discovery** | Found something new about the domain | "Payment service uses a custom retry policy with exponential backoff capped at 30 seconds" |
| **correction** | Previous understanding was wrong | "The config file is YAML, not JSON — earlier analysis was incorrect" |
| **pattern** | Recurring structure across resources | "All API services follow the same health-check endpoint pattern at /healthz" |
| **technique** | A method that worked well | "Combining resource graph queries with config file analysis gives better coverage" |
| **gotcha** | A trap or non-obvious behavior | "The staging environment config silently overrides production values when both are present" |

### Recording a Learning

Domain agents use the `LearningLog` class:

```typescript
import { LearningLog } from '${CLAUDE_PLUGIN_ROOT}/scripts/lib/learning-log.js';

const log = new LearningLog(squadRoot);

log.append({
  type: 'pattern',
  agent: 'Agent Beta',
  domain: 'generalizable',
  tags: ['configuration', 'health-check'],
  title: 'Standard health endpoint pattern',
  body: 'All API services expose /healthz with a consistent JSON response format including uptime and dependency status.',
  confidence: 'high',
  source: 'Observed in 4/4 API services analyzed',
});
```

### Querying Learnings

```typescript
const log = new LearningLog(squadRoot);

// All high-confidence generalizable patterns
const patterns = log.query({
  type: 'pattern',
  domain: 'generalizable',
  confidence: 'high',
});

// Everything from the last 24 hours
const recent = log.query({
  since: new Date(Date.now() - 86400000).toISOString(),
});

// All entries tagged with 'deployment'
const deploymentLearnings = log.query({
  tags: ['deployment'],
});
```

The `query-learnings.ts` script provides a CLI interface to the same query functionality:

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/query-learnings.ts --type pattern --confidence high
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/query-learnings.ts --since "2024-01-15" --tags "auth"
```

### Cross-Branch Reading

The meta-squad can read any domain's learning log without a worktree checkout:

```typescript
import { LearningLog } from '${CLAUDE_PLUGIN_ROOT}/scripts/lib/learning-log.js';

// Read from a domain branch via git show
const entries = LearningLog.readFromBranch('scan/payments', repoRoot);
```

This is how `sweep-learnings.ts` collects data across all domains efficiently.

## Knowledge Flow Lifecycle

```
Domain Agent Records Learning
        ↓
  .squad/learnings/log.jsonl (append)
        ↓
  sweep-learnings.ts detects cross-domain pattern
        ↓
  Operator reviews sweep report
        ↓
  graduate-learning.ts promotes to skill on main
        ↓
  sync-skills.ts propagates updated skill to all domains
        ↓
  All domains benefit from the graduated knowledge
```

## Best Practices

### For Domain Agents
- Record learnings frequently, even minor ones. The sweep engine filters for significance.
- Use `domain: "generalizable"` only when the learning truly applies beyond this specific domain. Default to `domain: "local"`.
- Use `supersedes` when correcting a previous learning. Do not delete old entries.
- Tag generously. Tags power the sweep engine's pattern matching.
- Set confidence honestly. `high` = verified with data. `medium` = likely correct. `low` = hypothesis.

### For Meta-Squad Operators
- Run sweeps after each batch of domain scans completes.
- Set `--min-occurrences` to at least 2 for graduation candidates. Single-domain patterns may be domain-specific.
- Review sweep reports before graduating. Not every cross-domain pattern belongs in a skill.
- Sync skills promptly after graduation. Domains in-flight benefit immediately.
- Use `--dry-run` on sync to verify changes before propagating.

### For Skill Authors
- Keep skills focused. One skill per topic. If a graduated learning does not fit an existing skill, create a new one.
- Version skills in frontmatter. Increment on graduation.
- Reference learning IDs in skill content so the lineage is traceable.

## Troubleshooting

- **Sync says "no changes"**: the domain is already up to date, or the sync state commit matches HEAD on main.
- **Graduation fails with "not found"**: the learning ID does not exist in any domain branch. Verify with `query-learnings.ts`.
- **Sweep finds no patterns**: either learnings are too domain-specific, or not enough domains have been scanned. Lower `--min-occurrences` or check that agents are tagging learnings as `generalizable`.
- **Conflict during sync**: a domain locally modified a skill that also changed on main. Manually merge the domain worktree's version with main, then re-sync.
