# Track A Example: Hierarchical Federation Server

This reference documents how the architecture design process was applied
to design a federation server for orchestrating AI squads.

## Timeline

### Brainstorm (Phase 1)
- Started with "what does ACP mean for federated squads?"
- Explored: coordinator as ACP multiplexer, relay modes (terminal vs Teams),
  question routing, session persistence across channels
- Key insight: coordinator is mechanical (never reasons), LLM sessions do
  the thinking
- Key insight: any Copilot session is a federation terminal via MCP
- Key insight: channel adapters are peers, not modes
- Compared two protocols (Agent Client Protocol vs Agent Communication
  Protocol) — chose Agent Client Protocol (what Copilot speaks)
- Explored federation-as-git-repo for backup and portability
- Eventually questioned the hierarchical model itself, leading to Track B

### Vision Capture (Phase 2)
- Architecture README: principles, system overview, security, actor model
- Six design principles: mechanical over LLM, server is source of truth,
  ACP is the protocol, one server many federations, channels are peripherals,
  sessions are continuity
- Rubber-duck review caught: ambiguous actor model, missing security section,
  underspecified question lifecycle, missing concurrency semantics

### Use Cases (Phase 3)
- First pass: 9 use cases (setup through crash recovery)
- Gap analysis found 6 missing: send directive, check status, human asks
  worker, retire team, pause/resume, server upgrade
- Second pass: 15 use cases + 2 new (install, bootstrap) = 17 total
- Later consolidated: install+bootstrap merged into UC-00, setup became
  UC-01 (create federation) — 16 final use cases
- Review found use cases leaked implementation details (protocols, DB
  schemas, status enums) — full rewrite to pure behavior
- Consistency review found 8 major + 7 minor issues — all fixed
- Key learning: use cases must be pure behavior, not design

### Design by Layers (Phase 4)
- **First attempt** (wrong): decomposed by service boundary (7 parallel
  agents). Produced 3,200 lines but Opus review found 18 cross-component
  inconsistencies — the shared data model was defined differently by each
  agent.
- **Key learning**: when the data model cuts across all components,
  design the shared contract first, not in parallel.
- **Second attempt** (correct): decomposed by concern, ordered by dependency.
  - Layer 1 (sequential): Session Lifecycle → Question Lifecycle
  - Layer 2 (parallel): Federation Mgmt | Team Mgmt | Communication
  - Layer 3 (sequential → parallel): Coordinator API → (MCP | Teams | CLI)
  - Layer 4 (parallel): Data Model | AppHost
- Design docs rules: no code, no schemas, no technology names. DDD
  aggregates, ports & adapters, clean architecture.

### Key Decisions Made
1. .NET Aspire for service hosting (OTel dashboard included)
2. C# as language (no C# ACP SDK — must build thin JSON-RPC client)
3. SQLite for local state (WAL mode)
4. Docker for distribution (self-contained CLI binary + container images)
5. Federation creation is a server-level operation (not through existing federation)
6. OTel always on — never a question
7. Global config (copilot command) asked once, per-federation config (mission,
   name, Teams) asked per federation

### What Led to Track B
During design, questioned whether the hierarchical model (leadership team
→ worker teams) was adding unnecessary complexity:
- Leadership session was a bottleneck and single point of failure
- Two-lane question triage added 500+ lines of spec
- The relay chain (worker → leadership → user) tripled message hops
- Leadership's value (triage, review) could be reproduced with simpler
  patterns (server-side serialization, peer review)
- Proposed flat model: peer teams, logical project grouping, direct
  user↔team communication, 8 MCP tools instead of 12 message types
