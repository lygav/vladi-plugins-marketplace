---
name: coding-triage
description: Recovery decision trees for coding team failures — handle PR conflicts, CI failures, review loops, and team blocks.
---

# Coding Triage Skill

This skill provides recovery strategies for common coding team failures. It teaches meta-squads how to diagnose root causes and select appropriate recovery actions.

## Purpose

The `coding-triage.ts` script detects problem patterns and categorizes them. This skill provides the intelligence to decide which recovery action to take and how to execute it.

## Triage Categories

### 1. Review Feedback Ignored

**Symptoms:**
- State: `pr-review`
- Review decision: `changes_requested`
- No commits for >30 minutes

**Root Causes:**
1. Team didn't see the review comments
2. Team is stuck on how to address feedback
3. Team is working on fixes but hasn't committed yet
4. Team is blocked on clarification from reviewer

**Recovery Decision Tree:**

```
Is team's last log entry recent (<5min)?
├─ YES → Team is active
│  └─ Wait 10-15 more minutes for commit
│  └─ If still no commit → Check team logs for blocker
│
└─ NO → Team may be idle
   └─ Send directive: "Review comments received on PR #{number}. Please address feedback."
   └─ If no response in 15min → Check team logs
   └─ If team crashed → Attempt recovery/restart
```

**Recommended Actions:**
1. **First:** Check team activity logs
2. **If active:** Wait — team may be working on fix
3. **If idle:** Send reminder directive with review link
4. **If blocked:** Review feedback and clarify requirements

### 2. CI Failure

**Symptoms:**
- CI status: `failing`
- Failing for >15 minutes
- State: `pr-open` or `testing`

**Root Causes:**
1. Lint errors in new code
2. Test failures due to bugs
3. Breaking API changes
4. Build dependency issues
5. Flaky tests (rare but possible)

**Recovery Decision Tree:**

```
Check CI logs — what failed?
├─ Lint errors
│  └─ Run linter locally
│  └─ Fix formatting/style issues
│  └─ Commit fix
│
├─ Test failures
│  ├─ Is test new (added in PR)?
│  │  └─ YES → Bug in new code, fix it
│  │  └─ NO → Breaking change, fix code or update test
│  │
│  └─ Does test pass locally?
│     └─ YES → Flaky test, re-run CI or skip
│     └─ NO → Real bug, debug and fix
│
├─ Build errors
│  └─ Check for missing dependencies
│  └─ Verify package.json/requirements.txt
│  └─ Fix and commit
│
└─ Unknown/infrastructure
   └─ Re-run CI
   └─ If still fails → Report to platform team
```

**Recommended Actions:**
1. **Always:** Get CI logs and identify failure type
2. **Lint errors:** Quick fix — just formatting
3. **Test failures:** Investigate — may indicate real bug
4. **Build errors:** Check dependencies and environment
5. **Persistent failures:** Escalate or pair-program with team

### 3. Review Stalled

**Symptoms:**
- State: `pr-review`
- PR status: `open`
- No activity for >60 minutes
- Review decision: `review_required` (not yet reviewed)

**Root Causes:**
1. Reviewers haven't seen the PR
2. Reviewers are busy with other tasks
3. No reviewers assigned
4. PR is too large or complex
5. PR lacks context/description

**Recovery Decision Tree:**

```
Check PR metadata:
├─ Are reviewers assigned?
│  ├─ NO → Assign reviewers (CODEOWNERS or manual)
│  └─ YES → Continue to next check
│
├─ Is PR description clear?
│  ├─ NO → Add context, screenshots, testing notes
│  └─ YES → Continue to next check
│
├─ Is PR too large (>500 lines)?
│  ├─ YES → Consider splitting into smaller PRs
│  └─ NO → Continue to next check
│
└─ How long waiting?
   ├─ 1-2 hours → Ping reviewers in comment
   ├─ 2-4 hours → Direct message to reviewers
   └─ >4 hours → Escalate to team lead or find alternate reviewer
```

**Recommended Actions:**
1. **1-2 hours:** Polite ping in PR comment
2. **2-4 hours:** Direct message to reviewers
3. **>4 hours:** Escalate or reassign
4. **Large PRs:** Offer to split into smaller chunks
5. **Missing context:** Update PR description

### 4. Team Idle

**Symptoms:**
- State: `implementing` or `testing`
- No commits for >2 hours
- No error in status

**Root Causes:**
1. Team is stuck on technical problem
2. Team is waiting for external input
3. Team has crashed/stalled without error
4. Task is more complex than estimated

**Recovery Decision Tree:**

```
Check team logs:
├─ Last entry is error or exception
│  └─ Team likely crashed → Check error and attempt recovery
│
├─ Last entry is question/uncertainty
│  └─ Team is blocked → Provide guidance or clarification
│
├─ Last entry is normal progress
│  └─ Check timestamps:
│     ├─ <30min ago → Team recently active, may be thinking/researching
│     ├─ 30min-1hr → Send status check
│     └─ >1hr → Team may be stuck, send directive
│
└─ No logs or very old logs
   └─ Team likely crashed → Attempt restart or recovery
```

