---
name: consultant-monitoring
description: "Interpret consultant monitoring data — explain team status, health, and progress. Triggers on: monitor consultant, consultant status, check consultant teams."
version: 0.1.0
---

# Consultant Monitoring

You interpret mechanical monitoring data from the `consultant-monitor.ts` script and present human-readable insights.

## Triggers

- "monitor consultant"
- "consultant status"
- "check consultant teams"
- "consultant dashboard"

## Input

The monitor script outputs JSON with this structure:

```json
{
  "teams": [
    {
      "domain": "team-name",
      "domainId": "team-id",
      "state": "onboarding|indexing|ready|researching|waiting-for-feedback",
      "health": "healthy|stalled|failed",
      "progressPct": 50,
      "metadata": {
        "questionsAnswered": 12,
        "lastQuestionAt": "2025-04-13T10:30:00Z",
        "domainCoverage": "deep",
        "learningsCount": 47,
        "idleSinceMinutes": 5,
        "currentQuestion": "How does authentication work?"
      }
    }
  ],
  "summary": {
    "total": 5,
    "active": 3,
    "retired": 1,
    "failed": 1,
    "stalled": 0
  }
}
```

## Output Format

For each team, explain:

1. **What they're doing** — Current state in human terms
2. **Question load** — How many questions answered, when last active
3. **Knowledge depth** — Domain coverage and learnings accumulated
4. **Health status** — Any red flags or stalls
5. **Next steps** — What to expect next

Example:

> **Team: auth-service** 🟢
> - **State**: ready (steady state)
> - **Activity**: 12 Q&A | last question 5min ago
> - **Knowledge**: deep coverage | 47 learnings
> - **Health**: Healthy — active and responsive
>
> **Team: payments** ⚠️
> - **State**: indexing (75% complete)
> - **Activity**: 0 Q&A | indexing for 25min
> - **Knowledge**: moderate coverage | 18 learnings
> - **Health**: Warning — indexing longer than expected
> - **Action**: Monitor for stuck state if > 30min
>
> **Team: infrastructure** ⏸️
> - **State**: ready
> - **Activity**: 3 Q&A | idle for 7 days
> - **Knowledge**: surface coverage | 12 learnings
> - **Health**: Stale — consider retiring or refreshing
> - **Action**: Retire if no longer needed, or refresh knowledge

## Summary

Provide aggregate insights:

> **Federation Summary**
> - ✅ 1 consultant retired
> - 🟢 2 consultants active and healthy
> - ⚠️ 1 consultant indexing (monitor for completion)
> - ⏸️ 1 consultant idle (stale)
> - 📊 Overall: 35 total Q&A answered across all consultants
