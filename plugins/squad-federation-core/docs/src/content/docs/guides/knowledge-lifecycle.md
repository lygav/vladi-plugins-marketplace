---
title: Knowledge Lifecycle
description: Capture, tag, sweep, and graduate team learnings
---

# Knowledge Lifecycle

Squad Federation implements a **knowledge lifecycle** to capture team discoveries, identify reusable patterns, and promote them into shared skills.

## Overview

The lifecycle has four phases:

1. **Capture** - Teams log learnings during work
2. **Tag** - Categorize learnings for searchability
3. **Sweep** - Analyze patterns across teams
4. **Graduate** - Promote learnings to skills
5. **Sync** - Distribute skills to all teams

## Phase 1: Capture Learnings

Teams append entries to `.squad/learnings/log.jsonl` as they discover patterns, conventions, or insights.

### Learning Log Format

Each line is a JSON object:

```json
{"timestamp":"2025-01-30T12:00:00Z","domain":"frontend","category":"pattern","content":"Parallel test execution reduces CI time by 40%","tags":["testing","performance"],"context":"Switched from sequential to parallel jest.config"}
```

**Fields:**
- `timestamp` - ISO 8601 timestamp
- `domain` - Team name
- `category` - Learning type (pattern, discovery, convention, gotcha)
- `content` - The insight (1-2 sentences)
- `tags` - Keywords for search
- `context` - Optional details

### Categories

**pattern** - Reusable approach
> "Use factory pattern for service initialization"

**discovery** - Found behavior
> "Auth context is passed via props, not context API"

**convention** - Team standard
> "Name API routes with kebab-case"

**gotcha** - Pitfall to avoid
> "Don't import barrel files in tests (circular dependency)"

### Logging Programmatically

Via `TeamContext` interface:

```typescript
await teamContext.logLearning({
  category: 'pattern',
  content: 'Use dependency injection for database clients',
  tags: ['architecture', 'database'],
  context: 'Simplifies testing and mocking'
});
```

This appends to the team's `log.jsonl`.

### Manual Logging

Append directly to the file:

```bash
echo '{"timestamp":"2025-01-30T12:00:00Z","domain":"backend","category":"convention","content":"Prefix env vars with APP_","tags":["config"],"context":"Avoids naming conflicts"}' \
  >> .squad/learnings/log.jsonl
```

## Phase 2: Tag Learnings

Tags enable cross-team pattern discovery.

### Suggested Tags

**Technical:**
- `architecture`, `database`, `api`, `testing`, `ci-cd`
- `performance`, `security`, `error-handling`

**Domain:**
- `auth`, `payments`, `notifications`, `search`

**Process:**
- `workflow`, `tooling`, `debugging`, `deployment`

### Multi-Tag Strategy

Use multiple tags for better discovery:

```json
{
  "content": "Cache GraphQL queries at edge for faster page loads",
  "tags": ["performance", "graphql", "caching", "frontend"]
}
```

Sweep scripts can then find all `performance` learnings or all `graphql` learnings.

## Phase 3: Sweep Patterns

The `sweep.ts` script analyzes learnings across teams to find reusable patterns.

### Running Sweeper

```bash
npx tsx scripts/sweep.ts
```

### Sweep Output

**Pattern candidates** (2+ teams mention similar tags):

```
🔍 Pattern Cluster: testing + performance (3 teams)
  - frontend: Parallel test execution reduces CI time
  - backend: Mock external APIs in integration tests
  - infra: Use test containers for database tests

🔍 Pattern Cluster: auth + security (2 teams)
  - frontend: Store tokens in httpOnly cookies
  - backend: Validate JWT signatures on every request
```

### Sweep Algorithm

1. Load all learnings from `log.jsonl`
2. Group by tag combinations (e.g., `["testing", "performance"]`)
3. Find clusters with 2+ teams
4. Rank by frequency and tag overlap

### Sweep Filters

**By tag:**
```bash
npx tsx scripts/sweep.ts --tag performance
```

**By domain:**
```bash
npx tsx scripts/sweep.ts --domain frontend,backend
```

**By date range:**
```bash
npx tsx scripts/sweep.ts --since 2025-01-01
```

## Phase 4: Graduate Learnings

Promote high-value learnings into Skills that all teams can access.

### Graduation Process

1. **Identify candidate** (via sweep or manual review)
2. **Write skill file** (`.squad/skills/{name}.md`)
3. **Tag skill** (skill frontmatter)
4. **Distribute** (sync to teams)

### Creating a Skill

**File:** `.squad/skills/parallel-testing.md`

```markdown
---
tags: [testing, performance, ci-cd]
category: pattern
source: frontend
promoted: 2025-01-30
---

# Parallel Test Execution

Run tests in parallel to reduce CI time.

## Implementation

jest.config.js:
\`\`\`javascript
module.exports = {
  maxWorkers: '50%'
};
\`\`\`

## Impact
- CI time reduced from 8m → 3m
- No test flakiness observed

## Context
Frontend team discovery during sprint 3.
```

### Skill Metadata

- `tags` - Same tags as learning
- `category` - Learning category
- `source` - Originating team
- `promoted` - Graduation date

