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
- Test coverage for implementations

## Key Knowledge

### SDK Types & Interfaces
- **TeamPlacement**: Workspace mgmt, file I/O, bootstrap, optional worktree operations
- **TeamCommunication**: Status, signals (inbox/outbox), learning log (append-only JSONL)
- **TeamContext**: Domain info + placement & communication adapters
- **SignalMessage**: Type (directive/question/report/alert), protocol, routing
- **LearningEntry**: Type (discovery/correction/pattern/technique/gotcha), confidence, tags

### Placement/Communication Split
- **Placement** (per-team): WHERE files live — DirectoryPlacement, WorktreePlacement
- **Communication** (federation-scoped): HOW signals flow — FileSignalCommunication, TeamsCommunication
- Design pattern: get placement from registry, get communication from registry
- Each TeamContext has both adapters injected

### Lib Module Structure
1. **placement/** - DirectoryPlacement, WorktreePlacement implementations
2. **communication/** - FileSignalCommunication, TeamsCommunication
3. **registry/** - PlacementRegistry, CommunicationRegistry, TeamRegistry
4. **knowledge/** - LearningLog class for append-only operations
5. **orchestration/** - Agent coordination logic
6. **config/** - Config loading and validation (FederateConfig with Zod)
7. **telemetry/** - OTelEmitter for metrics/spans/events

### Adapter Registry Pattern
- `PlacementRegistry.register(archetypeId, factory)` maps archetype to implementation
- `CommunicationRegistry.register(archetypeId, factory)` same for communication
- Factory pattern: `(archetypeId: string) => TeamPlacement | TeamCommunication`
- Lookup: `registry.get(archetypeId)` returns concrete implementation

### Model Choice
- **Use**: claude-sonnet-4.5 for SDK work
- **Don't use**: codex models — too slow for iterative dev
- Prefer streaming + incremental implementation

## Implementation Patterns

### File Operations
All placement implementations must provide:
```
exists(teamId, path): Promise<boolean>
read(teamId, path): Promise<string>
write(teamId, path, content): Promise<void>
delete(teamId, path): Promise<void>
list(teamId, dirPath): Promise<string[]>
bootstrap(teamId): Promise<void>  // Create .squad/ structure
```

### Signal Protocol
- Signals stored as JSON arrays in `.squad/inbox.json` and `.squad/outbox.json`
- Each signal has: id, timestamp, from, to, type, subject, body, protocol
- Types: directive, question, report, alert
- Acknowledgment: explicit `acknowledgeSignal(teamId, signalId)` call

### Learning Log (Append-Only)
- Format: JSONL (one JSON object per line) in `.squad/learning.jsonl`
- Never overwrite — always append
- Each entry: id, ts, version, type, agent, tags, title, body, confidence
- Support `readLearningLog()` and `appendLearning()` methods

## SDLC Rules
1. **Docs in same PR** — if you implement a feature, update docs
2. **Zod over TypeScript** — schemas are source of truth
3. **Contract tests** — verify MockPlacement/MockCommunication against interface
4. **Idempotent bootstrap** — running bootstrap twice on same team is safe
5. **Attribution**: Use Co-authored-by trailers

## Testing Strategy
- Unit tests: use MockPlacement, MockCommunication
- Integration tests: real file system (test directory)
- Contract tests: verify interface compliance across implementations
- Round-trip tests: signal write → read → acknowledge
