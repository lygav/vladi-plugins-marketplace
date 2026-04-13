---
name: deliverable-monitoring
description: >
  Interpret deliverable team monitoring data and present actionable insights.
  Use when meta-squad needs to understand deliverable team health and progress.
when_to_use: >
  - User asks about deliverable team status
  - Presenting deliverable monitoring dashboard
  - Explaining fragment collection progress
  - Assessing deliverable health
  - Recommending interventions
---

# Deliverable Monitoring — Interpretation Skill

You receive structured monitoring data from the deliverable-monitor.ts script. Your role is to **interpret** this data and help the meta-squad understand what is happening with deliverable teams.

## Data You Receive

The monitor script provides deliverable-specific metrics plus standard monitoring fields.

### Deliverable Metrics
- fragmentCount: Number of fragments collected
- totalFragments: Expected total (if known)
- schemaVersion: Schema version being used
- deliverableSize: Total size in bytes
- validationStatus: pending | valid | invalid
- lastFragmentAt: Timestamp of last fragment
- aggregationProgress: Merge progress percentage
- mergedStatus: not_started | in_progress | complete | failed

### Standard Fields
- state: Current state (preparing, scanning, distilling, aggregating)
- health: healthy | stalled | failed
- progress: Overall progress
- lastUpdate: Last status update timestamp
- error: Error message if failed

## Interpretation Guide

### Fragment Collection Assessment

**Growing fragment count:**
- Normal operation
- Report: "Team actively scanning. Collected X fragments so far"
- If totalFragments known: "Progress: X/Y fragments (Z%)"

**Stalled fragment count:**
- Warning after 10 minutes
- Context matters: May be processing/distilling (normal) vs stuck (problem)
- Wait 10m before alerting

**No fragments in scanning state:**
- Alert immediately
- Indicates configuration error or tool failure
- Suggest: Check scan logs, verify config

### Schema Validation

**pending:** Normal during scanning. Concern only if in aggregating state.

**valid:** All good. Safe to proceed with aggregation.

**invalid:** CRITICAL - blocks completion. Team cannot aggregate. Immediate intervention required.

### State-Specific Expectations

**preparing:** 0 fragments expected. Duration: 1-2 minutes.

**scanning:** 
- Healthy: New fragments every 30-120 seconds
- Concern: No new fragments for 10+ minutes  
- Critical: No fragments after 30+ minutes

**distilling:**
- Fragment collection complete
- No new fragments expected (normal)
- Should transition to aggregating within 5-10m

**aggregating:**
- Monitor mergedStatus and aggregationProgress
- Healthy: Progress increasing
- Critical: mergedStatus failed

### Deliverable Size

- < 1MB: Normal
- 1-10MB: Acceptable
- > 10MB: Review for verbosity, consider splitting

### Intervention Timing

**WAIT (0-10 min):**
- Scanning with growing fragments
- Distilling without errors
- Aggregating with progress
- Normal pauses

**MONITOR (10-20 min):**
- Stalled progress
- Large deliverables
- Validation pending in late states

**INTERVENE (20+ min or critical):**
- Prolonged stalls
- validation: invalid
- merged: failed
- Errors present
- No fragments after 30m scanning

## Example Interpretations

Healthy:
✅ team-api: scanning | 45% | 12/20 fragments | 2.4MB | last: 2m ago
→ "Healthy. Actively collecting at steady pace. ETA ~8 minutes"

Warning:
⚠️ team-auth: scanning | 30% | 6 fragments | last: 12m ago  
→ "Paused but within normal range. Monitor 5-10m before intervening"

Critical:
🔴 team-db: aggregating | 75% | schema: invalid | merged: failed
→ "CRITICAL - Schema validation failed. Cannot complete. Fix fragments immediately"

## Recovery Prompts

When you need team input, suggest these signals:

Status check: "Please report current step, progress, and any blockers"
Detail request: "How many fragments collected? Any errors during scanning?"
Recovery: "Restart scanning from last checkpoint. Report when fragments resume"

## Key Principles

1. Scripts provide facts, you provide meaning
2. Timing matters: 0-5m wait, 5-10m monitor, 10-20m prepare, 20+ intervene
3. State determines expectations
4. Invalid validation always triggers intervention
5. Communicate with empathy - problems are learning opportunities

Turn data into insight, insight into action.
