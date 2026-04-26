# Final Review and Feasibility Gate

## Purpose

The last quality gate before implementation begins. Validates that the
complete design is internally consistent, covers all use cases, and is
technically feasible to build. Run after all design phases are complete.

## Three Parallel Reviews

The final review is NOT a single pass. Run three specialized reviews
in parallel, each with a different focus:

### Review 1: Cross-Layer Consistency

Checks that design docs agree across layers.

**What to check:**
- **L1 → L2**: Do workflows correctly reference and compose L1 concepts?
  Are lifecycle states, domain events, and port operations used
  consistently?
- **L2 → L3**: Does the API expose every operation that workflows need?
  Are there workflows with no corresponding API operation?
- **L3 → L3 adapters**: Do adapters cover all API operations? Any
  operations that no adapter exposes?
- **L1-L3 → L4**: Does every data entity trace back to a domain
  aggregate? Does the data layer cover all persistence contracts?
- **Domain events**: Are events defined in L1-L2 consumed in L2-L3?
  Any defined but never consumed? Any consumed but never defined?
- **Port completeness**: For every port in L1-L2, is there a
  corresponding adapter in L3-L4?
- **Terminology**: Same terms used the same way across all docs?

**Reviewer instructions:**
"Read ALL design docs. For each layer boundary (L1→L2, L2→L3, L3→L4),
verify that the consuming layer correctly references the contracts
defined by the providing layer. Flag mismatches, missing operations,
orphaned events, and terminology drift."

### Review 2: Use Case Traceability

Checks that every use case behavior is covered by the design.

**What to check:**
- For each use case happy path step: which design component handles it?
- For each alternative path: does the design handle the error/recovery?
- For each state change: can the data model persist it?
- Build a coverage matrix (use cases × design components)
- Flag: steps with no design owner, UCs with thin coverage, design
  components with no UC justification

Full procedure in `references/05-testing-design-against-usecases.md`.

### Review 3: Technical Feasibility

Checks that the design can actually be built with available technology.

**What to check:**

**Protocol feasibility:**
- Do the protocols/standards the design relies on actually support
  the required operations? Verify against official documentation.
- Are there capabilities the design assumes that aren't confirmed?
  (e.g., concurrent sessions, custom extension methods, crash recovery)
- Identify any assumptions that need experimental verification (spikes).

**Technology feasibility:**
- For each technology choice: is it mature enough? Does the latest
  version support what's needed?
- Are there SDK/library gaps? What must be built from scratch?
- What's the complexity of building those gaps?

**Scalability feasibility:**
- What are the expected load patterns?
- Where are the bottlenecks? (Single-writer databases, turn-based
  sessions, process-per-tenant)
- At what scale does the design break? Is that acceptable for v1?

**Distribution feasibility:**
- Can the packaging/deployment model work as designed?
- What platforms must be supported? Binary sizes? Dependencies?

**Reviewer instructions:**
"For each technology assumption in the design docs, verify it against
real documentation. For each SDK/library the design needs, check if it
exists. For each scalability assumption, estimate the breaking point.
Rank the top 5 risks by probability × impact."

## Running the Reviews

### Delegation
Launch all three reviews in parallel. Each reviewer reads ALL design
docs but focuses on their specific concern. Use the highest-quality
model available — these reviews require holding many documents in
context and reasoning about their interactions.

### Input to each reviewer
- All design docs
- All use cases (for traceability reviewer)
- Architecture vision doc
- The specific review instructions above

### Output format per reviewer
- Findings with severity: BLOCKING / HIGH / MINOR
- For each finding: which docs, what the issue is, suggested fix
- Summary: total findings by severity

## Go / No-Go Decision

After collecting all three reviews, classify the combined findings:

**BLOCKING findings** — must be fixed before implementation starts.
These are design gaps that would cause implementation to fail or
require fundamental rework.

**HIGH findings** — should be fixed but can be addressed during early
implementation. These are issues that will cause rework if not fixed
but don't prevent starting.

**MINOR findings** — can be fixed during implementation as encountered.
Polish items.

### Decision criteria

- **Zero BLOCKING findings** → ready for implementation
- **BLOCKING findings exist** → fix them, re-run affected review(s)
- **Many HIGH findings** → consider another design pass before starting

### Spikes

The feasibility review may identify assumptions that can't be verified
from documentation alone. These become **spikes** — short experimental
tasks to verify before committing to implementation.

Examples:
- "Can this protocol handle concurrent sessions?" → write a test script
- "Does this SDK support the operation we need?" → build a proof of concept
- "What's the performance under load?" → benchmark

Spikes are NOT implementation. They're verification experiments. Run
them before starting implementation. If a spike fails, the design may
need to change.

## After the Gate

Once the design passes the final review:
1. Fix all BLOCKING and HIGH findings
2. Run any required spikes
3. Create the implementation plan (task breakdown, build order)
4. Begin implementation against the reviewed design docs

The design docs become the **specification** for implementation. Changes
during implementation feed back as design amendments, not ad-hoc code
decisions.
