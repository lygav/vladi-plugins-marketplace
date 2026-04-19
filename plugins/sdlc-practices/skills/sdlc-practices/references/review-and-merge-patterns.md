# Review and Merge Patterns

## Reviewer Dispatch Template

```
You are **{ReviewerName}** — Lead/Reviewer on the {Project} team.

**Repo:** `{path}`
**Branch:** `feature/{branch}` (diff against `main`)

## Context
{Brief description of what the branch contains and why}

## Scope Check
This branch should ONLY touch:
- {file/directory list}

It should NOT touch:
- {exclusion list}

If out-of-scope files are in the diff, it's a BLOCKING scope violation.

## Review Steps
cd {path}
git checkout feature/{branch}
git diff main --stat
git diff main
{build command} 2>&1 | tail -5
{test command} 2>&1 | tail -15

Verify:
1. {Specific check 1}
2. {Specific check 2}
3. No behavioral changes beyond intended fixes
4. Build clean, all tests pass

## Output
Report as BLOCKING/HIGH/MINOR or "APPROVED — no blockers found."
```

## Finding Severity Guidelines

### BLOCKING — Must fix before merge
- Build broken
- Tests failing
- Scope violation (out-of-scope files modified)
- Data integrity bugs (wrong values persisted)
- Security issues (credentials exposed, injection vectors)
- Dependency inversion violations

### HIGH — Should fix before merge
- Code duplication introduced
- Missing error handling on critical paths
- Race conditions or concurrency bugs
- Missing input validation
- Performance regressions (N+1 queries, unbounded loops)
- Incorrect abstractions that will spread

### MINOR — Nice to have, can merge without
- Naming improvements
- Extra blank lines or formatting
- Redundant comments
- Minor inefficiencies
- Style preferences not covered by linters

## Review Focus Areas by Change Type

### For Refactoring PRs
1. **No behavioral changes** — same inputs must produce same outputs
2. **Test count preserved** — no tests should disappear
3. **Scope check** — only files related to the refactor touched
4. **Naming consistency** — new names follow existing conventions

### For Bug Fix PRs
1. **Root cause addressed** — not just symptoms
2. **Test added** — reproduces the bug, passes after fix
3. **No regressions** — existing tests still pass
4. **Minimal change** — surgical fix, not refactoring in disguise

### For Feature PRs
1. **Matches requirements** — does what was asked
2. **Error handling** — unhappy paths covered
3. **Tests added** — unit + integration as appropriate
4. **Wiring** — new services/modules registered correctly
5. **No hardcoded values** — configuration used where appropriate

### For Code Quality PRs (linting, formatting)
1. **Purely cosmetic** — no logic changes snuck in
2. **All warnings resolved** — not suppressed
3. **Suppressions justified** — only for genuinely controversial rules
4. **Tests still pass** — cosmetic changes can break string comparisons

## Merge Patterns

### Clean Merge (no conflicts expected)
```bash
git checkout main
git merge feature/{branch} --no-ff -m "{message}

Reviewed by {Reviewer} — APPROVED.

Co-authored-by: {agent-attribution}"
git branch -d feature/{branch}
```

### Merge with Conflicts
Dispatch an agent to handle the merge — do not resolve manually. Provide explicit resolution strategies per file.

### Sequential Merges (dependent WPs)
```
WP1 merge → WP2 branch from updated main → WP2 merge → ...
```
Each WP branches from the latest main to minimize conflicts.

### Parallel Merges (independent WPs)
Merge in any order. If the second merge has conflicts from the first, dispatch an agent to resolve.

## Post-Merge Verification

After every merge to main:
```bash
{build command}
{test command}
```

If build or tests fail after merge, the merge introduced a regression. Options:
1. Dispatch agent to fix on main (small fix)
2. Revert the merge and re-do (large breakage)

## Review Iteration Protocol

When reviewer finds issues:

1. **BLOCKING found** → dispatch agent to fix on same branch → re-review
2. **HIGH found** → dispatch agent to fix on same branch → re-review (focused on fixes only)
3. **MINOR only** → merge as-is, note for future cleanup
4. **APPROVED** → merge immediately

Re-review prompts should reference the previous findings:
```
## Previous findings that were fixed:
- B1: {description} — verify fixed
- H1: {description} — verify fixed

Focus on verifying these fixes. Also check no new issues introduced.
```

## Code Review Parallelization

For large codebases, split reviews by module/layer:

```
Launch 4 parallel reviewers:
- Reviewer 1: Domain layer (entities, value objects, ports)
- Reviewer 2: Adapter layer (MCP tools, API endpoints)
- Reviewer 3: Infrastructure layer (persistence, external services)
- Reviewer 4: Test suite (coverage, quality, isolation)
```

**Benefits:**
- 4× faster than serial review
- Each reviewer has focused context
- Findings naturally group by layer

**Consolidation:** Coordinator collects all findings, deduplicates, and plans fix work packages.
