---
title: Consultant Archetype
description: Read-only code review teams that analyze and provide feedback
---

# Consultant Archetype

The **consultant** archetype is for teams that perform code reviews and provide feedback—**without modifying code**.

## What It Does

Consultant teams:
- Review code changes
- Identify bugs and security issues
- Suggest improvements
- Provide design feedback
- Document findings

**Output:** Code review reports with actionable feedback

**Constraint:** Consultant teams **never modify code**. They read, analyze, and report only.

## Lifecycle States

```
onboarding
  ↓
indexing
  ↓
ready
  ↓
researching
  ↓
waiting-for-feedback
  ↓
retired

(any state) → failed
(any non-terminal state) → paused
```

| State | Description | Typical Duration |
|-------|-------------|------------------|
| `onboarding` | Reading mission, understanding review scope | 2-3 minutes |
| `indexing` | Building codebase index, identifying modules | 5-10 minutes |
| `ready` | Waiting for code to review | (indefinite) |
| `researching` | Performing code review | 15-30 minutes |
| `waiting-for-feedback` | Awaiting developer responses | (external) |
| `retired` | Review complete, team decommissioned | (terminal) |
| `failed` | Error occurred | (terminal) |
| `paused` | Manually paused | (indefinite) |

### State Transitions

**onboarding → indexing**
- Read mission from inbox signal
- Identify review scope (files, modules, or entire codebase)
- Plan review strategy

**indexing → ready**
- Scan directory structure
- Catalog modules and components
- Build mental model of architecture
- Wait for review trigger (commit, PR, directive)

**ready → researching**
- Receive signal: "Review authentication module"
- Read relevant files
- Analyze code patterns

**researching → waiting-for-feedback**
- Identify issues (bugs, security, design)
- Write review report
- Send to meta squad
- Wait for developer responses

**waiting-for-feedback → researching**
- Developer asks clarifying questions
- Team provides additional context

**waiting-for-feedback → retired**
- Developer acknowledges findings
- No further review needed

**(any state) → failed**
- Cannot access required files
- Review scope is unclear

## Skills

Consultant teams have access to review skills in `.squad/skills/`:

1. **code-review-checklist.md** — Review criteria (security, performance, maintainability)
2. **common-issues.md** — Known antipatterns and vulnerabilities
3. **report-format.md** — Review report structure

### Example Skill: Code Review Checklist

```markdown
---
tags: [code-review, quality, security]
category: checklist
---

# Code Review Checklist

## Security

- [ ] No hardcoded credentials
- [ ] Input validation on all user inputs
- [ ] SQL queries use parameterized statements
- [ ] Authentication checks on protected routes
- [ ] Sensitive data encrypted at rest

## Performance

- [ ] No N+1 queries
- [ ] Database indexes on foreign keys
- [ ] API responses are paginated
- [ ] Large files streamed, not loaded into memory

## Maintainability

- [ ] Functions are focused (single responsibility)
- [ ] No code duplication
- [ ] Clear variable and function names
- [ ] Error handling for edge cases
- [ ] Tests for critical paths

## Design

- [ ] Separation of concerns
- [ ] Dependencies injected, not hardcoded
- [ ] Logging for important operations
- [ ] Configuration via environment variables
```

## Agent Configuration

### Lead Agent

**Role:** Code reviewer and analyst

**Model:** `claude-sonnet-4`

**Temperature:** `0.2` (low, precise analysis)

**Tools:** `view`, `grep`, `glob`, `bash` (read-only)

**Responsibilities:**
- Analyze code for issues
- Identify security vulnerabilities
- Suggest improvements
- Write review reports

**Constraints:**
- **Cannot modify files** (`edit`, `create` disabled)
- **Cannot run builds or tests** (read-only access)
- **Cannot commit or push** (no git write access)

## Typical Workflow

### Phase 1: Onboarding

1. Team receives signal: "Review authentication module for security issues"
2. Agent parses mission:
   - **Scope:** `src/auth/` directory
   - **Focus:** Security vulnerabilities
3. Transitions to `indexing`

### Phase 2: Indexing

1. Agent scans directory structure:
   ```
   src/auth/
   ├── AuthService.ts
   ├── TokenManager.ts
   ├── middleware/
   │   └── validateToken.ts
   └── routes/
       └── auth.ts
   ```
2. Reads imports to understand dependencies
3. Builds module map
4. Transitions to `ready`

### Phase 3: Ready → Researching

1. Waits for explicit review trigger
2. Meta squad sends signal: "Start review now"
3. Transitions to `researching`

### Phase 4: Researching

1. Agent reads files in scope:
   - `src/auth/AuthService.ts`
   - `src/auth/TokenManager.ts`
   - `src/auth/middleware/validateToken.ts`
   - `src/auth/routes/auth.ts`

2. Identifies issues:
   - **Critical:** JWT secret hardcoded in `TokenManager.ts`
   - **High:** No rate limiting on login endpoint
   - **Medium:** Password validation too weak (no special chars)
   - **Low:** Inconsistent error messages leak info

3. Writes review report (see example below)

4. Transitions to `waiting-for-feedback`

### Phase 5: Waiting for Feedback

1. Meta squad receives report
2. Developer responds: "Fixed JWT secret, added rate limiting. Can you review?"
3. Agent transitions back to `researching`
4. After re-review, agent confirms fixes and transitions to `retired`

## Deliverable Format

Consultant teams produce `deliverable.md` with ranked findings.

**Example: Security Review Report**

