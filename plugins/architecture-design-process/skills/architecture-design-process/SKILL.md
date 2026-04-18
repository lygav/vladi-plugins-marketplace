---
name: architecture-design-process
description: "This skill should be used when the user asks to 'design a system', 'architect a solution', 'create an architecture', 'design from scratch', 'structured design process', 'use case driven design', 'layered design', or needs guidance on going from brainstorming to formal design documents. Provides a repeatable process for software architecture design."
version: 0.1.0
---

# Architecture Design Process

A structured, repeatable process for designing software systems.
Behavior first, design second, implementation last. Each level is
driven by the one above it.

## When to Use

Apply this process when designing a new system or a significant
architectural change. Not needed for small features or bug fixes.

## The Process

### Phase 1: Research and Brainstorm

Two activities that run together: researching the domain landscape
AND free-form brainstorming about the problem space.

**Research activities:**
- Is this a known/mature domain? Search for existing solutions,
  protocols, standards, frameworks that address the same problem
- What has the industry already figured out? Don't reinvent what's
  solved
- What technologies are available? Check latest versions — assumptions
  about tools may be outdated
- Are there competing standards? Understand the differences before
  committing (e.g., two protocols with similar names but different
  architectures)
- Read official docs and specs for any technology under consideration.
  Verify every assumption against real documentation

**Brainstorm activities:**
- Discuss what the system should do and why
- Explore different approaches (compare alternatives)
- Identify key design decisions and tradeoffs
- Challenge assumptions ("is this really needed?", "what if we simplify?")
- Use rubber-duck agents to evaluate competing approaches

**Exit criteria:** Clear understanding of the domain landscape
(what exists, what we can reuse, what we must build). Clear
understanding of what to build and the high-level approach.
Key decisions captured mentally, not yet in docs.

### Phase 2: Capture Vision

Distill brainstorming into a high-level architecture document. This
is the north star — design principles, system overview, key decisions.

**Activities:**
- Write an architecture README covering:
  - Vision (one paragraph — what this system does and why)
  - Design principles (5-7 rules the design follows)
  - System overview (component diagram, actor diagram)
  - Key decisions (what was decided and why)
  - Non-goals (what this system deliberately does NOT do)
- Review with rubber-duck agent for gaps and contradictions

**Exit criteria:** A single document that anyone can read to understand
the system's purpose, principles, and shape.

### Phase 3: Write Use Cases

Formal behavioral descriptions of every user journey. Pure behavior —
no implementation details. These are the requirements the design must
satisfy.

**Structure per use case:**
- **Preconditions** — what must be true before the flow starts
- **Postconditions** — what will be true after successful execution
- **Actors** — every participant, classified as ACTIVE or REACTIVE
- **Happy path** — step-by-step, WHO does WHAT (behavioral, not protocol-level)
- **Alternative paths** — what can go wrong and what happens
- **State changes summary** — what was created/modified/deleted

**Rules:**
- No implementation details (no protocols, DB schemas, status enums,
  API endpoints, framework names)
- Describe observable behavior, not internal mechanics
- One document per use case for parallel authoring
- Cover the complete user journey from install to daily use to maintenance

**Activities:**
- Map the full user journey end-to-end
- Identify gaps ("what use case is missing?")
- Write each use case (parallelizable — one agent per use case)
- Review for consistency across all use cases (terminology, actor names,
  pre/postcondition chains)
- Iterate until clean

**Exit criteria:** Complete set of use cases covering every user journey.
Consistent terminology. No implementation leaks. Pre/postcondition
chains validated across dependent use cases.

### Phase 4: Design by Layers

Use cases drive the design, ordered by dependency. Lower layers first.
Each layer designs against the one below it.

**Layer 1 — Core Contracts (design first, no dependencies):**
The fundamental domain abstractions everything depends on.
- Identify which concepts appear across the most use cases
- Define as DDD aggregates: identity, lifecycle states, invariants,
  domain events, ports
- Apply Ports & Adapters: domain defines ports, infrastructure implements

**Layer 2 — Workflows (depend on Layer 1):**
Mechanical state machines that compose Layer 1 primitives.
- Each workflow maps to one or more use cases
- Workflows are deterministic — no reasoning, just state transitions
- Can be designed in parallel (they share Layer 1 contracts, not code)

**Layer 3 — API + Adapters (depend on Layer 2):**
The boundary between the domain and the outside world.
- Start with the driving port (the API contract all adapters call)
- Then design each adapter in parallel (they all implement against the same port)
- Adapters are thin — pure protocol translation, no business logic

**Layer 4 — Infrastructure (derived from everything above):**
Data model, hosting, deployment. Designed last because the schema is
derived from behavior, not the other way around.

**Design doc rules:**
- No code (no classes, method signatures, packages)
- No database schemas or table names
- No specific technology references
- Define concepts, contracts, invariants, boundaries
- Apply DDD: aggregates, entities, value objects, domain events
- Apply Ports & Adapters: domain core has no outward dependencies
- Apply Clean Architecture: dependencies point inward
- Reference which use cases each design serves (traceability)

