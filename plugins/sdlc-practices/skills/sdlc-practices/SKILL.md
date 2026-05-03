---
name: sdlc-practices
description: This skill should be used when the user asks to "plan work", "dispatch agents", "create a feature branch", "launch parallel tasks", "review code", "merge branches", "break down a task", "run code review", "design to implementation", "implementation checkpoint", "verify before implementing", "scout codebase", "DDD language", "ubiquitous language", or when coordinating multi-agent development workflows. Provides battle-tested SDLC rules for AI agent team coordination including branch isolation, task decomposition, review gates, and dispatch patterns.
version: 0.5.0
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

### 10. Use Constants for Domain Identifiers

Hard-coded string identifiers for domain concepts (status enums, message types, workflow state names, role names) scatter magic strings across the codebase and make refactoring dangerous. Any typo breaks silently at runtime. Domain identifiers MUST be constants defined in a single, well-known location.

**Pattern:**

```csharp
// Domain Constants
public static class TeamStatus
{
    public const string Active = "active";
    public const string Paused = "paused";
    public const string Retired = "retired";
}

public static class WorkflowStates
{
    public const string Initialized = "initialized";
    public const string InProgress = "in_progress";
    public const string Completed = "completed";
}

// Usage — always via constant, never string literals
if (team.Status == TeamStatus.Active)
{
    // ...
}
```

**Benefits:**
- **IDE support** — IntelliSense shows available identifiers
- **Refactor safety** — rename one constant, compile error catches all usages
- **Consistency** — no spelling variations ("active" vs "Active" vs "ACTIVE")
- **Testability** — tests can use `TeamStatus.Active` instead of magic strings
- **Documentation** — the constant location serves as a single source of truth

**Anti-pattern:** Comparing against string literals scattered in business logic, tests, and data access layers. This makes it impossible to know which variants exist or if a string is valid.

### 11. Thin Adapters — Parse, Delegate, Format

Adapters (REST endpoints, MCP tools) must NEVER contain business logic, DB access, or multi-step orchestration. Each handler: parse transport input → make ONE application service call → format response.

**Why:** When the same operation exists in multiple adapters (REST + MCP), business logic diverges silently. Real example: REST Pause/Retire didn't destroy sessions, MCP did — creating zombie sessions.

**Pattern:**
```csharp
// GOOD: thin adapter — one service call
private static async Task<IResult> PauseTeam(Guid teamId, TeamService teams, CancellationToken ct)
{
    var result = await teams.PauseAsync(teamId, ct);
    return result.Success ? Results.Ok(result.Value) : result.ToHttpResult();
}

// BAD: fat adapter — DB access, orchestration, business rules
private static async Task<IResult> PauseTeam(Guid teamId, AppDbContext db, ISessionPort sessionPort)
{
    var team = await db.Teams.FindAsync(teamId);
    if (team.Status != Ready) return Results.BadRequest(...);
    team.Pause();
    await db.SaveChangesAsync();  // Missing session destroy!
    return Results.Ok(new { ... });
}
```

**Verification:** `grep -n "AppDbContext" Adapters/` should return 0 hits. Every adapter method should have exactly one `await service.*Async()` call.

### 12. Test-First for Regressions

When a review finds a bug or regression, ALWAYS write a failing test first, then fix the code. Don't fix and hope — prove the regression exists, then prove it's fixed.

**Why:** Prevents the same class of bug from recurring. Real example: service extraction introduced 4 regressions (B1-B4) — tests caught them permanently.

### 13. Don't Mask Failures with Skip Guards

When tests fail, diagnose the root cause. Don't add skip guards that silence the failure. Real example: acceptance tests failed after migration squash — a skip guard hid the real bug (stale SQLite DB). Removing the guard and fixing the DB was the correct approach.

### 14. Move Initialization to Write-Time

Expensive initialization (process start, session creation, model selection) should happen at creation/setup time, not at first-use time. Users tolerate slow setup but not slow first interaction.

**Pattern:** Pre-warm sessions at team onboarding (latency-tolerant) so prompts always hit the fast path. Failure to warm up is non-fatal — first prompt falls back to the slow path.

## Design-to-Implementation Bridge

This section bridges the gap between the architecture design process (brainstorm → vision → use cases → design → review) and the implementation phase covered by the rest of this skill. Before writing any implementation code, verify that the design foundation is complete and then scout the codebase to plan your implementation work packages.

