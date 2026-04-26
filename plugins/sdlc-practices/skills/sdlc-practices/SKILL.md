---
name: sdlc-practices
description: This skill should be used when the user asks to "plan work", "dispatch agents", "create a feature branch", "launch parallel tasks", "review code", "merge branches", "break down a task", "run code review", or when coordinating multi-agent development workflows. Provides battle-tested SDLC rules for AI agent team coordination including branch isolation, task decomposition, review gates, and dispatch patterns.
version: 0.2.0
---

# SDLC Practices for AI Agent Teams

## Purpose

Provide procedural knowledge for coordinating AI agent teams following strict software development lifecycle practices. These rules emerged from real multi-agent projects and prevent the most common failure modes: branch contamination, scope creep, mega-tasks that time out, and missing review gates.

## Core Rules

### 1. Branch Isolation Is Mandatory

Every work package MUST use a dedicated feature branch created from the current mainline. Never allow two agents to share a branch. Never allow an agent to work directly on main.

**Use git worktrees for parallel agents.** Each agent gets its own worktree directory — no shared working tree, no checkout conflicts, no accidental cross-branch commits:

```bash
# Coordinator creates worktree before dispatching
git worktree add .worktrees/{branch-name} -b feature/{branch-name}

# Agent works in .worktrees/{branch-name}/ — NOT the main checkout
# Main working tree stays on main, untouched
```

**Pre-launch checklist:**
- Create the worktree: `git worktree add .worktrees/{name} -b feature/{name}`
- Agent prompt specifies `cd {repo}/.worktrees/{name}` as its working directory
- Confirm no other agent is targeting the same worktree
- After merge: `git worktree remove .worktrees/{name}`

**Why worktrees over checkout:** When multiple agents share one working tree and run `git checkout`, they clobber each other's state. Worktrees give each agent an isolated filesystem view of its branch. This eliminates the entire class of "committed to wrong branch" bugs.

### 2. Scope Boundaries in Every Dispatch

Every agent prompt MUST include explicit file-level scope boundaries. State which directories/files the agent MAY touch and which it MUST NOT.

**Template:**
```
## CRITICAL RULES
- Work ONLY on `feature/{name}` branch
- Touch ONLY files in `{directory1}/`, `{directory2}/`
- Do NOT touch `{excluded1}`, `{excluded2}`
```

**Why this matters:** Without explicit boundaries, agents refactor adjacent code "for consistency," leak changes across layers, and create merge conflicts with parallel agents.

### 3. Diagnose Before Dispatching

Never send an agent to fix a large-scope problem blind. First diagnose the scope, then plan work packages, then dispatch targeted agents.

**Pattern:**
1. **Scout** — one small agent or direct tool use to count/categorize the problem
2. **Plan** — coordinator groups findings into work packages by theme or file scope
3. **Execute** — dispatch agents per work package (parallel when no file overlap)

**Anti-pattern:** "Fix all linter warnings" as a single mega-task. Correct: count warnings by category → plan fix groups → dispatch per category.

### 4. Small Focused Agents Beat Mega-Agents

Scope inversely correlates with quality. A focused agent with 5 surgical fixes completes in ~100 seconds with high accuracy. A mega-agent with 50 changes across the codebase takes 30+ minutes and frequently makes mistakes.

**Guidelines:**
- Target 3–7 changes per agent dispatch
- If the task description exceeds ~200 words of instructions, it's too big — split it
- If estimated file count exceeds 15 files, split by layer or module

### 5. Review Gate Before Every Merge

No branch merges to main without a reviewer pass. The reviewer MUST be a separate agent instance (fresh context, no confirmation bias).

**Flow:**
```
Agent implements → Build + test pass → Reviewer agent reviews → Fix findings → Re-review if BLOCKING → Merge
```

**Review-fix cycle:** When the reviewer finds issues, dispatch the **original author** (not the reviewer) to fix them. The reviewer is a critic, not a fixer — they lack the implementation context and may introduce inconsistencies. After the fix commit, the coordinator verifies the fix is clean (correct file count, builds, tests pass) and merges. Only re-dispatch the reviewer if there were BLOCKING findings or structural concerns.

