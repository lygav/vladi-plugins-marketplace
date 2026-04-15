---
agent: wash
role: Researcher, Federation & Signals
model: claude-sonnet-4.5
updated: 2025-04-15
---

# wash's History

## Role & Responsibilities
- Federation architecture research
- Signal protocol design and documentation
- Archetype pattern analysis
- Knowledge management system design

## Federation Architecture

### Structure
- Teams organized by domain (unique domainId)
- Teams coordinate via signals
- **Placement** is per-team (can mix WorktreePlacement and DirectoryPlacement)
- **Communication** is federation-wide (all teams use same transport)

### Signal Protocol (v0.5.0)
- **Types:** directive (action), question (need answer), report (status), alert (urgent)
- **Direction:** inbox (received), outbox (sent)
- **Storage:** JSON files in `.squad/inbox.json` and `.squad/outbox.json`
- **Acknowledgment:** explicit `acknowledgeSignal()` call
- **Teams hashtags:** #meta (federation), #meta-status (status), #{teamId} (team-specific)

### Archetype System
**Purpose:** Template for team initialization with lifecycle states, skills, behaviors

**Key Files:**
- `agent.yaml` — Agent definition
- `monitor.ts` — Extends MonitorBase
- `triage.ts` — Extends TriageBase  
- `recovery.ts` — Extends RecoveryBase

**Registry:** PlacementRegistry and CommunicationRegistry keyed by archetypeId

### Knowledge Management
**LearningEntry Types:** discovery, correction, pattern, technique, gotcha  
**Confidence:** low, medium, high  
**Domains:** Team-specific or 'generalizable'  
**Graduation:** Mark `graduated: true`, link to skill/doc via `graduated_to`

## Archetype Patterns
- **MonitorBase** — Domain-specific health checks
- **TriageBase** — Issue classification (type, severity, automatable)
- **RecoveryBase** — Automated fix logic with fallback escalation

## SDLC Rules
1. **Document protocols** — Signal flow needs end-to-end docs
2. **Test signal routing** — Verify round-trip delivery
3. **Ground truth from code** — When unsure, scan implementation

