---
name: docs-with-code
confidence: high
extracted_from: v0.5.0 SDLC enforcement, directive 2025-04-15
---

# Documentation Updates with Code Changes

## When to Use
For EVERY pull request that:
- Changes public interfaces or APIs
- Modifies configuration schema or options
- Alters behavior or functionality
- Adds, removes, or renames features
- Updates dependencies that affect usage

## Pattern
**SDLC Rule:** Documentation updates MUST be in the same PR as code changes. Not a follow-up. Not optional.

**Why:** Documentation that updates separately ALWAYS drifts. By the time docs are updated, the author has moved on and forgotten details. Reviewers don't connect the two changes. Result: stale docs.

**Enforcement:** In code review, ask: "Where are the doc updates?"
- If answer is "I'll do it later" → PR is not complete
- If answer is "Docs don't need updating" → verify this is true
- If answer is "Here: lines 42-56 of README.md" → ✅ good

## Example
**BAD (documentation drift):**
```
PR #123: Add TeamsCommunication adapter
Files changed: 
  - sdk/types.ts
  - lib/communication/teams-communication.ts
  - tests/teams-comm.test.ts
Docs: "TODO: Update README after merge"
```
Result: README still says "only FileSignalCommunication supported" for 3 weeks.

**GOOD (docs with code):**
```
PR #123: Add TeamsCommunication adapter
Files changed:
  - sdk/types.ts
  - lib/communication/teams-communication.ts  
  - tests/teams-comm.test.ts
  - README.md (new section: Teams Channel Setup)
  - ARCHITECTURE.md (communication types table updated)
```
Result: Docs are accurate from day one.

## What Counts as "Documentation"
- README.md
- ARCHITECTURE.md
- API reference docs
- Configuration guides
- Migration guides (for breaking changes)
- Code comments (for complex internal APIs)
- CHANGELOG.md

## Exception
Typo fixes, internal refactors with no API changes, test-only changes → docs optional.

## Checklist for PR Author
- [ ] Did I change a public API? → Update API docs
- [ ] Did I change config schema? → Update config guide
- [ ] Did I change behavior? → Update README/guides
- [ ] Did I add a feature? → Document it
- [ ] Did I remove a feature? → Remove from docs, add migration note
- [ ] Did I fix a bug? → Update CHANGELOG

## Checklist for PR Reviewer
- [ ] Code changes match documentation updates
- [ ] No references to removed features
- [ ] Examples in docs are accurate
- [ ] Config samples reflect current schema
