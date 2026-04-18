# Domain Decomposition

## Purpose

Identify the natural boundaries in the system — which concepts belong
together, which should be separated, and what depends on what. This
determines the structure of the design docs and the order they're
written in.

## Input

A complete, consistent set of use cases (Phase 3 output). The
decomposition is driven by use case analysis, not by guessing at
service boundaries.

## Process

### Step 1: Extract Concepts

Read every use case and list every noun (entity/concept) and every
verb (operation/action) that appears.

Group related nouns: "session", "session lifecycle", "session state"
are all the same concept cluster.

### Step 2: Build a Concept × Use Case Matrix

For each concept, mark which use cases reference it:

```
              UC-01  UC-02  UC-03  UC-04  UC-05  ...
Session         ✓      ✓      ✓      ✓      ✓
Question               ✓      ✓      ✓
Team            ✓      ✓             ✓
Federation      ✓                    ✓
```

Concepts that appear in many use cases are core — they belong in the
foundational layer. Concepts that appear in few use cases are
specialized — they belong in higher layers.

### Step 3: Identify Bounded Contexts

Group concepts that always appear together and have strong semantic
relationships. These form bounded contexts (DDD term).

**Signals of a bounded context:**
- Concepts that are always modified together
- Concepts that share invariants ("a session must belong to a federation")
- Concepts where one doesn't make sense without the other

**Signals of separate contexts:**
- Concepts that appear in different use cases
- Concepts that can change independently
- Concepts where modification of one doesn't affect the other

### Step 4: Determine Layer Order

Arrange bounded contexts by dependency:

**Layer 1 (Core Contracts):** Concepts that appear in the most use cases
and have no dependencies on other concepts. Everything else depends on
these. Design first.

**Layer 2 (Workflows):** Concepts that compose Layer 1 primitives into
higher-level operations. Depend on Layer 1 but not on each other.
Can be designed in parallel.

**Layer 3 (Boundary):** The interface between the system and the outside
world. Depends on Layer 2 (exposes workflows) but not on infrastructure.

**Layer 4 (Infrastructure):** Data model, hosting, deployment. Derived
from everything above. Designed last.

### Step 5: Validate with Use Cases

For each use case, trace through the layers:
- Which Layer 1 concepts does it use?
- Which Layer 2 workflows does it trigger?
- Which Layer 3 operations does it call?
- Is every step of the use case covered by some layer?

If a use case can't be fully traced, the decomposition has a gap.

## Anti-Patterns

### Decomposing by Service Boundary
"We have a coordinator service, an adapter, and a bridge —
let's design each one."

This produces coupled designs because cross-cutting concerns (shared
data models, common abstractions) span all services. Each agent designs
its own version of the shared concern, and they diverge.

**Instead:** Decompose by concern. Identify cross-cutting concerns
first and design them as shared contracts before any component design.

### Parallel Design of Cross-Cutting Concerns
Running N design agents in parallel sounds efficient but produces
inconsistencies when they share concepts. If multiple components need
the same abstraction (a session, a question, a team), designing that
abstraction in parallel guarantees each agent invents a different version.

**Instead:** Design cross-cutting concerns FIRST and SEQUENTIALLY.
These become the shared contracts. Then design components in parallel
against those contracts. The rule is: **anything that appears in more
than one component is a cross-cutting concern and must be designed once,
before the components that use it.**

### Top-Down from Architecture
"The architecture says we have component X, Y, Z — let's design each."

This is architecture-driven, not behavior-driven. The decomposition
should come from the use cases (what behavior exists) not from the
architecture (what components were proposed).

**Instead:** Let the use cases tell you where the boundaries are.
Build the concept × use case matrix and let the data reveal the layers.

## Output

A decomposition document listing:
- Each bounded context / component
- Which use cases it serves
- What its dependencies are
- Which layer it belongs to
- The order it should be designed in

This becomes the plan for Phase 4 (Design by Layers).
