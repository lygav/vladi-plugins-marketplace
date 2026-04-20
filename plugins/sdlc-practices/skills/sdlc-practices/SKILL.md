---
name: sdlc-practices
description: This skill should be used when the user asks to "plan work", "dispatch agents", "create a feature branch", "launch parallel tasks", "review code", "merge branches", "break down a task", "run code review", or when coordinating multi-agent development workflows. Provides battle-tested SDLC rules for AI agent team coordination including branch isolation, task decomposition, review gates, and dispatch patterns.
version: 0.1.0
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

**Reviewer prompt must include:**
- The branch to review and what it should contain
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

## Step 1: Create YOUR branch
git checkout main && git pull && git checkout -b feature/{branch-name}

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
