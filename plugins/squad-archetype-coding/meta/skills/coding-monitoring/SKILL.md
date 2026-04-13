---
name: coding-monitoring
description: Interpret and present coding team monitor output — understand SDLC states, PR review timing, CI health, and when to intervene.
---

# Coding Monitoring Skill

This skill teaches meta-squads how to interpret the output from the `coding-monitor.ts` script and make informed decisions about coding team health.

## Purpose

The coding monitor script collects mechanical data — PR numbers, CI status, commit timestamps. This skill provides the intelligence layer to understand what that data means and when action is needed.

## SDLC State Reference

Coding teams progress through these states (from `team/archetype.json`):

### Active States

1. **preparing** — Team setting up workspace, reading requirements, planning approach
   - **Typical duration:** 5-15 minutes
   - **Monitor for:** Extended stalls (>20min) may indicate confusion about requirements

2. **implementing** — Team writing code, making commits
   - **Typical duration:** 20-60 minutes depending on complexity
   - **Monitor for:** No commit activity for >30min may indicate blocker

3. **testing** — Team running tests, fixing failures
   - **Typical duration:** 10-30 minutes
   - **Monitor for:** Tests failing for >15min indicates real issue vs flaky test

4. **pr-open** — Team has opened PR, waiting for CI
   - **Typical duration:** 5-15 minutes for CI to complete
   - **Monitor for:** CI pending >20min may indicate pipeline issue

5. **pr-review** — PR in review, waiting for approval
   - **Typical duration:** Varies widely (30min - several hours)
   - **Monitor for:**
     - Changes requested but no new commits >30min
     - No reviewer activity for >60min (may need ping)

6. **pr-approved** — PR approved, ready to merge
   - **Typical duration:** 1-5 minutes
   - **Monitor for:** Delays >10min may indicate merge conflict or permission issue

7. **merged** — PR merged, cleanup in progress
   - **Typical duration:** 2-5 minutes
   - **Monitor for:** Should transition to complete quickly

### Terminal States

- **complete** — Task successfully delivered
- **failed** — Unrecoverable error occurred

## Interpreting Monitor Output

### Dashboard Columns

The monitor shows these data points per team:

```
🔓 PR #42 (open) | ✅ CI passing | 🔍 changes requested | 📝 12 files | ⏱️ last commit 15m ago
```

**How to read this:**
- `🔓 PR #42 (open)` — PR is open (not merged/closed)
- `✅ CI passing` — Build and tests are green
- `🔍 changes requested` — Reviewer asked for changes
- `📝 12 files` — Scope of the PR
- `⏱️ last commit 15m ago` — Team activity level

### PR Status Icons

- `📝 draft` — Work in progress, not ready for review
- `🔓 open` — Ready for review
- `✅ approved` — Reviewer approved
- `🎉 merged` — Successfully merged
- `🔒 closed` — Closed without merging

### CI Status Icons

- `✅ passing` — All checks green
- `❌ failing` — Build or tests broken
- `⏳ pending` — CI still running

### Review Decision Icons

- `✅ approved` — Reviewer approved changes
- `🔍 changes requested` — Reviewer wants modifications
- `👀 review required` — Waiting for initial review

## When to Intervene

### ✅ Normal — No Action Needed

- **implementing** with commits every 10-20min → team is coding
- **pr-review** for <60min → reviewers need time
- **CI pending** for <15min → pipeline is running
- **testing** with commits addressing failures → team is fixing

### ⚠️ Warning — Monitor Closely

- **implementing** with no commits for 30-45min → team may be stuck
- **pr-review** for 60-90min with no activity → reviewers may need ping
- **CI failing** for 15-30min → real issue, not flaky test
- **changes requested** with no commits for 30-60min → team may not have seen feedback

### 🔴 Critical — Action Required

- **implementing** with no commits for >60min → team is blocked
- **pr-review** for >2 hours with no activity → escalate to reviewers
- **CI failing** for >30min → build is broken, blocking progress
- **changes requested** with no commits for >60min → team ignoring feedback
- **Any state** with error in status → team has crashed

## CI Failure Interpretation

### Flaky vs Real Failures

**Flaky test indicators:**
- CI passes on retry without code changes
- Different tests fail on different runs
- Failures in unrelated areas of code

**Real failure indicators:**
- Same test fails consistently
- Failure in code the team just modified
- Multiple related test failures

### Response Time

- **0-15min:** Let team investigate and fix
- **15-30min:** Warning — check if team is actively working on it
- **30min+:** Critical — team may need help or be blocked

## Review Loop Detection

**Healthy review loop:**
1. PR opened → review within 60min
2. Changes requested → new commits within 30min
3. Re-review requested → approval within 30min
4. Merge within 10min

**Unhealthy patterns:**
- Changes requested, no commits for >1 hour → team didn't see feedback
- Multiple review rounds with same issues → miscommunication
- Approved but not merged for >30min → merge conflict or permission issue

## Commit Activity Patterns

### Healthy

- **implementing:** Commit every 10-30min
- **testing:** Commits when fixing test failures
- **pr-review:** Commits when addressing feedback

### Concerning

- **implementing:** No commits for >45min
- **After changes requested:** No commits for >45min
- **Any active state:** No commits for >2 hours

### Normal (no concern)

- **pr-open, pr-review, pr-approved:** No commits expected
- **complete, failed:** Terminal states

## Example Scenarios

### Scenario 1: Stuck in Review

```
State: pr-review | 👀 review required | ⏱️ last commit 90m ago
```

**Interpretation:** PR has been waiting for review for 90 minutes with no reviewer activity.

**Action:**
- Check PR in GitHub to see who's assigned
- Ping reviewers in team chat
- If urgent, find alternate reviewer

### Scenario 2: Ignoring Feedback

```
State: pr-review | 🔍 changes requested | ⏱️ last commit 75m ago
```

**Interpretation:** Reviewer requested changes 75 minutes ago, but team hasn't addressed them.

**Action:**
- Check team logs to see if they saw the feedback
- Send directive reminding them of review comments
- If team is blocked, offer to help

### Scenario 3: Broken CI

```
State: pr-open | ❌ CI failing | ⏱️ last commit 45m ago
```

**Interpretation:** CI has been failing for 45 minutes — this is a real issue, not a flaky test.

**Action:**
- Check CI logs to identify failure
- If team hasn't committed fix attempts, they may be stuck
- Consider sending directive with error details

### Scenario 4: Healthy Progress

```
State: implementing | 🌿 feature-branch | ⏱️ last commit 12m ago
```

**Interpretation:** Team is actively coding with recent commit activity.

**Action:** None — team is progressing normally.

## Integration with Triage

When the monitor detects concerning patterns, the `coding-triage` script will:
1. Classify the issue (severity, category)
2. Suggest recovery actions
3. Generate triage report

The triage skill provides the decision tree for which recovery action to take.

## Tips for Meta-Squad

- **Don't over-react to single data points** — look for patterns over time
- **Context matters** — a 2-hour PR review might be normal for complex changes
- **Trust team autonomy** — intervene when stuck, not just slow
- **Use triage for diagnosis** — the monitor shows symptoms, triage finds root cause
- **Track trends** — teams consistently slow in one state may need help with that phase
