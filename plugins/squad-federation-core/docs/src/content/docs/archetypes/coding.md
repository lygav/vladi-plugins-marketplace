---
title: Coding Archetype
description: Teams that implement features, fix bugs, and modify codebases
---

# Coding Archetype

The **coding** archetype is for teams that write and modify code—implementing features, fixing bugs, refactoring, and writing tests.

## What It Does

Coding teams:
- Analyze existing codebases
- Implement new features
- Fix bugs and issues
- Refactor code
- Write and update tests
- Create pull requests

**Output:** Code changes (commits, pull requests)

## Lifecycle States

```
preparing
  ↓
implementing
  ↓
testing
  ↓
pr-open
  ↓
pr-review
  ↓
pr-approved
  ↓
merged
  ↓
complete

(any state) → failed
(any non-terminal state) → paused
```

| State | Description | Typical Duration |
|-------|-------------|------------------|
| `preparing` | Reading mission, planning work | 2-5 minutes |
| `implementing` | Writing code, making changes | 15-30 minutes |
| `testing` | Running tests, fixing failures | 10-20 minutes |
| `pr-open` | Pull request created, awaiting review | (external) |
| `pr-review` | Addressing review comments | 5-15 minutes |
| `pr-approved` | PR approved by reviewers | (external) |
| `merged` | Changes merged to main branch | <1 minute |
| `complete` | Work finished | (terminal) |
| `failed` | Error occurred | (terminal) |
| `paused` | Manually paused | (indefinite) |

### State Transitions

**preparing → implementing**
- Read mission from inbox signal
- Analyze codebase structure
- Identify files to modify
- Plan implementation approach

**implementing → testing**
- Write or modify code
- Commit changes
- Run test suite

**testing → pr-open**
- All tests pass
- No linting errors
- Build succeeds
- Open pull request

**pr-open → pr-review**
- Reviewers request changes
- Team reads review comments

**pr-review → pr-approved**
- Address all review comments
- Push additional commits
- Re-run tests

**pr-approved → merged**
- Reviewers approve PR
- Merge to main branch

**merged → complete**
- Cleanup temporary files
- Write deliverable summary

**(any state) → failed**
- Build fails and cannot be fixed
- Tests fail repeatedly
- Critical error prevents progress

## Skills

Coding teams have access to domain-specific skills in `.squad/skills/`:

1. **git-workflow.md** — Git conventions (branching, commits, PRs)
2. **testing-standards.md** — Test coverage requirements, naming conventions
3. **code-review.md** — Review checklist, merge criteria

### Example Skill: Git Workflow

```markdown
---
tags: [git, workflow, conventions]
category: convention
---

# Git Workflow

## Branching

- Feature branches: `squad/{domain}/{feature}`
- Never commit to `main` directly

## Commits

- Use conventional commits: `feat:`, `fix:`, `refactor:`
- Keep commits focused (one logical change)
- Write descriptive messages

## Pull Requests

- Link to issue or signal
- Include description of changes
- Add attribution: `Co-authored-by: {TeamName} (Squad) <noreply@squad.ai>`
```

Teams automatically read these skills when performing related work.

## Agent Configuration

### Lead Agent

**Role:** Primary developer and implementer

**Model:** `claude-sonnet-4`

**Temperature:** `0.1` (low, precise execution)

**Tools:** `bash`, `edit`, `view`, `grep`, `glob`

**Responsibilities:**
- Scan codebase for relevant files
- Implement features or fixes
- Run tests and linting
- Create pull requests
- Address review feedback

## Typical Workflow

### Phase 1: Preparing

1. Team receives signal: "Implement password reset flow"
2. Agent scans codebase for auth-related files
3. Identifies where changes are needed:
   - `src/auth/AuthService.ts`
   - `src/api/routes/auth.ts`
   - `src/auth/AuthService.test.ts`
4. Creates implementation plan
5. Transitions to `implementing`

### Phase 2: Implementing

1. Agent writes new code:
   - Adds `requestPasswordReset()` method
   - Adds `/auth/reset-request` endpoint
   - Adds `/auth/reset-password` endpoint
2. Commits changes with message: `feat: add password reset flow`
3. Transitions to `testing`

### Phase 3: Testing

1. Agent runs test suite: `npm test`
2. Sees 2 failing tests (new endpoints not tested)
3. Writes tests:
   - `src/auth/AuthService.test.ts` — Unit tests
4. Re-runs tests — all pass
5. Runs linting: `npm run lint` — no errors
6. Transitions to `pr-open`

### Phase 4: PR Open

