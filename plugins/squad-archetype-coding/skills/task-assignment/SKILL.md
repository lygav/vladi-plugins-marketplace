---
trigger:
  - "assign task"
  - "create task"
  - "write spec"
  - "task for coding team"
  - "send implementation task"
  - "break down work"
actor: meta-squad
---

# Task Assignment

Break down work into focused tasks and assign them to coding teams via inbox directives. Good specs produce good output. Bad specs produce rework.

---

## Writing Good Task Specs

Every coding team reads its task from `DOMAIN_CONTEXT.md` and inbox directives. The spec is the single source of truth for what the team builds. Include:

- **Objective.** One sentence: what does this task produce?
- **Requirements.** Concrete list of what must be implemented. No ambiguity.
- **Acceptance criteria.** How to verify the task is done. Testable conditions.
- **Relevant files and paths.** Point the team to the exact directories, modules, or files to modify. Teams should not have to guess where to work.
- **Constraints.** Technology choices, performance budgets, compatibility requirements, things to avoid.
- **Context.** Why this task matters. What depends on it. Any background the team needs to make good design decisions.

Bad spec example: "Add search." — No scope, no criteria, no constraints. The team will guess wrong.

Good spec example: "Add full-text search to the products API. Index the `name` and `description` fields. Return results ranked by relevance. Must handle 10k products with <200ms p95 latency. Add integration tests. Do not introduce new external dependencies beyond what's already in package.json."

## Scoping Tasks

One team = one focused task. Follow these rules:

- A task should be completable in a single implementation cycle (design → implement → test → PR).
- If a feature spans multiple concerns (e.g., backend API + frontend UI + database migration), split it into separate teams, one per concern.
- If a task requires changes across unrelated modules, split it. Two small focused PRs are better than one sprawling PR.
- If you cannot write clear acceptance criteria for a task, it is too vague. Refine before assigning.

Over-scoping is the most common failure mode. When in doubt, split.

## Sending Specs as Directives

Write the task specification to the team's inbox as a JSON directive. The team checks its inbox before each phase and picks up new work.

Example directive for a well-structured task assignment:

```json
{
  "directive": "implementation-task",
  "from": "meta-squad",
  "timestamp": "2025-01-15T09:00:00Z",
  "target_team": "feature-search",
  "payload": {
    "objective": "Add full-text search endpoint to the products API",
    "requirements": [
      "Create GET /api/products/search?q=<query> endpoint",
      "Index the name and description fields for full-text search",
      "Return results sorted by relevance score",
      "Support pagination with limit and offset parameters",
      "Return 400 for empty query strings"
    ],
    "acceptance_criteria": [
      "Endpoint returns matching products for valid queries",
      "Results are ranked by relevance",
      "Pagination works correctly with limit/offset",
      "p95 latency < 200ms for 10k product dataset",
      "Integration tests cover all requirements"
    ],
    "relevant_paths": [
      "src/api/products/",
      "src/models/product.ts",
      "tests/integration/products/"
    ],
    "constraints": [
      "No new external dependencies",
      "Must be compatible with the existing PostgreSQL schema",
      "Follow existing API response format in src/api/types.ts"
    ],
    "context": "This supports the upcoming marketplace launch. The frontend team will consume this endpoint once merged. They are blocked on this."
  }
}
```

Place this file at `teams/feature-search/inbox/task-search-endpoint.json`.

## Priority and Sequencing

When tasks have dependencies, sequence team onboarding:

1. Identify the dependency graph. If task B depends on task A's output, team B cannot start until team A merges.
2. Onboard team A first. Let it complete its cycle and merge its PR.
3. Once team A's `pr_merged` signal appears in its outbox, onboard team B with a directive referencing the merged work.
4. In the directive to team B, include: `"depends_on": { "team": "feature-auth", "pr": 42, "status": "merged" }` so the team knows the dependency is resolved.

Do not onboard dependent teams in parallel hoping they will sort it out. They will not. Sequence explicitly.

For independent tasks with no dependency relationship, onboard teams in parallel to maximize throughput.

## Re-Tasking

To change a running team's task mid-cycle:

1. Write a new directive to the team's inbox with `"directive": "re-task"` and the updated spec.
2. The team checks inbox before each phase. On seeing a re-task directive, it abandons current work and starts the new task.
3. If the team has already opened a PR for the old task, send a separate directive to close or abandon that PR.

```json
{
  "directive": "re-task",
  "from": "meta-squad",
  "timestamp": "2025-01-15T16:00:00Z",
  "target_team": "feature-search",
  "payload": {
    "reason": "Requirements changed. Search now needs to support fuzzy matching.",
    "new_spec": {
      "objective": "Add full-text search with fuzzy matching to products API",
      "requirements": ["(updated requirements here)"],
      "acceptance_criteria": ["(updated criteria here)"]
    },
    "abandon_previous_pr": true
  }
}
```

Use re-tasking sparingly. Frequent re-tasking wastes cycles and demoralizes throughput metrics.

## When to Create a New Team vs. Reuse

Persistent teams accumulate codebase knowledge across runs. Their DOMAIN_CONTEXT.md and conversation history give them context that a fresh team lacks.

- **Reuse** an existing team when the new task is in the same domain, touches the same files, or builds on previous work. Relaunch the team with an updated inbox directive.
- **Create a new team** when the task is in a completely different domain, the existing team's context would be irrelevant or confusing, or you need parallel work in distinct areas.

Prefer relaunching over creating. A team that previously built the auth module is the best team to extend it. Spinning up a fresh team for the same module means re-learning the codebase from scratch.

---

**Summary:** Write clear specs with objective, requirements, acceptance criteria, paths, and constraints → scope to one focused task per team → deliver via inbox directives → sequence dependent tasks explicitly → re-task sparingly → reuse teams that know the domain.