### Graduation Script

```bash
npx tsx scripts/graduate.ts \
  --learning-id "1706611200000" \
  --skill-name "parallel-testing"
```

This:
1. Reads learning from `log.jsonl`
2. Creates skill file in `.squad/skills/`
3. Appends "graduated" marker to learning

### Manual Graduation

1. Find learning in `log.jsonl`:
```bash
cat .squad/learnings/log.jsonl | jq '. | select(.content | contains("parallel"))'
```

2. Create skill file (see template above)

3. Mark as graduated (append metadata):
```bash
echo '{"timestamp":"2025-01-30T13:00:00Z","domain":"meta-squad","category":"metadata","content":"Graduated learning to skill: parallel-testing","tags":["graduation"],"context":"Learning from frontend team"}' \
  >> .squad/learnings/log.jsonl
```

## Phase 5: Sync Skills

Distribute skills to all teams so they can discover and apply them.

### Sync Script

```bash
npx tsx scripts/sync.ts
```

This:
1. Reads all skills from `.squad/skills/`
2. Copies them to each team's placement (if supported)
3. Logs sync event

### Skill Discovery (Team Perspective)

Teams can query skills via tags:

```bash
# Find all performance-related skills
cat .squad/skills/*.md | grep 'tags:.*performance'
```

Or via their agent's `ReadSkills` capability (if implemented).

### Sync Filters

**By team:**
```bash
npx tsx scripts/sync.ts --team frontend,backend
```

**By skill:**
```bash
npx tsx scripts/sync.ts --skill parallel-testing
```

**Dry-run (preview):**
```bash
npx tsx scripts/sync.ts --dry-run
```

## Knowledge Flows

### Bottom-Up (Team → Meta)

1. Team logs learning during work
2. Learning appears in `.squad/learnings/log.jsonl`
3. Sweep identifies pattern
4. Meta promotes to skill
5. Skill synced to all teams

### Top-Down (Meta → Teams)

1. Meta creates skill directly (e.g., from external source)
2. Skill stored in `.squad/skills/`
3. Sync distributes to teams

### Peer-to-Peer (Team → Team)

Not directly supported. Teams share via meta squad:

1. Team A logs learning
2. Meta sweeps and graduates
3. Team B receives via sync

## Versioning Skills

Skills are **append-only** by default (no versioning in v0.5.0).

To update a skill:
1. Edit the skill file
2. Update `promoted` date in frontmatter
3. Re-sync

Teams see latest version.

## Learning Log Maintenance

### Size Management

The `log.jsonl` grows over time. Compress old entries:

```bash
# Keep last 1000 lines
tail -1000 .squad/learnings/log.jsonl > .squad/learnings/log-recent.jsonl
mv .squad/learnings/log-recent.jsonl .squad/learnings/log.jsonl
```

### Archiving

Move old learnings to archive:

```bash
mkdir -p .squad/learnings/archive
mv .squad/learnings/log.jsonl .squad/learnings/archive/log-2025-01.jsonl
touch .squad/learnings/log.jsonl
```

### Querying Historical Data

```bash
cat .squad/learnings/archive/*.jsonl .squad/learnings/log.jsonl | \
  jq '. | select(.tags[] == "performance")'
```

## Best Practices

### Capture

- Log learnings immediately (while context is fresh)
- Be specific (avoid vague insights like "tests are important")
- Include context (why it matters)

### Tag

- Use existing tags when possible
- Create new tags for new domains
- Max 3-5 tags per learning

### Sweep

- Run weekly or after major milestones
- Focus on high-frequency patterns first
- Review outliers (unique learnings from one team)

### Graduate

- Promote patterns used by 2+ teams
- Write clear, actionable skill docs
- Include code examples

### Sync

- Sync after each graduation
- Notify teams of new skills (via signal)
- Track skill adoption (optional metric)

## Telemetry

If telemetry is enabled:

**Events:**
- `learning.captured` - New learning logged
- `learning.graduated` - Learning promoted to skill
- `skill.synced` - Skill distributed to team

**Metrics:**
- `squad.learnings.count` - Total learnings
- `squad.skills.count` - Total skills
- `squad.skills.synced` - Sync operations

**Attributes:**
- `domain` - Team name
- `category` - Learning category
- `tags` - Learning tags

## Troubleshooting

### Learning not appearing

Check file format (must be valid JSON on single line):
```bash
tail -1 .squad/learnings/log.jsonl | jq .
```

If error, fix and re-append.

### Sweep finds no patterns

Ensure teams use common tags:
```bash
cat .squad/learnings/log.jsonl | jq -r '.tags[]' | sort | uniq -c | sort -rn
```

Align tags if fragmented.

### Skill not syncing

Check team placement supports file operations:
- **Worktree:** ✅ Supports file copy
- **Directory:** ✅ Supports file copy
- **Custom:** ⚠️ Depends on implementation

## Next Steps

- [Understand archetype roles](/archetypes/overview)
- [Configure learning log paths](/reference/configuration)
- [View SDK interfaces for TeamContext](/reference/sdk-types)
