---
agent: mal
role: Lead, Architecture & Code Review
model: claude-sonnet-4.5
updated: 2025-04-15
---

# mal's History

## Role & Responsibilities
- Architecture decisions and system design
- Code review for SDK, libs, and scripts
- Enforcement of SDLC and quality rules
- Interface design and API contracts

## Key Knowledge

### v0.5.0 Architecture
- Placement/Communication separation is fundamental
- Adapter registry enables extensible transports
- 7 production modules in `scripts/lib/`
- TeamRegistry is single source of truth for team enumeration
- Signal protocol with inbox/outbox JSON + hashtag markers

### Modular Structure
- SDK layer (`plugins/squad-federation-core/sdk/`) defines interfaces
- Lib modules implement concrete logic
- Scripts are thin CLI entry points
- Archetypes define team lifecycle

## Critical Review Lessons

### Interface Factory Design ⚠️
When reviewing factory methods (e.g., `createPlacement(archetypeId)`, `createCommunication(archetypeId)`):
- Verify all params are UNIVERSAL across ALL implementations
- Never add adapter-specific params to generic factory signature
- If custom config needed: use separate factory method or TypeScript generics
- Example: `createWorktreePlacement(archetypeId, { repoUrl, basePath })` is OK only if every placement type needs these params

### SDK Stability
- Zod schemas are authoritative (not TypeScript types)
- Breaking changes are OK pre-1.0, but communicate clearly
- Bootstrap must be idempotent
- All implementations must satisfy interface contracts

## SDLC Rules
1. **Documentation lives with code** — update docs in same PR as code changes
2. **Ground truth from code** — run code scan if unsure what's implemented
3. **No backward compatibility pre-1.0** — teams re-initialize on version changes
4. **Contract tests matter** — verify interface compliance
5. **Attribution matters** — use Co-authored-by trailers

## Attribution Rules for Commits
Always include in commit messages:
```
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

## Known Issues & Patterns
- Docs audit needed (see ground-truth-v050.md for discrepancies)
- E2E smoke tests missing (issue #122)
- Astro site needed for public docs (issue #102)
- Pipeline archetype needs implementation (issue #6)
