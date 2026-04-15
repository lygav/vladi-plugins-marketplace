---
title: Consultant Archetype
description: Teams that provide recommendations without making changes
---

# Consultant Archetype

The **consultant** archetype is designed for teams that analyze code and provide recommendations **without modifying** the codebase.

## Purpose

Consultant teams:
- Review code quality
- Provide architecture guidance
- Suggest improvements
- Answer technical questions
- Identify risks

**Output:** Recommendations, findings, advice (no code changes)

## States

```
initializing
    ↓
analyzing ←→ paused
    ↓
recommending ←→ paused
    ↓
complete (✓)

(any state) → failed (✗)
```

| State | Description | Duration |
|-------|-------------|----------|
| `initializing` | Setting up workspace | <1min |
| `analyzing` | Reviewing codebase | 10-20min |
| `recommending` | Formulating recommendations | 5-10min |
| `complete` | Recommendations ready | (terminal) |
| `failed` | Error occurred | (terminal) |
| `paused` | Manually paused | (indefinite) |

## Agents

### Lead Agent

**Role:** Senior consultant and reviewer

**Responsibilities:**
- Analyze codebase thoroughly
- Identify patterns and anti-patterns
- Provide actionable recommendations
- Rank by priority
- Explain rationale

**Tools:** `view`, `grep`, `glob`, `bash` (read-only)

**Temperature:** 0.2 (focused, analytical)

**Key constraint:** **Never modify files** (read-only access)

## Skills

Consultant teams have access to:

1. **code-review-checklist.md** - What to look for during reviews
2. **architecture-patterns.md** - Common patterns and best practices
3. **security-guidelines.md** - Security review criteria

### Example: Code Review Checklist

```markdown
---
tags: [code-review, quality, standards]
category: pattern
---

# Code Review Checklist

## Code Quality

- [ ] Functions are focused (single responsibility)
- [ ] No code duplication (DRY principle)
- [ ] Naming is clear and descriptive
- [ ] Comments explain "why", not "what"
- [ ] Error handling is comprehensive

## Testing

- [ ] Tests cover happy path and edge cases
- [ ] Test names describe behavior
- [ ] No hard-coded test data
- [ ] Tests are isolated (no shared state)

## Security

- [ ] No hardcoded credentials
- [ ] Input validation on all user data
- [ ] SQL queries use parameterized statements
- [ ] Secrets loaded from environment variables

## Performance

- [ ] No N+1 queries
- [ ] Expensive operations are cached
- [ ] Large datasets are paginated
- [ ] Database indexes exist for frequent queries

## Maintainability

- [ ] Dependencies are up-to-date
- [ ] No deprecated APIs used
- [ ] Configuration is externalized
- [ ] README documents setup steps
```

## Typical Workflow

### Phase 1: Initialization (30s)

1. Team workspace created
2. Archetype files copied
3. `.squad/` directory initialized
4. Status set to `initializing`

### Phase 2: Analyzing (10-20min)

1. Lead agent reads review request
2. Searches codebase for relevant files
3. Reviews code against checklist
4. Identifies issues and opportunities
5. Logs observations to learning log
6. Updates status: `state: "analyzing", progress_pct: 60`

**Example findings:**

```json
{
  "timestamp": "2025-01-30T12:00:00Z",
  "domain": "consultant-team",
  "category": "gotcha",
  "content": "Database queries in loop causing N+1 issue",
  "tags": ["performance", "database"],
  "context": "src/api/users.ts:45-60"
}
```

### Phase 3: Recommending (5-10min)

1. Lead agent formulates recommendations
2. Ranks by priority (High, Medium, Low)
3. Provides rationale and examples
4. Suggests specific improvements
5. Saves as `deliverable.md`
6. Updates status: `state: "recommending", progress_pct: 90`

### Phase 4: Complete (terminal)

1. Status set to `complete`
2. Deliverable available at `deliverable.md`
3. Team session can be stopped

## Deliverable Format

Consultant teams produce recommendations in `deliverable.md`.

**Example: Code Review Report**

