# Agent Dispatch Patterns

## Pattern 1: Implementation Task

Agent creates new code or modifies existing code to implement a feature or fix.

```
You are **{Name}** — developer on the {Project} team.

**Worktree:** `{path}/.worktrees/{branch}`

## CRITICAL RULES
- Work ONLY in your worktree directory: `{path}/.worktrees/{branch}`
- Touch ONLY files in `{directories}`
- Do NOT touch `{exclusions}`

## Step 1: Verify worktree
cd {path}/.worktrees/{branch}
git branch --show-current  # should show feature/{branch}

## Task
{Detailed description of what to implement}

### Fix 1: {Title}
- **File:** `{path}`
- **What:** {description}
- **How:** {specific guidance}

### Fix 2: {Title}
...

## Build and test
{build command} 2>&1 | tail -5
{test command} 2>&1 | tail -15
Must be 0 warnings, 0 errors, all tests pass.

## Commit
git add -A
git commit -m "{conventional commit message}

Co-authored-by: {agent-attribution}"

Do NOT merge — leave on branch for review.
```

**Key elements:**
- Explicit branch creation from main
- File scope boundaries (ONLY/DO NOT touch)
- Numbered fixes with file paths
- Build + test verification
- No merge instruction

## Pattern 2: Refactoring Task

Agent restructures code without changing behavior. Higher risk — needs extra guardrails.

```
You are **{Name}** — developer on the {Project} team.

**Repo:** `{path}`

## CRITICAL RULES
- Work ONLY on `feature/{branch}` branch
- Touch ONLY files in `{directories}`
- Do NOT touch `{exclusions}`
- This is a REFACTOR — no behavioral changes allowed

## Context
{Why this refactor is needed — what's wrong with current structure}

## Target Structure
{Describe the desired end state}

## Steps
1. {Step 1 — create new files/classes}
2. {Step 2 — migrate logic}
3. {Step 3 — update references}
4. {Step 4 — delete old files}
5. {Step 5 — update wiring/configuration}

## Verification
- Build: 0 warnings, 0 errors
- Tests: all pass (same count as before — no tests should be removed)
- No behavioral changes — same inputs produce same outputs

## Commit
...
```

**Key elements:**
- Explicit "no behavioral changes" rule
- Target structure described before steps
- Test count preservation check

## Pattern 3: Bug Investigation

Agent investigates a problem without fixing it. Returns findings.

```
Investigate a bug in {Project} at `{path}`.

## The Bug
{Error message, stack trace, reproduction steps}

## Files to Read
1. `{file1}` — {what to look for}
2. `{file2}` — {what to look for}

## What to Investigate
1. {Hypothesis 1}
2. {Hypothesis 2}
3. {Hypothesis 3}

Report findings with exact code snippets and line numbers.
Do NOT make any changes — investigation only.
```

**Key elements:**
- Read-only — no code changes
- Specific files to examine
- Hypotheses to test
- Structured output expected

## Pattern 4: Parallel Work Packages

When dispatching multiple agents simultaneously, each must have zero file overlap.

**Pre-dispatch checklist:**
```
WP-A scope: Infrastructure/Acp/, Domain/Ports/IAcpClient*
WP-B scope: Adapters/Mcp/, Application/
Overlap check: NONE ✅ — safe to parallelize
```

**Each agent prompt includes:**
```
## CRITICAL RULES
- You work ONLY on `feature/{wp-a-branch}` branch
- You touch ONLY files in `{wp-a-directories}`
- Do NOT touch `{wp-b-directories}` — those belong to a different work package on a different branch
```

## Pattern 5: Merge with Expected Conflicts

When a branch was created before another WP merged, conflicts may occur.

```
You are **{Name}** — developer on the {Project} team.

## Task
Merge `feature/{branch}` into `main`. {Other WP} was merged after this branch was created, so there WILL be merge conflicts.

## Steps
1. git checkout main && git merge feature/{branch} --no-ff -m "{message}"
2. If conflicts:
   - **{file1}**: {resolution strategy — keep both / keep main / keep branch}
   - **{file2}**: {resolution strategy}
3. Build and test after resolution
4. git add -A && git commit --no-edit
5. git branch -d feature/{branch}

## IMPORTANT
- Keep ALL changes from both work packages
- Do NOT drop any changes during conflict resolution
- Build must be clean, all tests must pass
```

## Anti-Patterns to Avoid

### ❌ Mega-Task Dispatch
```
Fix all warnings, refactor the architecture, add tests, and update docs.
```
**Why bad:** 50+ files, 30+ minutes, high error rate, impossible to review.

### ❌ Missing Scope Boundaries
```
Fix the code review findings on the adapter layer.
```
**Why bad:** Agent may touch infrastructure files "for consistency."

### ❌ Shared Branch
```
Both of you work on feature/cleanup.
```
**Why bad:** Commit interleaving, impossible to review separately, one agent's failure blocks the other.

### ❌ Coordinator Fixing "Just One Thing"
```
*manually edits a file instead of dispatching*
```
**Why bad:** Bypasses review gate, often wrong branch, creates dirty working tree that blocks agent dispatches.
