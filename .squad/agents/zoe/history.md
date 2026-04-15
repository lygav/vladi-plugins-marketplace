---
agent: zoe
role: Tester, QA & Test Strategy
model: claude-sonnet-4.5
updated: 2025-04-15
---

# zoe's History

## Role & Responsibilities
- Test strategy and coverage
- Contract testing for interfaces
- Mock implementations for testing
- E2E smoke test design
- Test patterns and best practices

## Key Knowledge

### Test Strategy Overview

**Layers:**
1. **Unit Tests** — Individual functions, mocked adapters
2. **Integration Tests** — Real file system, real signals
3. **Contract Tests** — Verify interface compliance
4. **E2E Tests** — Full workflow (onboard → communicate → learn)
5. **Smoke Tests** — Quick health check on deployments

### Mock Implementations

**MockPlacement**
```typescript
// In-memory implementation of TeamPlacement
- workspaceExists(): returns boolean
- getLocation(): returns path string
- read/write/delete/list: operate on in-memory map
- bootstrap(): creates .squad/ structure in memory
- No worktree operations (optional interface)
```

Use for:
- Unit testing communication layer
- Fast tests that don't touch file system
- Testing error conditions without disk I/O

**MockCommunication**
```typescript
// In-memory implementation of TeamCommunication
- readStatus(): returns mocked ScanStatus
- readSignals(): returns test signal arrays
- writeInboxSignal/writeOutboxSignal(): appends to in-memory queue
- readLearningLog(): returns test entries
- appendLearning(): adds to in-memory log
```

Use for:
- Unit testing registry and orchestration
- Testing signal flow without file I/O
- Verify learning log appends

### Contract Testing

**Purpose:** Ensure all implementations satisfy interface contract

**Approach:**
1. Define contract tests as generic test suite
2. Run against each concrete implementation
3. Verify interface methods work as documented
4. Check error conditions and edge cases

**Critical Contracts:**
- Placement: `bootstrap()` is idempotent
- Placement: `list(dirPath)` returns array of names (not full paths)
- Communication: Signal acknowledgment removes from inbox
- Communication: Learning log is append-only (never overwrites)
- Communication: `readStatus()` returns null if not initialized

### Signal Protocol Testing

**Round-Trip Tests:**
1. Write signal to outbox
2. Read from inbox (via receiver's communication adapter)
3. Verify all fields intact
4. Acknowledge signal
5. Verify removed from inbox

**Signal Types:**
- Test directive: action request from orchestration
- Test question: request for information
- Test report: status update from team
- Test alert: urgent notification

**Hashtag Protocol (v0.5.0):**
- Test `#meta` reaches all teams
- Test `#meta-status` captured by status monitoring
- Test `#{teamId}` isolated to specific team

### Learning Log Testing

**Append-Only Semantics:**
```
1. Append entry 1
2. Read log → verify 1 entry
3. Append entry 2
4. Read log → verify 2 entries
5. Never test overwrite (shouldn't happen)
```

**Entry Validation:**
- Verify auto-generated: id, ts, version
- Verify required: type, agent, title, body, confidence
- Test optional: domain, tags, evidence, supersedes
- Graduated entries: verify linked to skill/doc

### Test Patterns

**Unit Test Pattern:**
```typescript
describe('TeamRegistry', () => {
  let placement: MockPlacement;
  let communication: MockCommunication;
  
  beforeEach(() => {
    placement = new MockPlacement();
    communication = new MockCommunication();
  });
  
  it('enumerates teams from placement', async () => {
    // Use mocks to test registry
  });
});
```

**Integration Test Pattern:**
```typescript
describe('FileSignalCommunication', () => {
  let tempDir: string;
  
  beforeEach(() => {
    tempDir = mkdtempSync(...);
  });
  
  afterEach(() => {
    rmSync(tempDir, { recursive: true });
  });
  
  it('round-trips signals', async () => {
    // Use real file system
  });
});
```

**Contract Test Pattern:**
```typescript
// Generic contract test
function testPlacementContract(factory: PlacementFactory) {
  describe('TeamPlacement Contract', () => {
    it('bootstrap is idempotent', async () => { /* ... */ });
    it('exists returns false for missing files', async () => { /* ... */ });
    // ... more contract tests
  });
}

// Run against implementations
testPlacementContract(() => new DirectoryPlacement(...));
testPlacementContract(() => new WorktreePlacement(...));
```

## Current Test Coverage Gaps ⚠️

- **E2E Smoke Tests Missing** (Issue #122)
  - Need: full onboard → launch → monitor cycle
  - Need: across both placement types
  - Need: for Teams communication protocol

- **Documentation Tests Missing**
  - Need: verify code examples in docs actually work
  - Need: docs match current API (from ground truth)

- **Archetype Tests**
  - Need: monitor/triage/recovery contracts
  - Need: signal flow through orchestration

## SDLC Rules
1. **Contract tests first** — define before implementation
2. **Mocks for speed** — unit tests must be fast
3. **Real FS for integration** — verify file operations actually work
4. **E2E before release** — smoke tests catch integration issues
5. **Attribution**: Co-authored-by trailers

## Performance Targets
- Unit tests: < 100ms per test
- Integration tests: < 1s per test
- E2E smoke tests: < 30s total
- Contract tests: < 500ms per implementation