```markdown
# Code Review: Authentication Module

## Summary

Reviewed authentication flow in `src/auth/`. Found 3 high-priority security issues and 2 medium-priority performance opportunities.

## Findings

### 🔴 High Priority

#### 1. Plaintext Passwords in Logs

**Location:** `src/auth/AuthService.ts:42`

**Issue:**
\`\`\`typescript
console.log('Login attempt:', { email, password });  // ← Logs plaintext password
\`\`\`

**Recommendation:**
Remove password from logs. Log only non-sensitive data:
\`\`\`typescript
console.log('Login attempt:', { email });
\`\`\`

**Impact:** High - Passwords exposed in log files

---

#### 2. No Rate Limiting on Login Endpoint

**Location:** `src/api/routes/auth.ts:15`

**Issue:**
Login endpoint has no rate limiting, allowing brute-force attacks.

**Recommendation:**
Add rate limiting middleware:
\`\`\`typescript
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many login attempts, try again later'
});

app.post('/auth/login', loginLimiter, loginHandler);
\`\`\`

**Impact:** High - Account takeover risk

---

#### 3. JWT Secret Hardcoded

**Location:** `src/auth/jwt.ts:8`

**Issue:**
\`\`\`typescript
const JWT_SECRET = 'my-secret-key';  // ← Hardcoded secret
\`\`\`

**Recommendation:**
Load from environment variable:
\`\`\`typescript
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET not set');
}
\`\`\`

**Impact:** High - Secret exposed in source code

---

### 🟡 Medium Priority

#### 4. N+1 Query in User Fetch

**Location:** `src/api/users.ts:45-60`

**Issue:**
\`\`\`typescript
for (const user of users) {
  user.profile = await getProfile(user.id);  // ← N+1 query
}
\`\`\`

**Recommendation:**
Batch fetch profiles:
\`\`\`typescript
const userIds = users.map(u => u.id);
const profiles = await getProfiles(userIds);
users.forEach(user => {
  user.profile = profiles.find(p => p.userId === user.id);
});
\`\`\`

**Impact:** Medium - Performance degradation with many users

---

#### 5. Missing Test Coverage for Password Reset

**Location:** `src/auth/AuthService.ts:70-90`

**Issue:**
Password reset flow has no tests.

**Recommendation:**
Add tests covering:
- Valid reset token
- Expired reset token
- Invalid reset token
- Token reuse prevention

**Impact:** Medium - Untested critical path

---

## Positive Observations

- ✅ JWT tokens use httpOnly cookies (good security practice)
- ✅ CSRF protection is enabled
- ✅ Input validation on all auth endpoints
- ✅ Consistent error messages (no info leakage)

## Action Items

1. **Immediate:** Fix high-priority issues (#1, #2, #3)
2. **This Sprint:** Address medium-priority issues (#4, #5)
3. **Long-term:** Add comprehensive auth test suite

## Resources

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Express Rate Limiting Guide](https://expressjs.com/en/advanced/best-practice-security.html#use-rate-limiting)
```

## Monitoring

Consultant teams emit metrics:

- `consultant.findings` - Total findings count
- `consultant.high_priority` - High-priority issues
- `consultant.code_reviewed` - Files analyzed

**Health checks:**

- Deliverable exists
- At least 3 findings or "no issues" statement
- Status updated within 10 minutes

## Common Use Cases

### Code Review

**Mission:** "Review authentication module for security issues"

**States:** `initializing → analyzing → recommending → complete`

**Output:**
- Security findings (ranked)
- Specific recommendations
- Code examples
- Action items

### Architecture Review

**Mission:** "Review database schema design"

**States:** `initializing → analyzing → recommending → complete`

**Output:**
- Schema analysis
- Normalization issues
- Index recommendations
- Relationship diagram

### Performance Audit

**Mission:** "Identify performance bottlenecks in API"

**States:** `initializing → analyzing → recommending → complete`

**Output:**
- Performance issues found
- Query optimization suggestions
- Caching opportunities
- Profiling data

## Tips

### Be Specific

❌ "Code quality could be better"

✅ "Function `getUserData` has 150 lines (recommend <50). Extract helpers."

### Provide Examples

Show how to fix issues:

```markdown
**Current:**
\`\`\`typescript
if (user == null) return;  // ← Loose equality
\`\`\`

**Recommended:**
\`\`\`typescript
if (user === null || user === undefined) return;  // ← Strict
// OR
if (!user) return;  // ← Falsy check
\`\`\`
```

### Rank by Impact

Use priority levels:
- 🔴 **High:** Security, data loss, crashes
- 🟡 **Medium:** Performance, maintainability
- 🟢 **Low:** Style, minor improvements

### Balanced Feedback

Include positives:

```markdown
## Positive Observations

- ✅ Comprehensive test coverage (90%)
- ✅ Clear naming conventions
- ✅ Good error handling
```

## Consultant vs Coding

| Aspect | Consultant | Coding |
|--------|------------|--------|
| **Changes** | None | Modifies codebase |
| **Output** | Recommendations | Code commits |
| **Tools** | Read-only | Read + write |
| **States** | analyzing/recommending | scanning/distilling |

**Use consultant when:**
- Review is needed
- No implementation yet
- Gathering requirements
- Risk assessment

**Use coding when:**
- Ready to implement
- Changes are straightforward
- Tests need to be written

## Workflow: Consultant → Coding

Common pattern:

1. **Consultant team** reviews code, finds issues
2. Meta squad reads recommendations
3. **Coding team** implements fixes based on recommendations

**Example:**

```bash
# Phase 1: Review
npx tsx scripts/onboard.ts --archetype consultant --domain review-team ...
npx tsx scripts/launch.ts --team review-team

# Phase 2: Implement fixes
npx tsx scripts/onboard.ts --archetype coding --domain fix-team ...
npx tsx scripts/monitor.ts --send fix-team --directive "Fix issues from review-team deliverable"
npx tsx scripts/launch.ts --team fix-team
```

## Next Steps

- [View coding archetype](/archetypes/coding)
- [View deliverable archetype](/archetypes/deliverable)
- [Create custom archetypes](/archetypes/creating-archetypes)
