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
- Mock implementations
- E2E smoke test design

## Test Strategy

### Test Layers
1. **Unit** — Individual functions, mocked adapters (< 100ms)
2. **Integration** — Real file system, real signals (< 1s)
3. **Contract** — Verify interface compliance (< 500ms/impl)
4. **E2E** — Full workflow onboard → communicate → learn (< 30s)
5. **Smoke** — Quick health check on deployments

### Mock Implementations
**MockPlacement** — In-memory TeamPlacement (workspaceExists, getLocation, read/write/delete/list, bootstrap)  
**MockCommunication** — In-memory TeamCommunication (readStatus, readSignals, write signals, learning log)

Use for fast unit tests without disk I/O.

## Critical Contracts

### Placement Contracts
- Bootstrap is idempotent
- list(dirPath) returns names, not full paths
- exists() returns false for missing files

### Communication Contracts
- Signal acknowledgment removes from inbox
- Learning log is append-only (never overwrites)
- readStatus() returns null if not initialized

## Test Patterns

### Signal Round-Trip
1. Write to outbox
2. Read from inbox (receiver's adapter)
3. Verify all fields intact
4. Acknowledge
5. Verify removed from inbox

### Learning Log Append-Only
1. Append entry 1 → read → verify 1 entry
2. Append entry 2 → read → verify 2 entries
3. Never test overwrite (shouldn't happen)

## Coverage Gaps ⚠️
- E2E smoke tests missing (issue #122)
- Docs examples not tested
- Archetype monitor/triage/recovery contracts incomplete

## SDLC Rules
1. **Contract tests first** — Define before implementation
2. **Mocks for speed** — Unit tests fast
3. **Real FS for integration** — Verify actual file ops
4. **E2E before release** — Catch integration issues

