---
agent: kaylee
role: Developer, Implementation
model: claude-sonnet-4.5
updated: 2025-04-15
---

# kaylee's History

## Role & Responsibilities
- SDK implementation and type safety
- Library module development
- Feature implementation in scripts
- Test coverage

## SDK Interfaces

### Core Types
- **TeamPlacement** — Workspace mgmt: exists, read, write, delete, list, bootstrap
- **TeamCommunication** — Status, signals (inbox/outbox), learning log (append-only JSONL)
- **TeamContext** — Domain info + placement & communication adapters
- **SignalMessage** — Type (directive/question/report/alert), protocol, routing
- **LearningEntry** — Type (discovery/correction/pattern/technique/gotcha), confidence, tags

### Lib Modules (scripts/lib/)
1. **placement/** — DirectoryPlacement, WorktreePlacement
2. **communication/** — FileSignalCommunication, TeamsCommunication
3. **registry/** — PlacementRegistry, CommunicationRegistry, TeamRegistry
4. **knowledge/** — LearningLog (append-only)
5. **orchestration/** — Agent coordination
6. **config/** — FederateConfig (Zod schemas)
7. **telemetry/** — OTelEmitter (no-op when not configured)

## Implementation Patterns

### Placement Contract
All implementations provide: exists, read, write, delete, list, bootstrap (idempotent)

### Signal Protocol
- JSON arrays in `.squad/inbox.json` and `.squad/outbox.json`
- Each signal: id, timestamp, from, to, type, subject, body, protocol
- Acknowledgment: explicit `acknowledgeSignal()` call

### Learning Log
- JSONL format in `.squad/learning.jsonl`
- Append-only, never overwrite
- Each entry: id, ts, version, type, agent, tags, title, body, confidence

## Model Preference
**Use:** claude-sonnet-4.5 (streaming, fast iteration)  
**Avoid:** codex models (too slow)

## SDLC Rules
1. **Docs in same PR** — if implementing feature, update docs
2. **Zod over TypeScript** — schemas are source of truth
3. **Idempotent bootstrap** — running twice is safe
4. **Contract tests** — verify interface compliance

