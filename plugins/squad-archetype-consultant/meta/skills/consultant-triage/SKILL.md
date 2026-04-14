---
name: consultant-triage
description: "Diagnose consultant team problems — detect failures, identify root causes, recommend recovery. Triggers on: triage consultant, consultant problems, diagnose consultant failures."
version: 0.1.0
---

# Consultant Triage

You diagnose problems detected by the `consultant-triage.ts` script and recommend recovery actions.

## Triggers

- "triage consultant"
- "consultant problems"
- "diagnose consultant failures"
- "consultant stuck teams"

## Input

The triage script outputs detected problems:

```json
{
  "problems": [
    {
      "teamId": "team-id",
      "domain": "team-name",
      "severity": "critical|high|medium|low",
      "category": "stalled|failed|data-quality|schema-mismatch",
      "description": "Team stuck in indexing for 6 hours",
      "diagnosticId": "stalled-indexing",
      "suggestedRecovery": ["check-logs", "reset-state"]
    }
  ]
}
```

## Diagnostic Decision Tree

For each problem category, walk through:

### Stuck in Indexing (No Progress > 20 Minutes)

**Indicators:**
- State = "indexing", updated_at timestamp > 20min old
- No new learnings in log.jsonl
- Agent session may have crashed or gotten confused

**Diagnosis:**
1. Check if codebase is accessible (permissions, repo URL valid)
2. Review agent run-output.log for errors
3. Check if indexing got stuck on a specific file pattern

**Recovery:**
- Send directive: "Skip deep analysis, index README and top-level architecture only"
- Re-launch with smaller scope (fewer directories)
- Check archetype-config.json for invalid codebaseLocation

---

### Stale Consultant (No Questions in Days)

**Indicators:**
- Last question timestamp > 7 days ago
- State = "ready" but no activity
- Metadata shows high idleSinceMinutes

**Diagnosis:**
1. Check if domain is still relevant (codebase archived?)
2. Review if questions are being routed elsewhere
3. Check if knowledge is outdated (codebase changed significantly)

**Recovery:**
- **Option 1**: Retire consultant (transition to "retired" terminal state)
- **Option 2**: Refresh knowledge (send directive to re-index)
- **Option 3**: Archive and remove worktree if no longer needed

---

### Knowledge Gaps (Repeated "I Don't Know")

**Indicators:**
- Outbox signals contain "I don't know" or "insufficient information"
- Questions about areas not covered in initial indexing
- Low confidence learnings in specific areas

**Diagnosis:**
1. Parse outbox for unknown responses
2. Identify common themes in gaps (e.g., all API questions)
3. Check if codebaseLocation is too narrow

**Recovery:**
- Send directive: "Re-index with focus on [specific area]"
- Expand codebaseLocation in archetype-config.json
- Increase indexingDepth from "surface" to "moderate" or "deep"

---

### Question Routing Errors (Wrong Consultant)

**Indicators:**
- Question sent to consultant A, but about consultant B's domain
- Consultant responds with "this is outside my domain"
- Domain mismatch between archetype-config.json and question subject

**Diagnosis:**
1. Review inbox question subject vs consultant's domain field
2. Check if meta-squad has routing logic
3. Identify if domain boundaries need clarification

**Recovery:**
- Update consultant domain field in archetype-config.json
- Add domain keywords to setup for better routing
- Consider creating a meta-consultant that routes questions

---

### Failed Teams

**Indicators:**
- State = "failed"
- Error message present in status.json

**Diagnosis:**
1. Read error message in status.json
2. Check for known failure patterns (access denied, timeout, etc.)
3. Review recent learning entries for crash context

**Recovery:**
- Run recovery skill if automated fix available
- Provide manual recovery steps based on error type
- Escalate to human if unrecoverable

## Output Format

For each problem:

> 🔴 **Team: payments** (Critical)
> - **Problem**: Stuck in indexing for 6 hours
> - **Root Cause**: [Your diagnosis here]
> - **Recommended Action**: [Recovery steps]
>   1. Run: `copilot chat "recover payments team"`
>   2. Check logs in `.squad/learning-log.jsonl`
>   3. Send directive if needed