**Reviewer prompt must include:**
- The branch to review and what it should contain
- The full diff or summary of changes (reviewer agents are stateless — don't assume prior context)
- **Explicit worktree path** as the working directory (agents default to CWD, which may be a different repo entirely — e.g., plugin_developer vs squad-federation-server)
- Scope check (verify no out-of-scope files changed)
- Build + test verification commands
- Specific areas to focus on
- Output format: BLOCKING / HIGH / MINOR or APPROVED

### 6. Coordinator Never Writes Code

The coordinator's role is orchestration: planning, dispatching, reviewing findings, making decisions. When the coordinator edits code directly, it bypasses the review gate and often creates more problems than it solves (wrong branch, incomplete fixes, linter violations).

**If a fix seems trivial:** still dispatch an agent. The overhead is 30 seconds. The risk of manual error compounds.

### 7. Parallel Work Requires No File Overlap

Two agents may run in parallel ONLY when their file scopes don't overlap. Before launching parallel agents, verify:

- No shared source files between work packages
- No shared test files (unless read-only)
- Shared configuration files (DI registration, app config, build scripts) are assigned to exactly one agent
- If overlap exists, make the work packages sequential

### 8. Refactors Are High-Risk — Require Use Case Coverage

Refactoring (extracting classes, renaming, restructuring) is the most common source of regressions. Code that "just moves" often drops behavior along the way — error recovery paths, retry logic, fallback flows.

**Before any refactor:**
- Identify all use cases the existing code handles (happy path, error paths, edge cases)
- Ensure each use case has a test BEFORE refactoring
- Run tests before and after — same count, same pass rate

**After refactoring:**
- Verify all error handling was carried over (catch blocks, retries, fallbacks)
- Verify all state transitions survived (status changes, cleanup paths)
- Run integration/E2E tests, not just unit tests — unit tests can pass while the wiring is broken

**Anti-pattern:** Refactoring a God Object into 3 clean classes and losing the retry-on-failure path because it lived in a catch block that wasn't migrated.

### 9. Testing Strategy — Trophy Model

The classic test pyramid (many unit, fewer integration, few E2E) over-indexes on unit tests that often just "test mocks." For API-heavy and service-oriented projects, the **Testing Trophy** gives better ROI:

```
         Acceptance  (few — real stack, UC-driven)
     ┌──────────────────┐
     │   Integration     │  ← Most tests here (real behavior, in-memory infra)
     ├──────────────────┤
     │   Domain logic    │  (pure functions, value objects, entity rules)
     └──────────────────┘
```

#### Three tiers

**Tier 1 — Domain tests (fast, pure logic):**
- Test value objects, entity behavior, invariants, state machines
- No mocks, no DI, no DB — just `new Thing()` and assert
- Only worth writing for non-trivial domain logic. Don't test getters/setters.

**Tier 2 — Integration tests (bulk of tests, in-memory):**
- Test real behavior through the API/tool surface with real DB (in-memory) and mocked external environment
- Use `WebApplicationFactory` or equivalent — real HTTP, real DI, real DB, mocked processes
- Organize by surface area (API endpoints, MCP tools, persistence queries), not by source code structure
- These catch the wiring bugs that unit tests miss: wrong DI registration, missing middleware, broken serialization, FK constraint violations

**Tier 3 — Acceptance tests (few, real stack, UC-driven):**
- Test complete use cases against the real system — real server, real processes, real infrastructure
- Each test maps to one or more use cases by name (e.g., `UC-02: Onboard Team`)
- Use Aspire `DistributedApplicationTestingBuilder`, Testcontainers, or scripted scenarios against a running server
- A use case without acceptance test coverage is **not verified as implemented**
- Run in CI as a separate stage (slower, may need Docker or real services)

**UI tests (optional tier, browser-based):**
- Playwright or similar — tests the portal/frontend through a real browser
- Separate project with its own dependencies
- Run nightly or pre-release, not on every commit

#### Project structure (separate projects per tier)

```
tests/
├── {Project}.Tests/                ← Tier 1 + 2 (fast, in-memory)
│   ├── Domain/                     pure entity/value object logic
│   ├── Api/                        HTTP endpoint integration
│   ├── Mcp/                        MCP tool integration
│   ├── Persistence/                DB query/config integration
│   └── Helpers/                    shared factories, builders
├── {Project}.AcceptanceTests/      ← Tier 3 (real stack, UC-driven)
└── {Project}.Portal.UITests/       ← Playwright (future)
```

`dotnet test` at solution level runs everything. Individual projects can be targeted for speed:
```bash
dotnet test                                    # all tiers
dotnet test tests/{Project}.Tests/             # fast tests only
dotnet test tests/{Project}.AcceptanceTests/   # UC scenarios only
```

#### Rules

- **Integration tests are the default.** When adding a new test, write an integration test unless the behavior is pure domain logic with no dependencies.
- **Don't test mocks.** If a test mocks 3 dependencies and asserts the mock was called, it's testing the mock setup, not behavior. Write an integration test instead.
- **Organize tests by what they test, not by source structure.** Don't mirror `src/Adapters/Api/` in your test tree. Group by surface: Api/, Mcp/, Persistence/.
- **Each acceptance test names the UCs it covers** via comments, traits, or test class name.
- **A use case is not done until it has acceptance test coverage.** Unit + integration tests prove the code works in isolation. Acceptance tests prove the feature works.

#### When to write which

| Event | Write |
|---|---|
| New domain entity/value object with invariants | Domain test |
| New API endpoint or MCP tool | Integration test |
| New use case implemented | Integration test + acceptance test |
| Bug fix | Integration test reproducing the bug |
| Refactoring | Verify existing tests pass before AND after |
| UI feature | UI test (Playwright) |

#### Anti-patterns

- **"277 unit tests passing"** while the actual user flow returns empty responses because a notification handler was silently dropping messages. Integration tests catch this.
- **Testing mocks instead of behavior:** `verify(mock.Save(any()))` tells you nothing about whether Save actually works. Test through the API.
- **Monolith acceptance tests:** One 500-line test that sets up everything, tests everything, and is impossible to debug when it fails. Keep scenarios focused.

#### Alternative testing approaches

The Trophy model is one of several valid approaches. Choose based on your project's characteristics.

**Test Pyramid (Martin Fowler / Google)**
```
        E2E       (few)
     ┌────────┐
     │ Integ. │   (some)
   ┌─┴────────┴─┐
   │    Unit     │ (many)
   └─────────────┘
```
- Most tests are unit tests, fewest are E2E
- Best for: **library code, complex algorithms, domain-heavy systems** where business logic is deep and dependencies are thin
- Weakness: over-mocking in service layers creates tests that pass while the real wiring is broken

**Testing Trophy (Kent C. Dodds)**
```
        E2E (few)
    ┌─────────────┐
    │ Integration  │  ← Most tests here
    ├─────────────┤
    │   Static    │  (types, linting)
    └─────────────┘
```
- Integration tests dominate; unit tests only for complex pure logic
- Best for: **API services, web apps, tool-driven systems** where value is in the wiring between components
- Weakness: slower test suite than pyramid; harder to pinpoint failures to a single unit

**Testing Honeycomb (Spotify)**
```
    ┌── E2E ──┐   (few)
    │ Integr. │   ← Bulk
    └─ Unit ──┘   (few)
```
- Similar to Trophy but explicitly de-emphasizes unit tests
- Best for: **microservices** where each service is small and the contract between services matters more than internal logic
- Weakness: requires good contract/integration test infrastructure

**Testing Diamond (growing middle)**
```
      E2E (few)
   ┌──────────┐
   │ Integr.  │  ← Wide
   └──────────┘
    Unit (few)
```
- Emerged from teams adopting Testcontainers and WebApplicationFactory — the integration tier naturally grows
- Best for: **modern web APIs with good test infrastructure** (WebAppFactory, Docker, Aspire)
- This is what most .NET Aspire projects naturally evolve toward

**Fast/Slow split (pragmatic)**
```
tests/
├── Fast/    ← Everything in-memory (unit + integration)
└── Slow/    ← Everything needing real infra (acceptance, UI, Docker)
```
- Ignores the unit/integration distinction entirely — groups by execution speed
- Best for: **CI optimization** — run Fast/ on every commit, Slow/ nightly
- Weakness: loses the semantic meaning of test tiers; harder to reason about coverage gaps

#### Choosing a testing approach

Use these heuristics to pick the right model for a project:

| If your project has... | Then use... | Because... |
|---|---|---|
| Rich domain logic, few external deps | **Pyramid** | Unit tests give high ROI for pure logic |
| Thin domain, many API/tool surfaces | **Trophy/Diamond** | Integration tests catch wiring bugs that unit tests miss |
| Many microservices, service-to-service contracts | **Honeycomb** | Contract boundaries matter more than internals |
| Mixed — some complex domain, some API glue | **Trophy + domain unit tests** | Integration-first, but carve out domain tests for complex invariants |
| Tight CI budget, slow test infra | **Fast/Slow split** | Optimize for developer feedback speed |
| Frontend-heavy (SPA, portal) | **Trophy + Playwright tier** | Integration for API, Playwright for UI flows |

**Decision flowchart:**
1. Where do bugs actually happen? → Write that tier of test
2. Is the domain complex enough to justify isolated unit tests? → Yes: add Domain tier. No: skip it.
3. Can you run real infra in tests (Docker, in-memory DB)? → Yes: integration-first. No: more unit tests + contract tests.
4. Do you have a UI? → Add Playwright/Cypress as a separate slow tier.
5. Is CI speed critical? → Split fast/slow regardless of test type.

**The right answer can evolve.** Start with what matches your project today. As the codebase grows, the testing strategy should be revisited — a project that starts as Trophy may grow enough domain complexity to justify Pyramid-style unit testing for specific modules.

## Work Package Planning

When a code review or task produces many findings, group them into work packages:

**Grouping criteria:**
- By architectural layer (domain, adapters, infrastructure, tests)
- By file scope (no overlapping files between WPs)
- By dependency (WP2 depends on WP1's domain changes)

**Dependency chain template:**
```
WP1 (quick fixes) → merge
    ↓
WP2 (domain) → merge
    ↓              ↓
WP3 (adapters)  WP4 (infra)  ← parallel if no overlap
    ↓              ↓
   merge          merge
```

**Each WP gets:**
- A dedicated feature branch
- A dedicated agent with scoped instructions
- A dedicated reviewer pass
- Its own merge to main

## Agent Dispatch Template

```
You are **{AgentName}** — developer on the {Project} team.

**Repo:** `{repo_path}`

## CRITICAL RULES
- Work ONLY on `feature/{branch-name}` branch
- Touch ONLY files in `{scope}`
- Do NOT touch `{exclusions}`

## Working directory
cd {repo_path}/.worktrees/{branch-name}
# Worktree created by coordinator — do NOT create branches yourself

## Fixes
### 1. {Fix title} ({Finding ID})
- **File:** `{path}`
- **Fix:** {description}

## Build and test
{build and test commands}
0 warnings, 0 errors, all tests pass.

## Commit
git add -A && git commit -m "{message}"

Do NOT merge — leave on branch for review.
```

## Additional Resources

### Reference Files

For detailed patterns and examples, consult:
- **`references/agent-dispatch-patterns.md`** — Complete dispatch templates for different scenarios (implementation, refactoring, review, hotfix)
- **`references/review-and-merge-patterns.md`** — Reviewer prompt templates, merge conflict handling, finding severity guidelines
