---
title: Coding Archetype
description: Teams that write and modify code
---

# Coding Archetype

The **coding** archetype is designed for teams that implement features, fix bugs, and modify codebases.

## Purpose

Coding teams:
- Analyze existing code
- Implement new features
- Fix bugs and issues
- Refactor code
- Write tests

**Output:** Code changes (commits, pull requests)

## States

```
initializing
    ↓
scanning ←→ paused
    ↓
distilling ←→ paused
    ↓
complete (✓)

(any state) → failed (✗)
```

| State | Description | Duration |
|-------|-------------|----------|
| `initializing` | Setting up workspace | <1min |
| `scanning` | Analyzing codebase, finding relevant files | 5-15min |
| `distilling` | Processing findings, implementing changes | 10-30min |
| `complete` | Work finished, deliverable ready | (terminal) |
| `failed` | Error occurred | (terminal) |
| `paused` | Manually paused | (indefinite) |

## Agents

### Lead Agent

**Role:** Primary architect and planner

**Responsibilities:**
- Scan codebase for relevant files
- Create plan of attack
- Implement high-level changes
- Coordinate with assistant agents
- Review and integrate results

**Tools:** `bash`, `edit`, `view`, `grep`, `glob`

**Temperature:** 0.1 (low, precise)

### Assistant Agent (Future)

**Role:** Execute specific sub-tasks

**Responsibilities:**
- Implement individual functions
- Write tests
- Fix isolated bugs
- Follow lead's plan

**Tools:** `bash`, `edit`, `view`

**Temperature:** 0.2

## Skills

Coding teams have access to:

1. **git-workflow.md** - Git conventions (branching, commits)
2. **testing-standards.md** - Test coverage requirements
3. **code-review.md** - Review checklist

### Example: Git Workflow

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

- Link to issue
- Include description
- Add attribution: `Co-authored-by: Kaylee (Squad) <noreply@squad.ai>`
```

## Typical Workflow

### Phase 1: Initialization (30s)

1. Team workspace created
2. Archetype files copied
3. `.squad/` directory initialized
4. Status set to `initializing`

### Phase 2: Scanning (5-15min)

1. Lead agent reads mission from signal
2. Searches codebase for relevant files
3. Analyzes dependencies and structure
4. Creates high-level plan
5. Logs findings to learning log
6. Updates status: `state: "scanning", progress_pct: 30`

**Example findings:**

```json
{
  "timestamp": "2025-01-30T12:00:00Z",
  "domain": "frontend",
  "category": "discovery",
  "content": "Authentication flow uses JWT tokens stored in localStorage",
  "tags": ["auth", "frontend"],
  "context": "Found in src/auth/AuthContext.tsx"
}
```

### Phase 3: Distilling (10-30min)

1. Lead agent implements changes
2. Writes/modifies code files
3. Runs tests
4. Commits changes
5. Creates deliverable summary
6. Updates status: `state: "distilling", progress_pct: 75`

**Example deliverable.md:**

```markdown
# Frontend Auth Implementation

## Changes Made

1. **src/auth/LoginForm.tsx** - Added form validation
2. **src/auth/AuthContext.tsx** - Fixed token refresh logic
3. **src/auth/LoginForm.test.tsx** - Added test coverage

## Testing

- ✅ All tests pass (45/45)
- ✅ No linting errors
- ✅ Build succeeds

## Next Steps

- Review changes in PR
- Merge to main
```

### Phase 4: Complete (terminal)

1. Status set to `complete`
2. Deliverable available at `deliverable.md`
3. Team session can be stopped

## Deliverable Format

Coding teams produce `deliverable.md` with:

1. **Summary** - High-level overview
2. **Changes Made** - List of modified files
3. **Testing** - Test results
4. **Next Steps** - Follow-up actions

**Example:**

```markdown
# Authentication Module Refactor

## Summary
Refactored login flow to use httpOnly cookies instead of localStorage for security.

## Changes Made

1. **src/auth/AuthContext.tsx**
   - Changed token storage from localStorage to httpOnly cookies
   - Updated login/logout logic
   - Added CSRF protection

2. **src/api/client.ts**
   - Added credentials: 'include' to fetch calls
   - Removed manual Authorization header

3. **src/auth/LoginForm.test.tsx**
   - Updated tests for cookie-based auth
   - Added CSRF token validation tests

## Testing

- ✅ Unit tests: 32/32 passing
- ✅ Integration tests: 8/8 passing
- ✅ Manual testing: Login/logout works
- ✅ No linting errors
- ✅ Build succeeds

## Learnings

- httpOnly cookies prevent XSS token theft
- CSRF tokens required for cookie-based auth
- SameSite=Strict prevents CSRF attacks

## Next Steps

1. Deploy to staging
2. Test with real users
3. Update documentation
```

## Monitoring

Coding teams emit metrics:

- `code.files_changed` - Files modified
- `code.test_count` - Tests written/updated
- `code.build_success` - Build status

**Health checks:**

- Test coverage > 50% of changed files
- Build passes
- No linting errors
- Status updated within 10 minutes

## Common Use Cases

### Feature Implementation

**Mission:** "Implement password reset flow"

**States:** `initializing → scanning → distilling → complete`

**Output:**
- New files: `src/auth/PasswordReset.tsx`, `src/auth/PasswordReset.test.tsx`
- Modified: `src/api/auth.ts`
- Tests: 5 new tests
- Deliverable: Summary + next steps

### Bug Fix

**Mission:** "Fix logout redirect issue"

**States:** `initializing → scanning → distilling → complete`

**Output:**
- Modified: `src/auth/AuthContext.tsx`
- Tests: Updated existing test
- Deliverable: Root cause + fix description

### Refactoring

**Mission:** "Extract auth logic into custom hook"

**States:** `initializing → scanning → distilling → complete`

**Output:**
- New file: `src/hooks/useAuth.ts`
- Modified: `src/auth/AuthContext.tsx`, `src/components/LoginForm.tsx`
- Tests: Refactored tests to use hook
- Deliverable: Migration guide

## Tips

### Clear Missions

✅ **Good:** "Implement login form with email/password validation"

❌ **Bad:** "Do auth stuff"

### Scope Control

Keep missions focused:
- One feature per team
- Avoid multi-step epics
- Break large tasks into smaller teams

### Test Coverage

Encourage testing in mission:

"Implement password reset flow **with full test coverage**"

### Learning Capture

Teams automatically log discoveries:
- Patterns found
- Conventions used
- Gotchas encountered

## Next Steps

- [View deliverable archetype](/archetypes/deliverable)
- [View consultant archetype](/archetypes/consultant)
- [Create custom archetypes](/archetypes/creating-archetypes)
