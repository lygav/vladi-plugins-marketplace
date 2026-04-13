---
name: deliverable-triage
description: >
  Interpret deliverable triage reports, explain problems, and recommend recovery actions.
  Use when deliverable teams are unhealthy or stalled.
when_to_use: >
  - Deliverable team showing as unhealthy/stalled
  - User asks why deliverable team failed
  - Requesting recovery guidance
  - Explaining triage diagnosis
  - Coordinating recovery attempts
---

# Deliverable Triage — Interpretation Skill

When a deliverable team shows problems, the deliverable-triage.ts script diagnoses the issue and suggests recovery actions. Your role is to **interpret** this diagnosis and help the meta-squad coordinate recovery.

## Triage Data You Receive

### TriageResult
- category: Problem category identifier
- severity: low | medium | high | critical
- summary: One-line problem description
- details: Detailed explanation
- affectedResources: Files/directories involved
- suggestedActions: Array of recovery actions

### RecoveryAction
- action: What to do
- priority: immediate | high | normal | low
- estimatedImpact: Expected outcome
- implementation: How to execute

## Problem Categories

### 1. scanning-stalled-no-fragments
**What it means:** Team in scanning state but hasn't produced any fragments after significant time.

**Why it happens:**
- Scan configuration missing or incorrect
- Tool not running or crashed
- Source data inaccessible
- Permission issues

**How to help:**
- Check `.squad/deliverable/scan-metadata.json` for config
- Verify scan command/tool is operational
- Check team's error logs
- Signal: "Report scan configuration and any errors encountered"

**Urgency:** High — Team cannot progress

---

### 2. scanning-stalled-fragments-stopped
**What it means:** Team started collecting fragments but stopped mid-scan.

**Why it happens:**
- Tool crashed during scan
- Resource exhaustion (memory, disk)
- Network timeout
- Rate limiting

**How to help:**
- Check for tool crash logs
- Verify disk space available
- Review last few fragments for patterns
- Signal: "Report last successful fragment and current scan state"

**Urgency:** High — Partial progress at risk

---

### 3. schema-validation-failed
**What it means:** Schema validation detected critical issues. Team CANNOT aggregate until fixed.

**Why it happens:**
- Fragments have inconsistent structure
- Schema version mismatch
- Required fields missing
- Data type violations

**How to help:**
- Review `.squad/deliverable/validation.json` for specific errors
- Check fragment structure consistency
- May need to re-scan with corrected schema
- This is a blocker — team is stuck

**Urgency:** Critical — Blocks completion

---

### 4. fragments-incomplete
**What it means:** Expected fragment count doesn't match collected count.

**Why it happens:**
- Scan interrupted before completion
- Some sources failed
- Tool bug skipped items
- Expected count miscalculated

**How to help:**
- Compare expected vs actual in scan metadata
- Check which sources succeeded/failed
- May resume scan or accept partial results
- Decision: Resume vs proceed with what we have

**Urgency:** Medium — May be acceptable depending on context

---

### 5. aggregation-failed
**What it means:** Merge process attempted but failed with error.

**Why it happens:**
- Schema conflicts not caught in validation
- Duplicate keys/IDs
- Memory exhaustion with large deliverables
- Tool bug

**How to help:**
- Check `.squad/deliverable/merged.json` for partial results
- Review error logs for merge failure
- May need to split deliverable or fix fragments
- Signal: "Report aggregation error details and fragments with conflicts"

**Urgency:** High — Failure after substantial work

---

### 6. aggregation-stalled
**What it means:** Merge in progress but not advancing.

**Why it happens:**
- Processing very large deliverable (may just be slow)
- Deadlock in merge logic
- Memory thrashing
- Tool hung

**How to help:**
- Check system resources (CPU, memory)
- Review aggregation progress percentage
- If < 1MB and stalled: likely hung, restart
- If > 10MB and slow: may be normal, wait longer

**Urgency:** Medium — May resolve itself

---

### 7. large-deliverable
**What it means:** Deliverable exceeds 10MB size threshold.

**Why it happens:**
- Very verbose fragment format
- Collecting more data than necessary
- Including large embedded content
- Many fragments

**How to help:**
- Review if all collected data is needed
- Consider compression
- Split into multiple deliverables
- Filter unnecessary fields

**Urgency:** Low — Warning, not blocker

---

## Interpreting Severity

**critical:** Team cannot proceed. Immediate intervention required.

**high:** Team blocked or at risk. Intervene within 10-20 minutes.

**medium:** Team impaired but may self-recover. Monitor closely.

**low:** Informational. No immediate action needed.

## Recovery Coordination

### When to Auto-Execute Recovery
- Low/medium severity with clear, safe actions
- Actions marked "immediate" priority
- Team explicitly requested help

### When to Request Team Input First
- High/critical severity (team needs to understand)
- Multiple recovery options available
- Recovery may lose work/data
- Unclear root cause

### Communicating Recovery Plans

**Bad:** "Fix the schema validation error."
**Good:** "Schema validation failed due to missing 'id' field in 3 fragments. Suggested recovery: Re-scan those sources with updated schema. Estimated time: 5 minutes. Should I initiate?"

**Bad:** "Your scan stalled."
**Good:** "Scanning paused after 12 fragments (expected 20). Last fragment was 15 minutes ago. Possible causes: tool crash, network timeout, or rate limiting. Please check scan logs and report current tool status."

## Example Triage Interpretation

```
TriageResult:
  category: schema-validation-failed
  severity: critical
  summary: Schema validation failed - missing required fields
  details: 3 of 15 fragments missing 'timestamp' field
  affectedResources: [fragment-005.json, fragment-009.json, fragment-012.json]
  suggestedActions:
    - action: Re-scan affected sources with corrected schema
      priority: immediate
      estimatedImpact: Resolves validation, enables aggregation
```

**Your interpretation:**

"🔴 CRITICAL: team-auth cannot complete due to schema validation failure.

**Problem:** 3 fragments (005, 009, 012) are missing the required 'timestamp' field.

**Impact:** Team is blocked in 'distilling' state. Cannot proceed to aggregation until fixed.

**Recommended recovery:**
1. Update schema to include 'timestamp' field for those data sources
2. Re-scan only the 3 affected sources (faster than full re-scan)
3. Re-run validation to confirm

**Estimated time:** 10 minutes to fix and rescan

Should I initiate the re-scan with updated schema?"

## Key Principles

1. Explain WHY the problem happened (educate, don't blame)
2. Recovery actions should be specific and actionable
3. Estimate time/impact to help meta-squad prioritize
4. Always offer to help execute recovery
5. Distinguish between "stuck and needs help" vs "slow but normal"
6. Learn from failures - suggest improvements to prevent recurrence

Turn diagnosis into recovery plan, problems into solutions.
