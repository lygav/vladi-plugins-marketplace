---
title: Knowledge Lifecycle
description: How teams capture learnings and share knowledge through conversational workflows
---

# Knowledge Lifecycle

Squad Federation implements a **knowledge lifecycle** where teams capture discoveries during work, patterns emerge across teams, and valuable insights become shared skills accessible to everyone.

## How Knowledge Flows

The lifecycle has three phases:

1. **Capture** - Teams log learnings as they discover patterns and insights
2. **Sweep** - Analyze learnings to find cross-team patterns
3. **Graduate** - Promote valuable patterns into shared skills

All phases happen through conversational interaction with the **knowledge-lifecycle skill**.

## Phase 1: Capturing Learnings

Teams automatically log learnings during their work. Each learning is a single JSON line in `.squad/learnings/log.jsonl`.

### Learning Format

```json
{"timestamp":"2025-01-30T12:00:00Z","domain":"frontend","category":"pattern","content":"Parallel test execution reduces CI time by 40%","tags":["testing","performance"],"context":"Switched from sequential to parallel jest.config"}
```

**Fields:**
- `timestamp` - When the insight occurred (ISO 8601)
- `domain` - Team that discovered it
- `category` - Type of learning (pattern, discovery, convention, gotcha)
- `content` - The insight itself (1-2 sentences)
- `tags` - Keywords for search and pattern matching
- `context` - Additional details (optional)

### Learning Categories

**pattern** - Reusable approach
> "Use factory pattern for service initialization"

**discovery** - Found behavior
> "Auth context is passed via props, not context API"

**convention** - Team standard
> "Name API routes with kebab-case"

**gotcha** - Pitfall to avoid
> "Don't import barrel files in tests (circular dependency)"

### How Teams Log Learnings

Teams log learnings programmatically through their archetype's `TeamContext` interface:

```typescript
await teamContext.logLearning({
  category: 'pattern',
  content: 'Use dependency injection for database clients',
  tags: ['architecture', 'database'],
  context: 'Simplifies testing and mocking'
});
```

This appends to the team's learning log automatically.

### Tagging Strategy

Tags enable pattern discovery across teams. Use multiple relevant tags:

```json
{
  "content": "Cache GraphQL queries at edge for faster page loads",
  "tags": ["performance", "graphql", "caching", "frontend"]
}
```

**Suggested tags:**
- Technical: `architecture`, `database`, `api`, `testing`, `ci-cd`, `performance`, `security`
- Domain: `auth`, `payments`, `notifications`, `search`
- Process: `workflow`, `tooling`, `debugging`, `deployment`

## Phase 2: Sweeping for Patterns

The **knowledge-lifecycle skill** analyzes learnings across all teams to find reusable patterns.

### Finding Cross-Team Patterns

> "What patterns have emerged across my teams?"

The skill shows clusters where multiple teams discovered similar insights:

```
🔍 Pattern Cluster: testing + performance (3 teams)
  - frontend: Parallel test execution reduces CI time
  - backend: Mock external APIs in integration tests
  - infra: Use test containers for database tests

🔍 Pattern Cluster: auth + security (2 teams)
  - frontend: Store tokens in httpOnly cookies
  - backend: Validate JWT signatures on every request
```

### Filtering Sweeps

**By topic:**
> "Show me all learnings about performance"

**By specific team:**
> "What has the frontend team learned?"

**By date:**
> "What have teams learned this week?"

### How Sweeping Works

The skill:
1. Loads all learnings from `log.jsonl`
2. Groups by tag combinations
3. Finds clusters with 2+ teams sharing tags
4. Ranks by frequency and relevance

Patterns with strong cross-team overlap are candidates for graduation.

## Phase 3: Graduating to Skills

When a pattern proves valuable across teams, promote it to a shared skill.

### The Graduation Process

> "Graduate the parallel testing pattern to a skill"

The skill:
1. **Identifies the learning** - Shows you the original log entry
2. **Creates skill file** - Writes `.squad/skills/parallel-testing.md`
3. **Tags the skill** - Uses tags from the learning
4. **Syncs to teams** - Distributes skill to all team workspaces

### What a Graduated Skill Looks Like

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

