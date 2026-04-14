---
name: consultant-recovery
description: "Recover consultant teams from failures — automated and manual recovery procedures. Triggers on: recover consultant, consultant recovery, fix consultant team."
version: 0.1.0
---

# Consultant Recovery

Recovery procedures for consultant teams.

## Triggers

- "recover consultant"
- "consultant recovery"
- "fix consultant team"

## Automated Recovery Actions

### Action 1: Re-establish Codebase Access

**When to use:**
- Error: "Cannot access codebase at [location]"
- Permissions revoked or repo moved
- Network issues preventing clone/fetch

**Steps:**
```bash
# Verify current codebase location
cat .squad/archetype-config.json | grep codebaseLocation

# Test access
git ls-remote <codebaseLocation> 2>&1

# If repo moved, update config
# Edit .squad/archetype-config.json with new URL

# Send directive to re-index
echo '{"id":"rec-1","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","from":"meta-squad","type":"directive","subject":"re-index","body":"Codebase location updated. Re-run indexing phase."}' > .squad/signals/inbox/$(date +%s)-directive-reindex.json
```

**Validation:**
Check status.json — state should transition to "indexing"

---

### Action 2: Reset Stuck Indexing

**When to use:**
- Team stuck in "indexing" state for > 30 minutes
- No progress updates, no new learnings
- Agent may have crashed or entered infinite loop

**Steps:**
```bash
# Check if agent is still running
ps aux | grep copilot | grep <domain>

# If hung, kill and re-launch
# (Use launch script with --reset flag)
npx tsx scripts/launch.ts --domain <domain> --reset

# Or manually reset status
echo '{"domain":"<domain>","domain_id":"<id>","state":"indexing","step":"reset — starting fresh","started_at":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","updated_at":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","progress_pct":0}' > .squad/status.json
```

**Validation:**
Monitor run-output.log for new activity within 5 minutes

---

### Action 3: Refresh Stale Knowledge

**When to use:**
- Consultant giving outdated answers (codebase changed since indexing)
- Last indexing > 30 days ago and codebase is active
- User explicitly requests "refresh knowledge"

**Steps:**
```bash
# Send refresh directive
echo '{"id":"rec-2","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","from":"meta-squad","type":"directive","subject":"refresh","body":"Codebase has been updated. Re-index to refresh your knowledge."}' > .squad/signals/inbox/$(date +%s)-directive-refresh.json

# Or launch with --refresh flag
npx tsx scripts/launch.ts --domain <domain> --refresh
```

**Validation:**
Status.json shows state="indexing", learnings log shows new entries

---

## Manual Recovery Procedures

### Procedure 1: Expand Indexing Scope

**When to use:**
- Consultant repeatedly says "I don't know" for specific areas
- Questions about modules not covered in initial indexing
- indexingDepth was too shallow (e.g., "surface" but needs "deep")

**Steps:**
1. Edit `.squad/archetype-config.json`:
   ```json
   {
     "settings": {
       "indexingDepth": "deep",  // was "surface"
       "codebaseLocation": "https://github.com/org/repo"  // could expand to include additional paths
     }
   }
   ```
2. Send directive to re-index:
   ```bash
   echo '{"id":"rec-3","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","from":"meta-squad","type":"directive","subject":"expand-index","body":"Expand indexing to cover [specific modules]. Use deep analysis."}' > .squad/signals/inbox/$(date +%s)-directive-expand.json
   ```
3. Monitor indexing progress

**Validation:**
Learnings log shows entries from new areas, consultant can now answer previously unknown questions

---

### Procedure 2: Retire and Archive

**When to use:**
- Domain no longer relevant (codebase deprecated)
- Consultant unused for > 30 days
- Better consultant created to replace this one

**Steps:**
1. Update status to retired:
   ```bash
   echo '{"domain":"<domain>","domain_id":"<id>","state":"retired","step":"archived","completed_at":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > .squad/status.json
   ```
2. Write summary to outbox:
   ```bash
   echo '{"id":"final-summary","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","from":"consultant-team","type":"report","subject":"Final Summary","body":"Consultant retired. Total: X questions answered, Y learnings accumulated."}' > .squad/signals/outbox/$(date +%s)-report-final.json
   ```
3. Optionally remove worktree:
   ```bash
   git worktree remove <path-to-worktree>
   git branch -d squad/<domain>
   ```

**Validation:**
Status shows "retired", worktree removed if desired

---

## Recovery Decision Tree

Use this decision tree to choose the right recovery action:

1. **Check error type** — Read status.json error field or triage output
   - Access error → Action 1 (Re-establish Codebase Access)
   - Stuck/hung → Action 2 (Reset Stuck Indexing)
   - Outdated knowledge → Action 3 (Refresh Stale Knowledge)
   - Knowledge gaps → Procedure 1 (Expand Indexing Scope)
   - Deprecated → Procedure 2 (Retire and Archive)

2. **Assess impact** — Can the team resume or must it restart?
   - Resumable → Use directives to guide team
   - Must restart → Use launch script with --reset

3. **Choose action** — Automated recovery or manual intervention?
   - Automated: Run recovery action commands
   - Manual: Follow procedure steps

4. **Validate** — Confirm recovery succeeded before resuming
   - Check status.json for state change
   - Monitor run-output.log for activity
   - Test with a sample question
