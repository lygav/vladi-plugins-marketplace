---
title: Architecture Overview
description: Three-layer architecture, placement abstractions, and core design principles
---

# Architecture Overview

squad-federation-core is a Copilot plugin that enables federated multi-team coordination. A **meta-squad** orchestrates N permanent **domain squads** via placement and communication abstractions. Teams live in git worktrees or directories (placement) and communicate via file-based signals (communication). The adapter registry allows custom transports without changing existing code.

## Core Pillars

1. **Placement Abstraction** — Teams can live in worktrees, directories, or remote systems. Where a team lives is independent of how it communicates.
2. **Communication Abstraction** — Teams communicate via file signals (default) or custom adapters registered in the adapter registry. Protocol is pluggable, federation-scoped.
3. **SDK Foundation** — Shared types/interfaces at `sdk/` enable archetype development as proper plugin extensions.
4. **Meta/Team Separation** — Archetypes cleanly separate orchestration concerns (meta) from execution concerns (team).
5. **Hybrid Monitoring** — Scripts collect mechanical data → skills interpret and present insights.
6. **Convention-Based Discovery** — Filesystem conventions reduce configuration overhead.
7. **Dynamic Archetype Discovery** — Archetypes auto-discovered from marketplace.json + filesystem at runtime.
8. **Two-Mode Onboarding** — Conversational (interactive discovery) + Mechanical (autonomous setup).

## Design Principles

- **Core agnostic** — Core never imports archetype code. Zero coupling.
- **Open/Closed** — New archetypes extend the system without modifying core.
- **Interface-driven** — TypeScript contracts enforce archetype API.
- **Location-neutral** — Team placement abstracted behind `TeamPlacement` interface.
- **Protocol-neutral** — Team communication abstracted behind `TeamCommunication` interface.
- **Adapter registry** — Communication adapters register at runtime.
- **Start empty, add what's needed** — Onboarding creates minimal bootstrap, not kitchen-sink template.

## Three-Layer Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  CORE LAYER — squad-federation-core plugin                         │
│                                                                      │
│  SDK (types, placement, communication, base classes) · Team registry   │
│  Signal protocol · Learning log · Launch mechanics                      │
│  OTel MCP server · Skill sync engine · Hybrid monitoring                │
│                                                                          │
│  Placement-agnostic and protocol-agnostic. Knows nothing about what     │
│  teams do — only how they communicate, observe, and share knowledge.   │
├──────────────────────────────────────────────────────────────────────┤
│  ARCHETYPE LAYER — e.g. squad-archetype-deliverable                │
│                                                                      │
│  Meta: Orchestration skills · Aggregation scripts · Monitoring       │
│  Team: Execution agents · Playbook skills · Cleanup hooks            │
│  Archetype manifest (states, monitor config, triage, recovery)       │
│                                                                      │
│  Defines the WORK PATTERN for a class of squads. Installed into      │
│  teams during onboarding. Multiple archetypes can coexist in         │
│  a single federation.                                                │
├──────────────────────────────────────────────────────────────────────┤
│  PROJECT LAYER — your repository                                   │
│                                                                      │
│  .squad/teams.json (team registry) · DOMAIN_CONTEXT.md per team      │
│  federate.config.json · Project-specific MCP servers · Custom skills │
│                                                                      │
│  Binds the federation to a concrete codebase and problem domain.     │
└──────────────────────────────────────────────────────────────────────┘
```

## Runtime Topology

### WorktreePlacement Example

```
~/project/ (main branch — meta-squad)
├── .squad/
│   ├── teams.json               ← team registry (source of truth)
│   ├── skills/                  ← authoritative skills
│   └── learnings/log.jsonl      ← cross-cutting patterns
├── federate.config.json         ← federation plumbing config
│
├── project-team-alpha/          ← persistent worktree → squad/team-alpha
│   ├── .squad/
│   │   ├── archetype.json       ← archetype manifest (meta + team)
│   │   ├── signals/             ← IPC with meta-squad
│   │   ├── learnings/           ← domain-specific discoveries
│   │   └── skills/              ← synced from main + local extensions
│   └── DOMAIN_CONTEXT.md
│
├── project-team-beta/           ← persistent worktree → squad/team-beta
│   └── (same structure)
│
└── project-team-gamma/          ← persistent worktree → squad/team-gamma
    └── (same structure)
```

### DirectoryPlacement Example

```
~/project/ (meta-squad)
├── .squad/
│   ├── teams.json               ← team registry
│   ├── skills/                  ← authoritative skills
│   └── learnings/log.jsonl
├── federate.config.json
│
└── .squad-teams/                ← standalone team directories
    ├── team-alpha/
    │   ├── .squad/
    │   │   ├── archetype.json
    │   │   ├── signals/
    │   │   ├── learnings/
    │   │   └── skills/
    │   └── DOMAIN_CONTEXT.md
    │
    ├── team-beta/
    └── team-gamma/