The frontmatter tracks:
- `tags` - Same tags as the original learning
- `category` - Learning category
- `source` - Team that discovered it
- `promoted` - When it was graduated

### Finding Available Skills

> "What skills are available?"

The skill lists all graduated patterns:

```
📚 Available Skills (4):

1. parallel-testing
   Tags: testing, performance, ci-cd
   From: frontend team
   
2. dependency-injection
   Tags: architecture, database, testing
   From: backend team
   
3. edge-caching
   Tags: performance, graphql, frontend
   From: frontend team
   
4. test-containers
   Tags: testing, database, infra
   From: infra team
```

### Searching Skills

> "Show me all performance-related skills"

```
📚 Performance Skills (2):

1. parallel-testing
   Reduces CI time by running tests in parallel
   
2. edge-caching
   Cache GraphQL queries at CDN edge for faster loads
```

## Knowledge Flows

### Bottom-Up (Team → Shared)

1. Team logs learning during work
2. Learning appears in `.squad/learnings/log.jsonl`
3. Sweep identifies pattern
4. Pattern graduates to skill
5. Skill syncs to all teams

### Top-Down (Manual → Teams)

You can create skills directly:

> "Create a skill for our coding standards"

The skill:
1. Asks what the skill should cover
2. Creates the skill file
3. Syncs to all teams

### Discovery by Teams

Teams can query skills conversationally:

> "Do we have any testing patterns?"

Skills are stored as markdown files in `.squad/skills/` — the knowledge-lifecycle skill can list and summarize them for you.

## Learning Log Maintenance

The learning log at `.squad/learnings/log.jsonl` grows over time as teams capture insights. For very large projects with extensive learning histories, you may want to periodically archive older entries to keep the active log focused and performant. The knowledge-lifecycle skill can help identify which learnings have been graduated to skills and may be candidates for archiving.

## Telemetry

If telemetry is enabled, knowledge events flow to the dashboard:

**Events:**
- `learning.captured` - New learning logged
- `learning.graduated` - Learning promoted to skill
- `skill.synced` - Skill distributed to team

**Metrics:**
- `squad.learnings.count` - Total learnings
- `squad.skills.count` - Total skills
- `squad.skills.synced` - Sync operations

## Best Practices

### Capturing Learnings

- Log immediately while context is fresh
- Be specific (avoid vague insights like "tests are important")
- Include concrete context (what changed, why it matters)
- Use consistent tags

### Running Sweeps

- Sweep weekly or after major milestones
- Focus on high-frequency patterns first
- Review outliers (unique insights worth sharing)

### Graduating Skills

- Promote patterns used by 2+ teams
- Write clear, actionable documentation
- Include code examples
- Update as patterns evolve

### Syncing Skills

- Sync after each graduation
- Notify teams via signals (optional)
- Track which teams adopt skills (optional metric)

## Troubleshooting

### Learning Not Appearing

Ask the knowledge-lifecycle skill to check recent learnings:
> "What have my teams learned recently?"

The skill will show the latest learnings and help identify any issues with the learning log format.

### Sweep Finds No Patterns

Ask the skill to analyze tag usage:
> "What tags are teams using in their learnings?"

The skill will show common tags and help identify if tag fragmentation (e.g., `perf` vs `performance`) is preventing pattern detection.

### Skill Not Syncing

Check team placement supports file operations:
- **Worktree:** ✅ Supports sync
- **Directory:** ✅ Supports sync
- **Custom:** ⚠️ Depends on implementation

## Working with the Knowledge Lifecycle

The knowledge-lifecycle skill handles all learning operations conversationally:

**Sweep for patterns:**
> "What patterns have emerged across my teams?"

**Filter by tag:**
> "Show me all learnings about performance"

**Graduate a learning:**
> "Graduate the parallel testing pattern to a skill"

**Sync skills to teams:**
> "Sync skills to all teams"

All knowledge operations happen through natural conversation with the skill.

## Next Steps

- [Learn about team archetypes](/vladi-plugins-marketplace/getting-started/introduction#team-archetypes)
- [Understand monitoring](/vladi-plugins-marketplace/guides/monitoring)
- [Explore communication transports](/vladi-plugins-marketplace/guides/communication-transports)
