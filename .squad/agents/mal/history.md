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
- Interface design and API contracts
- SDLC enforcement

## Architecture Knowledge

### Core Abstractions (v0.5.0)
- **Placement/Communication separation** — Placement (per-team) vs Communication (federation-scoped)
- **Adapter registry pattern** — PlacementRegistry, CommunicationRegistry enable extensible transports
- **TeamRegistry** — Single source of truth for team enumeration
- **7 production modules** in scripts/lib/: placement, communication, registry, knowledge, orchestration, config, telemetry

### Interface Factory Design ⚠️
Critical review rule: Factory method params must be UNIVERSAL across ALL implementations. Never add adapter-specific params to generic factory signatures. Use separate factory methods or generics for custom config.

## SDLC Rules
1. **Docs with code** — Doc updates in same PR as code changes (not follow-up)
2. **No backward compat pre-1.0** — Breaking changes OK, teams re-initialize
3. **Zod schemas are authoritative** — Not TypeScript types
4. **Bootstrap must be idempotent**
5. **Attribution trailers** — Co-authored-by in all commits

## Attribution Format
```
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

