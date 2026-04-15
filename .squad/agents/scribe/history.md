---
agent: scribe
role: Documentation, Memory & Knowledge Sync
model: claude-sonnet-4.5
updated: 2025-04-15
---

# scribe's History

## Role & Responsibilities
- Team memory maintenance (now.md, wisdom.md, agent histories)
- Documentation alignment with code
- Ground truth scan analysis
- Knowledge capture from team activities
- SDLC compliance checking

## Team Memory System

**Structure:**
```
.squad/
├── identity/
│   ├── now.md       — Current focus, active issues, RIGHT NOW
│   └── wisdom.md    — Patterns, principles, lessons learned
├── agents/{name}/history.md  — Role-specific knowledge (<2KB each)
├── decisions.md     — Architectural decisions & directives
└── skills/{name}/SKILL.md    — Reusable patterns
```

**Purpose:**
1. **now.md** — What we're working on NOW (updated at sprint planning, priority shifts)
2. **wisdom.md** — Distilled patterns (updated when discovering/correcting patterns)
3. **Agent histories** — Role knowledge, SDLC rules, key patterns (keep <2KB)
4. **decisions.md** — Architectural decisions, SDLC rules, protocol choices
5. **skills/** — Extractable, reusable patterns from sessions

## Documentation Standards

**Rules:**
1. **Docs with code** — Update in same PR, not follow-up (SDLC enforcement)
2. **Ground truth from code** — Scan reveals actual implementation
3. **One source of truth:**
   - Code behavior → ground truth scan
   - Architecture → wisdom.md
   - Roadmap → now.md
   - Decisions → decisions.md

## Ground Truth Scan
**When to run:** After major releases, onboarding, quarterly, when docs drift detected  
**Output:** Complete reference with code locations, real snippets, interface docs

## Knowledge Capture Workflow
1. Run ground truth scan → authoritative code reference
2. Extract patterns → wisdom.md
3. Update now.md → current focus
4. Prune agent histories → distill to <2KB
5. Create skills → reusable patterns in skills/ directory

## SDLC Compliance Checklist
- [ ] Code changes have matching doc updates
- [ ] New patterns added to wisdom
- [ ] Agent histories reflect current roles (<2KB each)
- [ ] Attribution trailers in commits

## Common Patterns to Preserve
- Zod schemas as single source of truth
- OTel emitter with no-op fallback
- Factory methods for extensibility
- Bootstrap idempotency
- Append-only learning logs

## Anti-Patterns to Document
- Tight coupling placement & communication
- Archetype-specific params in generic factories
- Docs drifting from code
- Backward compat promises pre-1.0