### 1. SDLC Checkpoint — Verify Before Implementing

Before writing any implementation code, verify the design process is complete. Don't skip ahead to coding when the design is still in flux — it creates rework, inconsistencies, and scope creep.

**Pre-implementation checklist:**
- ✅ **Use cases written** (pure behavior, no implementation details) — every user journey is documented
- ✅ **Design docs done** (concepts, contracts, invariants — no code) — architecture is defined across all layers
- ✅ **Architecture review passed** (consistency, traceability, feasibility) — design has been validated
- ✅ **Test plan exists** (scenarios mapped to use cases) — acceptance criteria are clear
- ➡️ **NOW: implement**

If any checkpoint is missing, go back. Don't implement against incomplete design. Half-finished use cases lead to missing error paths. Unreviewed design docs lead to layer violations and architectural drift. A test plan created after implementation is just documentation of what you already built, not a quality gate.

**Why this matters:** The design phase forces you to think through edge cases, error handling, state transitions, and cross-component contracts BEFORE committing to code. Skipping straight to implementation means discovering these issues late, when they're expensive to fix and require rework across multiple layers.

### 2. Scout Before Dispatching (expanded from existing rule #3)

The existing "Diagnose Before Dispatching" rule (#3 in Core Rules) introduces this concept but focuses on problem diagnosis. Here we expand it into a full implementation scouting procedure that bridges design to code.

Before dispatching implementation work packages, scout the codebase to understand what exists, what patterns to follow, and how to structure the work. This is the transition from "what to build" (design) to "how to build it" (implementation plan).

**Full scouting procedure:**

**a. Read the design doc** — Understand what needs to be built. Review the layer-by-layer design (core contracts, workflows, adapters, infrastructure). Identify the key concepts, ports, and invariants defined in the design.

**b. Scan the codebase** — Find existing patterns, interfaces, and registration points. Look for:
- Similar features already implemented (copy the pattern)
- Dependency injection registration (where new services get wired)
- Existing ports/adapters (interfaces to implement)
- Testing conventions (structure, naming, factories)
- Configuration patterns (appsettings, options classes)
- Middleware or pipeline registration points
- Database migration patterns

**c. Map the implementation** — For each design concept, identify the concrete work:
- **New files/classes to create** — entities, value objects, ports, adapters, workflows, handlers
- **Existing files to modify** — DI registration, app startup, config files, migration scripts
- **Dependencies** — what must be built first (e.g., domain entities before workflows, workflows before adapters)
- **File overlaps** — which changes touch the same files (blocks parallelization)

**d. Produce work packages** — Group changes into focused, isolated units:
- Group by architectural layer (domain → application → adapters → infrastructure)
- Target 3-7 changes per work package
- No file overlap between parallel work packages
- Shared files (DI, config, migrations) assigned to exactly one work package
- Each package has clear entry/exit criteria

**e. Identify the critical path** — Determine sequencing and parallelization:
- Which work packages block others (dependencies)
- Which can run in parallel (no file overlap, no functional dependencies)
- Where the risk is highest (complex workflows, cross-cutting changes, database schema)
- Which packages need senior review vs junior review

**Example mapping:**
```
Design doc: "User authentication with JWT tokens"

Scout findings:
- Existing: PasswordHasher class, IUserRepository port
- Missing: JWT service, login endpoint, auth middleware
- Patterns: API endpoints in Adapters/Api/, DI in Program.cs

Work packages:
WP1 (domain): Add User.VerifyPassword() method [1 file]
WP2 (application): Create JwtTokenService [2 files: interface + impl]
WP3 (adapters): Add POST /auth/login endpoint [1 file]
WP4 (infrastructure): Register services in DI [1 file: Program.cs]
WP5 (tests): Integration tests for login flow [3 files]

Dependencies: WP1 → WP2 → WP3 → WP4
Parallel: WP5 can start after WP3 (doesn't block deployment)
```

**Output:** A concrete implementation plan with sequenced work packages ready for dispatch. Each package has a clear scope, explicit file boundaries, and known dependencies.

### 3. Architecture Design Process Reference

This skill (sdlc-practices) focuses on the implementation and delivery phase of software development — branch isolation, work decomposition, review gates, testing, and merge discipline.

For the **full design process** (brainstorm → vision → use cases → layered design → review gate), see the **architecture-design-process** skill. That process produces the design artifacts that feed into this implementation workflow.

**The handoff point:** The architecture design process ends with a reviewed, complete set of design documents and use cases. This implementation workflow begins with the "SDLC Checkpoint" (see section 1 above) to verify that handoff is complete before coding starts.

### 4. DDD Language Discipline

Domain-Driven Design requires **ubiquitous language** — consistent terminology across ALL artifacts: use cases, design docs, code, tests, documentation, and team communication. Language inconsistencies create misunderstandings, duplicate concepts, and fragmented mental models.

**Core rules:**

**Consistency is mandatory:**
- The same concept must use the same name everywhere
- Use cases establish the vocabulary — design and code must match
- If a term appears in use cases but has a different name in code, fix it immediately
- Don't allow synonyms (e.g., "user" and "account" for the same thing)

**Naming should be easy and expressive:**
- Domain terms should flow naturally when reading code aloud
- If you struggle to name something, the concept may not be well-defined — go back to design
- Avoid ambiguous generic names (Manager, Handler, Service, Helper) — be specific
- Value objects and entities should have names that reveal their role and invariants

**Different meanings = different contexts:**
- If the same word means different things in different parts of the system, you have **separate bounded contexts** — make it explicit
- Example: "Order" in e-commerce context (purchase order) vs "Order" in fulfillment context (shipment order) — these are different aggregates in different contexts
- Don't try to unify them — embrace context boundaries and use different names or namespace them

**When language inconsistencies are found:**
- Fix them immediately before they spread through tests, docs, and team vocabulary
- Rename across all artifacts in one atomic change (code + tests + design docs)
- Update the use cases if the inconsistency reveals a better term
- Refactoring tools (IDE rename, grep-and-replace) are your friend — use them

**Anti-patterns:**
- "It's just naming, we'll fix it later" — naming IS design. Bad names reflect fuzzy thinking.
- Using database column names in the domain (e.g., `user_id` instead of `UserId` in C#)
- Technical terms leaking into domain language (e.g., `OrderDTO`, `UserEntity`)
- Different teams using different terms for the same concept

### 5. Iterate on Implementation Too

Code quality requires iteration. Don't accept first implementation drafts — review, fix, re-review. The same discipline applied to use cases and design docs (3-4 review cycles minimum) applies to implementation.

**Review cycle process:**

**1. Initial implementation** — Agent implements the work package, runs build + tests, commits to feature branch.

**2. First review** — Dedicated reviewer agent (fresh context, no confirmation bias) checks:
- Scope compliance (only touched in-scope files)
- Design adherence (matches design doc contracts)
- Language consistency (uses ubiquitous language from use cases)
- Test coverage (scenarios match use case alternative paths)
- Code quality (no obvious bugs, clear logic, appropriate patterns)
- Build + test pass

**3. Fix findings** — If blockers found, dispatch the **ORIGINAL AUTHOR** to fix (not the reviewer). The reviewer is a critic, not a fixer — they lack implementation context and may introduce inconsistencies.

**Why the original author fixes:**
- They have the full context of why choices were made
- They know the intended design and can fix without breaking it
- The reviewer's job is to identify problems, not solve them
- Letting reviewers fix creates "fix-the-fix" cycles and muddy ownership

**4. Re-review after fixes** — Focused on fixed items only:
- Verify the fix addresses the finding
- Verify no new issues were introduced
- Don't re-review unchanged code (wastes time)
- For trivial fixes (formatting, obvious bugs), coordinator can verify and merge
- For structural fixes or BLOCKING findings, re-dispatch the reviewer

**5. Merge when clean** — All tests pass, all blockers addressed, scope clean, design match confirmed.

**Expected cycle count:**
- Trivial changes (docs, config): 1 review cycle
- Straightforward features (following existing patterns): 2 review cycles
- Non-trivial features (new patterns, cross-layer changes): 2-3 review cycles
- Refactors or architectural changes: 3+ review cycles

**Anti-patterns:**
- Accepting first drafts because "it works" — working code isn't necessarily good code
- Reviewer fixes issues instead of author — creates ownership confusion and context loss
- Skipping re-review after BLOCKING findings — assumes the fix is correct without verification
- Re-reviewing unchanged code — wastes reviewer time and slows feedback
- Mega-reviews of 50+ file changes — split into smaller work packages instead

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