```markdown
# Authentication Module Security Review

## Summary

Reviewed `src/auth/` for security vulnerabilities. Found 1 critical issue (hardcoded secret), 1 high-priority issue (no rate limiting), and 2 medium/low issues.

## Critical Issues (Fix Immediately)

### C1: Hardcoded JWT Secret

**File:** `src/auth/TokenManager.ts`

**Line:** 8

**Issue:**
JWT secret is hardcoded in source code:

\`\`\`typescript
const JWT_SECRET = 'my-secret-key-12345';
\`\`\`

**Risk:**
- Secret is visible in version control
- Compromised repo = compromised auth system
- Cannot rotate secret without code change

**Recommendation:**
Move to environment variable:

\`\`\`typescript
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET not configured');
}
\`\`\`

Add to `.env.example`:
\`\`\`
JWT_SECRET=<generate-strong-secret>
\`\`\`

---

## High Priority Issues

### H1: No Rate Limiting on Login

**File:** `src/auth/routes/auth.ts`

**Line:** 15

**Issue:**
Login endpoint has no rate limiting:

\`\`\`typescript
router.post('/login', async (req, res) => {
  // No rate limit check
  const { email, password } = req.body;
  // ...
});
\`\`\`

**Risk:**
- Brute force attacks possible
- Account enumeration via timing attacks

**Recommendation:**
Add rate limiting middleware:

\`\`\`typescript
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts'
});

router.post('/login', loginLimiter, async (req, res) => {
  // ...
});
\`\`\`

---

## Medium Priority Issues

### M1: Weak Password Validation

**File:** `src/auth/AuthService.ts`

**Line:** 42

**Issue:**
Password only requires 8 characters, no special characters:

\`\`\`typescript
if (password.length < 8) {
  throw new Error('Password too short');
}
\`\`\`

**Recommendation:**
Enforce complexity requirements:

\`\`\`typescript
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
if (!passwordRegex.test(password)) {
  throw new Error('Password must be 12+ chars with upper, lower, number, and special char');
}
\`\`\`

---

## Low Priority Issues

### L1: Inconsistent Error Messages

**File:** `src/auth/routes/auth.ts`

**Lines:** 20, 35

**Issue:**
Different error messages for invalid email vs invalid password:

\`\`\`typescript
// Line 20
if (!user) {
  return res.status(401).json({ error: 'User not found' });
}

// Line 35
if (!isValid) {
  return res.status(401).json({ error: 'Invalid password' });
}
\`\`\`

**Risk:**
Attackers can enumerate valid email addresses by observing error messages.

**Recommendation:**
Use generic message for both:

\`\`\`typescript
return res.status(401).json({ error: 'Invalid credentials' });
\`\`\`

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 1 | 🔴 Fix required |
| High | 1 | 🟠 Fix recommended |
| Medium | 1 | 🟡 Consider fixing |
| Low | 1 | 🟢 Optional |

## Next Steps

1. Move JWT secret to environment variable
2. Add rate limiting to login endpoint
3. Consider stronger password requirements
4. Standardize error messages

**Estimated Effort:** 1-2 hours
```

## Common Use Cases

### Security Review

**Mission:** "Review authentication for security issues"

**States:** `onboarding → indexing → ready → researching → waiting-for-feedback → retired`

**Duration:** 30-45 minutes (research phase)

**Output:**
- Ranked security findings
- Code examples
- Fix recommendations

---

### Architecture Review

**Mission:** "Review API layer design for maintainability"

**States:** `onboarding → indexing → ready → researching → waiting-for-feedback → retired`

**Duration:** 45-60 minutes

**Output:**
- Design feedback
- Suggested refactorings
- Architectural improvements

---

### Code Quality Audit

**Mission:** "Review codebase for code smells and antipatterns"

**States:** `onboarding → indexing → ready → researching → waiting-for-feedback → retired`

**Duration:** 1-2 hours

**Output:**
- Code smell catalog
- Refactoring suggestions
- Testing gaps

## Best Practices

### Actionable Feedback

✅ **Good:**
"Move JWT secret to environment variable. Add to `.env.example` as `JWT_SECRET=<value>`"

❌ **Bad:**
"Don't hardcode secrets"

### Include Examples

Show the issue AND the fix:

```markdown
**Current:**
\`\`\`typescript
const secret = 'hardcoded';
\`\`\`

**Recommended:**
\`\`\`typescript
const secret = process.env.JWT_SECRET;
\`\`\`
```

### Prioritize Findings

Use severity levels:
- **Critical:** Security vulnerabilities, data loss risks
- **High:** Performance issues, stability risks
- **Medium:** Code quality, maintainability
- **Low:** Style, minor improvements

### Explain the Risk

Don't just point out issues—explain **why** they matter:

"No rate limiting allows brute force attacks. An attacker can try 1000s of passwords in minutes."

## Consultant vs Coding

| Aspect | Consultant | Coding |
|--------|------------|--------|
| **Output** | Reports | Code |
| **Modifies Files** | ❌ Never | ✅ Yes |
| **Tools** | Read-only | Read + write |
| **Use Case** | Review/feedback | Implementation |

**Use consultant when:**
- You want review without changes
- External audit is needed
- Learning from existing code

**Use coding when:**
- You want code modifications
- Implementing fixes
- Refactoring

## Monitoring

Consultant teams emit telemetry (when enabled):

- `consultant.issues_found` — Issue count
- `consultant.severity_critical` — Critical issue count
- `consultant.review_time_ms` — Review duration

**Health checks:**
- Status updated within 10 minutes
- Deliverable exists and is non-empty
- No errors in logs

## Next Steps

- [View coding archetype](/vladi-plugins-marketplace/archetypes/coding)
- [View deliverable archetype](/vladi-plugins-marketplace/archetypes/deliverable)
- [Create custom archetypes](/vladi-plugins-marketplace/archetypes/creating-archetypes)