```

## Team Placement & Communication

Team location and communication protocol are independent, composable abstractions.

### TeamPlacement Interface

Abstracts **where** team files live. Defined in `sdk/placement.ts`:

```typescript
export interface TeamPlacement {
  readFile(teamId: string, filePath: string): Promise<string | null>;
  writeFile(teamId: string, filePath: string, content: string): Promise<void>;
  exists(teamId: string, filePath: string): Promise<boolean>;
  workspaceExists(teamId: string): Promise<boolean>;
  getLocation(teamId: string): Promise<string>;
  listFiles(teamId: string, directory?: string): Promise<string[]>;
  bootstrap(teamId: string, archetypeId: string, config: Record<string, unknown>): Promise<void>;
}
```

### TeamCommunication Interface

Abstracts **how** teams receive signals. Defined in `sdk/communication.ts`:

```typescript
export interface TeamCommunication {
  readStatus(teamId: string): Promise<ScanStatus | null>;
  readInboxSignals(teamId: string): Promise<SignalMessage[]>;
  writeInboxSignal(teamId: string, signal: SignalMessage): Promise<void>;
  readOutboxSignals(teamId: string): Promise<SignalMessage[]>;
  readLearningLog(teamId: string): Promise<LearningEntry[]>;
  appendLearning(teamId: string, entry: LearningEntry): Promise<void>;
}
```

**Key design:** Placement knows WHERE teams live. Communication knows HOW they receive signals. Neither is tightly coupled.

For complete interface details, see [SDK Types](/vladi-plugins-marketplace/reference/sdk-types).

### Placement Implementations

**WorktreePlacement** (`lib/placement/worktree-placement.ts`) — Git worktree adapter. Teams live on permanent `squad/{team-name}` branches with independent `.squad/` directories. Worktrees share git object store (disk-efficient) but have fully independent working directories.

**DirectoryPlacement** (`lib/placement/directory-placement.ts`) — Standalone directory adapter. Teams exist in `.squad-teams/{teamName}/`. No git required—works in monorepos, cloud sync, etc.

### Adapter Registry

Communication adapters register at runtime:

```typescript
const registry = new CommunicationRegistry(config);
registry.register('file-signal', FileSignalCommunication);
const adapter = registry.get('file-signal');
```

Adding a new communication adapter requires:
1. Implement `TeamCommunication` interface
2. Call `registry.register(name, implementation)` during bootstrap
3. No changes to core scripts, signals, or knowledge lifecycle

### Context Factory

`lib/orchestration/context-factory.ts` composes placement + communication at runtime:

```typescript
export function createTeamContext(
  team: TeamMetadata,
  placementType: string,
  config: FederateConfig
): TeamContext {
  const placement = selectPlacement(placementType, config);
  const communication = new FileSignalCommunication(placement);
  return { domain: team.domain, placement, communication, /* ... */ };
}
```

A federation can have mixed placement types and communication adapters.

## Git Mechanics (WorktreePlacement)

This section applies **only** to WorktreePlacement.

### Branch Naming

All domain branches follow `squad/{team-name}`:

```
main                        ← meta-squad: skills, aggregation, governance
squad/team-alpha             ← permanent domain branch
squad/team-beta              ← permanent domain branch
```

### No-Merge-Back Principle

Domain branches **never** merge back to main. Knowledge flows via:
- Graduation proposals (domain → main learning log → main skill)
- Signal outbox reports (meta-squad reads)
- Cross-read: `git show squad/team-alpha:.squad/learnings/log.jsonl`

The main branch reads FROM domain branches. Domain branches receive skill updates via cherry-pick sync, never via `git merge main`.

### Isolation Model

Each worktree has independent:
- **Archetype manifest** — states, monitor config, triage, recovery
- **Skills** — seeded from main at creation, synced periodically
- **Learnings** — independent append-only log per domain
- **Signals** — independent inbox/outbox/status per domain
- **Agents** — independently cast team per domain

Multiple domain sessions run concurrently with zero coordination overhead.

## Ceremony Protocol

Ceremonies are structured coordination points triggered by squad state transitions.

### CeremonyDefinition Interface

```typescript
interface CeremonyDefinition {
  name: string;
  trigger: {
    when: 'before' | 'after' | 'manual';
    condition: string;
  };
  facilitator: string;
  participants: string[];
  agenda: string[];
  outputs: string[];
}
```

### Built-In Templates

**pre-task-triage** — Scope setting before first run:
- Review domain context and project description
- Read all seeded skills
- Identify data sources and access requirements
- Draft work breakdown by agent
- Set quality criteria

**knowledge-check** — Pre-rescan review:
- Review existing deliverables and learnings
- Check inbox for meta-squad updates
- Acknowledge pending inbox messages
- Identify gaps and set priorities

**task-retro** — Reflection after completion:
- Review deliverable quality
- Surface learnings from this run
- Tag generalizable patterns for graduation
- Write retro report to outbox
- Update skill extensions if new patterns discovered

### Ceremony Seeding

During onboarding, `generateCeremoniesMarkdown()` produces `.squad/ceremonies.md` from ceremony definitions. This markdown is included in the squad's context so agents know when and how to run each ceremony.

## Related Pages

- [SDK Types](/vladi-plugins-marketplace/reference/sdk-types) — Core interfaces and data schemas
- [Signal Protocol](/vladi-plugins-marketplace/reference/signal-protocol) — Inter-team communication details
- [Configuration](/vladi-plugins-marketplace/reference/configuration) — Config schema and team registry
- [Launch Mechanics](/vladi-plugins-marketplace/reference/launch-mechanics) — Headless session launching
- [Archetype System](/vladi-plugins-marketplace/reference/archetype-system) — Work patterns and state machines
- [Design Decisions](/vladi-plugins-marketplace/reference/design-decisions) — Key architectural choices
- [Communication Transports](/vladi-plugins-marketplace/guides/communication-transports) — File signals guide
- [Knowledge Lifecycle](/vladi-plugins-marketplace/guides/knowledge-lifecycle) — Seed, sync, graduate flows
- [Monitoring](/vladi-plugins-marketplace/guides/monitoring) — Hybrid monitoring guide
- [Team Onboarding](/vladi-plugins-marketplace/guides/team-onboarding) — Onboarding patterns
