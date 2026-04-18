# Use Case Driven Design

## Principle

Every design decision traces back to a use case. If a concept, port,
or workflow exists in the design but no use case needs it, it shouldn't
be there. If a use case requires behavior but no design component
provides it, the design has a gap.

## How to Write a Design Doc from Use Cases

### Step 1: Identify the Use Cases This Component Serves

List every use case that touches this component. This is the scope —
the design must cover all of them and nothing beyond them.

### Step 2: Extract Behavioral Requirements

For each use case, identify what this component must DO:
- What inputs does it receive?
- What outputs does it produce?
- What state changes must it cause?
- What invariants must it maintain?
- What errors must it handle?

### Step 3: Define the Domain Concept

Using DDD, model the core abstraction:
- **Entity or Value Object?** Does it have identity (Entity) or is it
  defined by its attributes (Value Object)?
- **Aggregate?** What is the consistency boundary? What invariants
  does the aggregate enforce?
- **Lifecycle?** What states can it be in? What transitions are valid?
  Draw a state diagram.
- **Domain Events?** What events are emitted on state transitions?
  Who subscribes to them?

### Step 4: Define Ports

Using Ports & Adapters, define the boundaries:
- **Driving Ports (inbound):** What operations do callers invoke?
  For each: input, output, preconditions, postconditions, errors.
- **Driven Ports (outbound):** What does this component need from
  infrastructure? Persistence? External services? Define as contracts,
  not implementations.

### Step 5: Define Workflows (if Layer 2+)

If the component orchestrates multiple operations:
- Define the workflow as a state machine
- Each step references a Layer 1 operation
- Show the happy path and failure/rollback paths
- Workflows are MECHANICAL — no reasoning, just state transitions

### Step 6: Verify Traceability

Create a table mapping every use case to the operations this component
provides. Every use case must be covered. Every operation must serve
at least one use case.

## Design Doc Rules

### What to Include
- Domain concepts with ubiquitous language
- Aggregate identity, lifecycle, invariants
- Port contracts (operations with pre/postconditions)
- Domain events
- State diagrams
- Boundaries (what's inside, what's outside)
- Use case traceability table

### What NOT to Include
- Code (no classes, no method signatures)
- Database schemas (no tables, columns, indexes)
- Technology names (no framework, library, or tool references)
- Protocol details (no HTTP, JSON-RPC, etc.)
- Implementation patterns (no "use ConcurrentDictionary")

The design is technology-agnostic. A developer should be able to
implement it in any language or framework.

### Why No Code in Design?

Code couples the design to a specific language and framework.
"Use a SemaphoreSlim(1,1) for serialization" is a C# implementation
detail. The design should say "operations on the same session must
serialize." The implementer chooses the mechanism.

Code also gives a false sense of completeness. A design doc with
C# classes looks "done" but may hide behavioral gaps. A design doc
with only behavioral contracts forces the author to think about what
the component DOES, not how it's CODED.

## Applying DDD Patterns

### Aggregates
The aggregate is the consistency boundary. Everything inside the
aggregate is guaranteed consistent. Everything outside is eventually
consistent.

Ask: "If I change X, what else MUST change atomically?"
The answer defines the aggregate boundary.

### Domain Events
Events are how aggregates communicate without coupling.
"SessionBecameActive" lets other components react without the session
aggregate knowing about them.

List events for every state transition. These become the integration
points between bounded contexts.

### Ports
Ports separate the domain from infrastructure. The domain defines
"I need to persist sessions" as a port. Whether that's SQLite, Postgres,
or a file system is the adapter's decision.

For each external dependency, define a port:
- What operations does the domain need?
- What guarantees does the domain expect?
- What is the domain's responsibility vs the adapter's?

## Common Mistakes

### Designing top-down
Starting with "the coordinator service has these endpoints" instead of
"these use cases require these operations." The former produces an API
that may not match the behavioral needs.

### Mixing layers
A workflow (Layer 2) that defines database schemas (Layer 4). Keep
each layer focused on its concern.

### Missing traceability
A design component with no use case mapping. Why does this exist?
If no use case needs it, it's speculative complexity.

### Over-engineering invariants
Defining 10 invariants when the use cases only require 3. Every
invariant is a constraint that must be enforced — don't add constraints
the behavior doesn't need.
