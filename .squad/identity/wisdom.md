---
type: wisdom
version: "0.5.0"
last_updated: 2025-04-15
---

# Team Wisdom: vladi-plugins-marketplace

## Architectural Principles

### Placement vs Communication (Key Separation)

**Placement** = WHERE files live (per-team, mix-and-match)
- `TeamPlacement` interface: workspace mgmt, file I/O, bootstrap
- Implementations: `DirectoryPlacement`, `WorktreePlacement`
- Each team can use different placement types

**Communication** = HOW teams exchange signals (federation-scoped, single strategy)
- `TeamCommunication` interface: status, signals, learning log
- Implementations: `FileSignalCommunication`, `TeamsCommunication`
- All teams in a federation use same communication type
- Signal protocol: inbox/outbox JSON files with signal types (directive, question, report, alert)

### Adapter Registry Pattern

Extensible transport design:
- `PlacementRegistry` for placement implementations
- `CommunicationRegistry` for communication implementations
- Lookup by `archetypeId`: `placement.get(archetypeId)` returns concrete implementation
- Enables adding new transports without changing core

### Modular Library Structure

`scripts/lib/` contains 7 production modules:
1. **placement/** - Workspace/file management
2. **communication/** - Signal exchange & status
3. **registry/** - Team enumeration & lookup
4. **knowledge/** - Learning log management
5. **orchestration/** - Agent coordination
6. **config/** - Configuration management
7. **telemetry/** - OpenTelemetry wrapper

### TeamRegistry is Single Source of Truth

- `team-registry.ts` enumerates teams from placement
- `getTeams()` returns `TeamContext` objects with placement + communication adapters
- Contract: placement must have `getLocation(teamId)` to build team list
- This is how scripts discover which teams exist

### Script Architecture

Scripts are thin CLI wrappers:
- `onboard.ts` - Team initialization
- `launch.ts` - Start agent operations
- `monitor.ts` - Health checks
- `sweep.ts` - Batch signal processing
- `graduate.ts` - Team transition
- `sync.ts` - Federation state sync

Each script instantiates registries, gets teams, calls lib functions.

## Conventions & Rules

### Signal Protocol

- **Types**: directive (request action), question (need answer), report (status update), alert (urgent)
- **Hashtag markers** in Teams: `#meta` (federation), `#meta-status` (status channel), `#{teamId}` (team-specific)
- Signals written to `.squad/inbox.json` and `.squad/outbox.json`

### Knowledge Management

**LearningEntry** types:
- `discovery`: New insight
- `correction`: Fix to previous understanding
- `pattern`: Reusable technique
- `technique`: How-to knowledge
- `gotcha`: Pitfall to avoid

Confidence levels: low, medium, high  
Domain field: 'generalizable' for cross-team learnings

### No Migrations, No Backward Compat

- Pre-1.0 versioning: breaking changes are OK
- Each new version can change SDK interfaces, schemas, file formats
- Teams re-initialize on version bump (bootstrap handles setup)

### Docs Live With Code

- Documentation updates in SAME PR as code changes
- Ground truth scan reveals what code actually does
- Never let docs drift from implementation

### Interface Factories Must Be Universal

**Critical code review lesson:**
- When designing factory methods (e.g., `createPlacement(archetypeId)`)
- Params must be universal across ALL implementations
- Don't add adapter-specific params to factory signature
- Use TypeScript generics or separate factory methods for custom config

### Test Patterns

- `MockPlacement` and `MockCommunication` for unit tests
- Contract tests verify interface compliance
- Signal protocol: test that messages round-trip correctly
- Learning log: test append-only semantics

## Active Patterns to Preserve

- Zod schemas as source of truth (not TypeScript types)
- OTel emitter: no-op when not configured, best-effort export
- Abstract base classes for archetype-specific logic (MonitorBase, TriageBase, RecoveryBase)
- Team bootstrap: idempotent `.squad/` directory creation
- Signal acknowledgment: explicit `acknowledgeSignal()` method

## Anti-Patterns to Avoid

- Tight coupling between placement and communication
- Adding archetype-specific params to generic factory methods
- Documentation that doesn't match code reality
- Backward compatibility promises before v1.0