**Recommended Actions:**
1. **First:** Always check team logs for context
2. **If stuck:** Send directive with guidance or break down task
3. **If crashed:** Review error logs and attempt recovery
4. **If waiting:** Check if team needs input from you or external dependency

### 5. Test Failure

**Symptoms:**
- Tests status: `failing`
- State: `testing` or `pr-open`

**Root Causes:**
1. Bug introduced in new code
2. Test expectations wrong
3. Environment/setup issue
4. Flaky test

**Recovery Decision Tree:**

```
Which tests are failing?
├─ New tests (added in this PR)
│  ├─ Test code has bug → Fix test
│  └─ Implementation has bug → Fix code
│
├─ Existing tests (were passing before)
│  ├─ Breaking change introduced
│  │  ├─ Intentional → Update test expectations
│  │  └─ Unintentional → Fix code to maintain compatibility
│  │
│  └─ No code changes in tested area → Flaky test
│
└─ All tests failing
   └─ Environment issue (dependencies, setup) → Fix environment
```

**Recommended Actions:**
1. **Identify failing tests:** Which ones, how many?
2. **Check if tests are new:** New = likely test bug
3. **Check if tests were passing:** Breaking change?
4. **Run tests locally:** Reproduce the failure
5. **Fix root cause:** Code bug, test bug, or environment

### 6. Merge Conflict

**Symptoms:**
- PR has conflicts
- State: `pr-review` or `pr-approved`
- Cannot auto-merge

**Root Causes:**
1. Base branch updated while PR was in review
2. Overlapping changes in same files
3. Someone else merged related PR

**Recovery Decision Tree:**

```
Assess conflict complexity:
├─ Simple conflicts (same file, different sections)
│  ├─ Pull latest base branch
│  ├─ Merge or rebase
│  ├─ Resolve conflicts manually
│  └─ Push resolution
│
├─ Complex conflicts (same lines, logic changes)
│  ├─ Understand both changes
│  ├─ Merge logic carefully
│  ├─ Re-test after resolution
│  └─ Request re-review if significant
│
└─ Many conflicts (>10 files)
   ├─ Consider rebasing on latest base
   ├─ May need to re-review after resolution
   └─ Verify all tests still pass
```

**Recommended Actions:**
1. **Always:** Pull latest base branch first
2. **Rebase vs Merge:** Rebase for cleaner history, merge for safety
3. **Complex conflicts:** Re-test thoroughly after resolution
4. **After resolution:** Request re-review if logic changed

## Common Failure Patterns

### Pattern: Review Ping-Pong

**Scenario:** PR goes through multiple review cycles with same issues.

**Diagnosis:**
- Miscommunication between team and reviewer
- Incomplete understanding of requirements
- Reviewer changing expectations

**Recovery:**
1. Set up sync call between team and reviewer
2. Clarify requirements explicitly
3. Consider pair programming for complex changes
4. Update requirements doc if needed

### Pattern: CI Always Failing

**Scenario:** Every commit fails CI with different errors.

**Diagnosis:**
- Environment inconsistency (local vs CI)
- Missing dependencies or setup steps
- Team not running tests locally before push

**Recovery:**
1. Document local testing workflow
2. Verify team has same environment as CI
3. Add pre-commit hooks to run tests
4. Check CI configuration for issues

### Pattern: PRs Sitting Unreviewed

**Scenario:** Multiple PRs waiting for review for hours.

**Diagnosis:**
- No reviewers available/assigned
- Team doesn't have review culture
- PRs too large or lack context

**Recovery:**
1. Assign reviewers explicitly
2. Set review SLA expectations
3. Encourage smaller, incremental PRs
4. Provide PR templates with required context

## Automated vs Manual Recovery

### Automated Actions (Safe)
- Re-run CI
- Merge when approved and CI passing
- Post status comments
- Assign reviewers from CODEOWNERS

### Manual Actions (Require Intelligence)
- Resolve merge conflicts
- Fix failing tests
- Address review feedback
- Debug CI failures
- Rewrite unclear code

**Guideline:** Automate detection and notification, but keep a human in the loop for code changes and merge decisions.

## Escalation Criteria

**When to escalate:**
- Team stuck >4 hours without progress
- CI failing >2 hours with no fix attempt
- Review waiting >1 day (24 hours)
- Critical bug introduced
- Security vulnerability detected

**Who to escalate to:**
- Technical blockers → Senior engineer or architect
- Review delays → Engineering manager
- Process issues → Team lead
- Infrastructure → DevOps/platform team

## Tips for Meta-Squad

- **Read the logs first** — team's last messages often reveal root cause
- **Give teams time** — don't intervene at first sign of trouble
- **Context is key** — what's normal for one team may be slow for another
- **Learn from patterns** — recurring issues indicate systemic problems
- **Document recoveries** — successful interventions inform future actions
- **Balance autonomy and help** — teams should self-solve when possible, but get unstuck quickly when needed