**Activities per layer:**
- Design docs written (one per component, parallelizable within a layer)
- Review for cross-component consistency
- Review for implementation detail leaks
- Verify use case traceability (every use case covered)

**Exit criteria:** Complete set of design docs covering all layers.
Consistent across documents. Every use case traceable to design
components. No implementation details.

### Phase 5: Review Cycles

After each phase, critical review checking for:
- **Consistency** — do documents agree on terminology, patterns, contracts?
- **Completeness** — are all use cases covered? any gaps?
- **Feasibility** — can this actually be built? any blocking risks?
- **Implementation leaks** — did design details creep into use cases, or
  implementation details creep into design?

Use Opus-level reviews for critical passes. Fix before moving to the
next phase.

### Phase 6: Iterate

Learnings from later phases feed back into earlier ones:
- Design constraints may reveal missing use cases
- Brainstorming new ideas may invalidate existing designs
- Competing approaches can be explored on separate branches

## Anti-Patterns

- **Designing before understanding behavior** — write use cases first
- **Implementation in use cases** — protocols, DB schemas, status enums
  do not belong in use cases
- **Parallel design of cross-cutting concerns** — any concept that
  appears across multiple components must be designed once, first,
  as a shared contract. Never in parallel.
- **Code in design docs** — design docs define concepts, not implementation
- **Top-down decomposition by service boundary** — decompose by concern
  and dependency instead
- **Skipping reviews** — consistency issues compound across layers
- **Accepting first drafts** — use cases and designs need 3-4 iterations.
  Push back, simplify, question assumptions, strip implementation leaks.
- **Unnecessary configurability** — if something should always be true,
  don't make it a question. Challenge every setup question.
- **Abstract use cases** — ground use cases in existing domain knowledge
  (actual workflows, skills, processes). Don't invent in a vacuum.

## Delegation and Parallelization

### When to parallelize
Use cases can be written in parallel (one agent per use case). Layer 2
workflows can be designed in parallel. Layer 3 adapters can be designed
in parallel. But cross-cutting contracts (Layer 1) must be sequential.

### How to delegate
Each agent needs COMPLETE context — not fragments. Provide:
- The architecture vision doc
- ALL relevant use cases (not just the one they're designing for)
- All Layer 1 contracts (if designing Layer 2+)
- Explicit instructions about what NOT to include (no code, no schemas)

### Review discipline
After each parallel phase, run a SINGLE reviewer across ALL outputs.
Parallel reviews miss cross-document issues. Use the highest-quality
model available for reviews — they catch what faster models miss.

Provide reviewers with specific instructions on what to check (see
references/02-use-case-consistency.md and
references/05-testing-design-against-usecases.md).

## Parallelization Guide

| Phase | Parallelizable? | How |
|---|---|---|
| Research & Brainstorm | No | Conversation with user + web research |
| Vision | No | Single document |
| Use cases | Yes | One agent per use case |
| Layer 1 | Sequential | Each contract may depend on the previous |
| Layer 2 | Yes | Workflows share L1 contracts, not each other |
| Layer 3 | Partially | API first (sequential), then adapters (parallel) |
| Layer 4 | Yes | Data model + hosting in parallel |
| Reviews | No | Cross-cutting, needs full picture |

## Detailed References

Each phase has a detailed guide with procedures, checklists, examples,
and common mistakes. Consult these during execution:

### Use Case Authoring
- **`references/01-writing-use-cases.md`** — How to write and refine
  a single use case. Structure, writing rules (no implementation details,
  behavioral language, actor consistency), refinement passes (happy path
  → preconditions → alternatives → strip implementation → verify consistency).

### Use Case Consistency
- **`references/02-use-case-consistency.md`** — Checking consistency
  across a full set of use cases. Six checks: terminology, actor
  classifications, precondition chains, state model, flow patterns,
  implementation leaks. Review checklist and process.

### Domain Decomposition
- **`references/03-domain-decomposition.md`** — How to identify bounded
  contexts and layer order from use cases. Concept extraction, concept ×
  use case matrix, bounded context identification, layer ordering,
  validation. Anti-patterns: decomposing by service boundary, parallel
  design without shared contracts.

### Use Case Driven Design
- **`references/04-use-case-driven-design.md`** — How to derive design
  docs from use cases. Extract behavioral requirements, define domain
  concepts (DDD), define ports (Ports & Adapters), define workflows,
  verify traceability. Rules: no code, no schemas, no technology names.

### Testing Design Against Use Cases
- **`references/05-testing-design-against-usecases.md`** — Validating
  the design covers all behavior. Six tests: walk-through, alternative
  paths, cross-component consistency, invariant verification,
  completeness matrix, state transition completeness.

### Real-World Example
- **`references/track-a-example.md`** — Full walkthrough of this process
  applied to a hierarchical federation server design. Includes timeline,
  key decisions, mistakes made, and lessons learned.
