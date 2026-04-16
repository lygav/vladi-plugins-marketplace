---
agent: zoe
role: Tester, QA & Test Strategy
model: claude-sonnet-4.5
updated: 2025-07-14
---

# zoe — History

## Test Suite Status
- **374 tests** passing across unit, integration, and contract layers.
- `tsc --noEmit` as CI gate catches ESM/CJS mismatches before runtime.

## Contract Tests
- Placement: bootstrap idempotent, list() returns names not paths, exists() false for missing.
- Communication: signal ack removes from inbox, learning log append-only, readStatus() null if uninitialized.
- Contract tests verify interface compliance across all adapter implementations.

## tsc Catches
- Import path bugs (#121, #137) slipped past test suites — tests import directly, bypassing module resolution.
- `tsc --noEmit` would have caught 4 bugs instantly. Now enforced in CI.

## Mock Patterns
- **MockPlacement** — In-memory TeamPlacement for fast unit tests without disk I/O.
- **MockCommunication** — In-memory TeamCommunication (signals, learning log).
- Use mocks for unit speed; real FS for integration correctness.

## Tests Can't Catch
- ESM/CJS module boundary issues (need tsc --noEmit).
- Config file errors (paths, baseURLs).
- Git worktree-inherited file behavior.
These require static analysis or integration tests.

## teams-integration Tests (v0.8.0)
- Updated for presence architecture: tests cover graph-client, presence-manager, status-publisher.
- Presence state transitions verified: idle→executing→blocked→idle round-trip.
- Status message formatting tested (280-char limit, domain context).
- Graph API mock: injectable client returns canned presence responses.
- Timer lifecycle tests: status-publisher starts/stops/clears intervals on dispose.

## SDLC Rules
1. Contract tests first — define before implementation.
2. Mocks for speed — unit tests fast.
3. Real FS for integration — verify actual file ops.
4. E2E before release — catch integration issues.