1. Agent creates pull request:
   - Title: "feat: add password reset flow"
   - Description: Links to signal, lists changes
   - Attribution: `Co-authored-by: Backend Team (Squad) <noreply@squad.ai>`
2. Waits for external review
3. When review comments arrive, transitions to `pr-review`

### Phase 5: PR Review

1. Agent reads review feedback:
   - "Add rate limiting to reset endpoints"
   - "Use bcrypt for token hashing"
2. Implements requested changes
3. Commits: `fix: add rate limiting and bcrypt hashing`
4. Pushes to PR branch
5. Transitions to `pr-approved`

### Phase 6: Merged → Complete

1. Reviewers approve PR
2. Agent merges to `main`
3. Writes deliverable summary
4. Transitions to `complete`

## Deliverable Format

Coding teams produce `deliverable.md` with:

1. **Summary** — High-level overview
2. **Changes Made** — List of modified files
3. **Testing** — Test results and coverage
4. **Next Steps** — Follow-up actions (if any)

**Example:**

```markdown
# Password Reset Implementation

## Summary

Implemented JWT-based password reset flow with email token delivery, rate limiting, and rollback validation.

## Changes Made

1. **src/auth/AuthService.ts**
   - Added `requestPasswordReset(email)` method
   - Added `resetPassword(token, newPassword)` method
   - Implemented token generation and validation

2. **src/api/routes/auth.ts**
   - Added POST `/auth/reset-request` endpoint
   - Added POST `/auth/reset-password` endpoint
   - Applied rate limiting (5 requests per 15 min)

3. **src/auth/AuthService.test.ts**
   - Added unit tests for password reset methods
   - Added tests for token expiration (1 hour)
   - Added tests for rate limiting

## Testing

- ✅ Unit tests: 45/45 passing
- ✅ Integration tests: 12/12 passing
- ✅ No linting errors
- ✅ Build succeeds

## Pull Request

PR #123: https://github.com/repo/pull/123

**Reviewers:** Alice, Bob

**Status:** Merged to main

## Next Steps

1. Update API documentation with new endpoints
2. Create email templates for reset notifications
3. Monitor reset endpoint usage in production
```

## Common Use Cases

### Feature Implementation

**Mission:** "Implement password reset flow"

**States:** `preparing → implementing → testing → pr-open → pr-review → pr-approved → merged → complete`

**Duration:** 1-2 hours

**Output:**
- New endpoints and methods
- Unit and integration tests
- Pull request merged to main

---

### Bug Fix

**Mission:** "Fix logout redirect issue"

**States:** `preparing → implementing → testing → pr-open → pr-approved → merged → complete`

**Duration:** 30-60 minutes

**Output:**
- Fixed redirect logic
- Updated existing test
- Hotfix PR merged

---

### Refactoring

**Mission:** "Extract auth logic into custom hook"

**States:** `preparing → implementing → testing → pr-open → pr-review → pr-approved → merged → complete`

**Duration:** 1-2 hours

**Output:**
- New `useAuth.ts` hook
- Refactored components to use hook
- Tests updated for new structure

## Best Practices

### Clear Missions

✅ **Good:** "Implement login form with email/password validation and error handling"

❌ **Bad:** "Do auth stuff"

### Scoped Work

Keep missions focused:
- One feature per team
- Avoid multi-step epics
- Break large tasks into smaller teams

### Test Coverage

Encourage testing in mission:

"Implement password reset flow **with full test coverage and integration tests**"

### Learning Capture

Teams automatically log discoveries to `.squad/signals/learnings.jsonl`:

```json
{
  "id": "learning-abc123",
  "timestamp": "2025-01-30T12:00:00Z",
  "domain": "backend-api",
  "category": "pattern",
  "content": "Rate limiting should apply per-IP, not per-user (unauthenticated endpoints)",
  "tags": ["rate-limiting", "security", "auth"],
  "confidence": "high",
  "context": "Implemented reset-request endpoint"
}
```

These learnings can be graduated to skills for future teams.

## Monitoring

Coding teams emit telemetry (when enabled):

- `code.files_changed` — Files modified count
- `code.test_count` — Tests written/updated
- `code.build_success` — Build status (boolean)
- `code.pr_number` — Pull request number

**Health checks:**
- Status updated within 10 minutes
- Tests passing in latest commit
- No unhandled errors in logs

## Next Steps

- [View deliverable archetype](/vladi-plugins-marketplace/archetypes/deliverable)
- [View consultant archetype](/vladi-plugins-marketplace/archetypes/consultant)
- [Create custom archetypes](/vladi-plugins-marketplace/archetypes/creating-archetypes)
