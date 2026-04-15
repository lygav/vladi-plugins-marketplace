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

## Session Learnings — 2026-04-15

**Testing Gaps Exposed**  
Import path bugs (#121, #137) slipped past test suites—tests import functions directly, bypassing module resolution checks. Runtime failures only appeared in actual deployments. **Action:** tsc --noEmit as CI gate to catch ESM/CJS mismatches early. E2e smoke tests missing: running each entry-point script with `--help` would have surfaced 4 bugs instantly. Created #122 for TypeScript compile check + smoke test harness.

**Test Patterns Working Well**  
MockPlacement + MockCommunication are fast, reliable unit-test replacements for disk I/O. MockTeamsClient enables full Teams adapter testing without API calls. Contract tests across file-signal and teams-channel implementations caught interface compliance issues effectively. Bug found: otel-emitter span() needed generic return type—tests DO catch implementation bugs when written correctly.

**Tests Can't Catch**  
- ESM/CJS module boundary issues (need tsc --noEmit)
- Config file errors (paths, baseURLs)
- Git worktree-inherited file behavior

These require static analysis, integration tests, or tsc checks. Unit tests excel at logic; integration/e2e needed for system-level issues.

