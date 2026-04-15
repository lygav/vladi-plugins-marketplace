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

## Key Knowledge

### Federation Architecture

**Structure:**
- Teams organized by domain (e.g., "ml", "infra", "frontend")
- Each team has a `domainId` (unique identifier within domain)
- Teams coordinate via signals across federation

**Placement vs Communication:**
- **Placement** is per-team — can mix WorktreePlacement and DirectoryPlacement in same federation
- **Communication** is federation-wide — all teams use same transport (FileSignalCommunication or TeamsCommunication)
- This allows heterogeneous placement strategies while maintaining unified communication

### Signal Protocol Architecture

**Core Components:**
- **SignalMessage** interface: from, to, type, subject, body, protocol, id, timestamp
- **Types**: directive (action request), question (need answer), report (status), alert (urgent)
- **Direction**: inbox (received), outbox (sent)
- **Storage**: JSON files in `.squad/inbox.json` and `.squad/outbox.json`
- **Acknowledgment**: explicit `acknowledgeSignal()` call (remove from inbox)

**v0.5.0 Addition: Teams Hashtags**
- `#meta` — federation-wide announcements
- `#meta-status` — status and health checks
- `#{teamId}` — team-specific channels

### Archetype System

**Purpose:**
- Template for team initialization
- Defines team lifecycle states and transitions
- Contains team-specific skills and behaviors
- Located in `plugins/squad-archetype-*/` directories

**Key Files:**
- `agent.yaml` — Agent definition for archetype
- `monitor.ts` — Archetype-specific monitoring logic (extends MonitorBase)
- `triage.ts` — Issue classification logic (extends TriageBase)
- `recovery.ts` — Automated recovery logic (extends RecoveryBase)

**Archetype Registry:**
- Teams have `archetypeId` field
- PlacementRegistry and CommunicationRegistry keyed by archetypeId
- Bootstrap uses archetypeId to instantiate correct placement

### Knowledge Management

**LearningEntry Types:**
- `discovery` — New insight about system/domain
- `correction` — Fix to previous understanding
- `pattern` — Reusable technique or architecture
- `technique` — How-to knowledge
- `gotcha` — Pitfall or edge case to watch

**Confidence Levels:**
- `low` — Uncertain, needs validation
- `medium` — Fairly confident, observed in practice
- `high` — Verified, proven in multiple contexts

**Domains:**
- Team-specific learning tagged with domain
- 'generalizable' domain for federation-wide patterns
- Enables cross-team learning without losing context

**Graduation:**
- Learning entries can be marked `graduated: true`
- `graduated_to` field links to skill or documentation location
- Tracks when knowledge moves from learning log to permanent system

## Archetype Research Findings

### Current Archetypes
- **squad-archetype-ml-team** — ML domain (monitor, triage, recovery)
- **squad-archetype-infra-team** — Infrastructure (monitor, triage, recovery)
- **squad-archetype-[others]** — Additional domain-specific implementations

### Pattern: Extensible Monitoring
- `MonitorBase` abstract class with `monitor(teamId): Promise<MonitorResult>`
- Archetype implements domain-specific health checks
- Results aggregated by orchestration layer
- Metrics emitted via OTel

### Pattern: Intelligent Triage
- `TriageBase` abstract class with `triage(issue): Promise<TriageResult>`
- Classify issues by type, severity, automatable
- Output feeds recovery system

### Pattern: Automated Recovery
- `RecoveryBase` abstract class with `recover(issue): Promise<RecoveryResult>`
- Implement fix logic for known issue patterns
- Fallback: escalate unrecognizable issues

## SDLC Rules
1. **Document as you design** — protocol changes need docs
2. **Signal flow is critical** — test end-to-end signal routing
3. **Attribution matters**: Co-authored-by trailers
4. **Ground truth from code** — verify implementation against documentation

## Known Protocols
- v0.5.0: Teams channel hashtag protocol
- v0.4.0+: JSON file signals in .squad/ directories
- Future: gRPC signals (planned, not implemented)
