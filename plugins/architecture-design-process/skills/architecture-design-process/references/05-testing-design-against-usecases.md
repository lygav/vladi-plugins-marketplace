# Testing Design Against Use Cases

## Purpose

After the design docs are written, validate that the design actually
covers all the behavior the use cases require. This is the final
quality gate before implementation.

## Process

### Test 1: Use Case Walk-Through

For each use case, walk through the happy path step by step. For each
step, identify:
- Which design component handles this step?
- Which port operation is invoked?
- Which domain event is emitted?
- What state change occurs?

If any step has no corresponding design component, the design has a
**coverage gap**.

If any step maps to a component but the component's port doesn't
support the needed operation, the design has an **interface gap**.

### Test 2: Alternative Path Coverage

For each use case alternative path, verify:
- The design handles the error case
- There's a defined recovery or failure behavior
- State is left consistent after the error

Alternative paths often reveal gaps that happy paths miss. A design
that handles the happy path but crashes on errors is incomplete.

### Test 3: Cross-Component Consistency

When a use case spans multiple design components, verify:
- The output of component A matches the expected input of component B
- Domain events emitted by A are consumed by B
- The state model agrees across components
- No component assumes state that another component doesn't guarantee

### Test 4: Invariant Verification

For each invariant defined in the design:
- Which use case would violate it if the invariant weren't enforced?
- Is the enforcement mechanism clear?

For each use case that changes state:
- Which invariants could this violate?
- Does the design prevent the violation?

### Test 5: Completeness Check

Build a matrix: Use Cases × Design Components

```
              L1A    L1B    L2A    L2B    L3A    ...
UC-01          ✓             ✓            ✓
UC-02          ✓      ✓             ✓     ✓
UC-03          ✓      ✓                   ✓
```

- Every use case row should have at least one ✓
- Every design component column should have at least one ✓
- If a use case has no ✓ → coverage gap (no design handles it)
- If a component has no ✓ → speculative (no use case needs it)

### Test 6: State Transition Completeness

For each entity with a lifecycle state machine:
- List all transitions the design defines
- List all state changes the use cases require
- Verify every use-case-required transition exists in the design
- Flag any design transition that no use case exercises (potential
  over-engineering)

## Running the Validation

### Who Reviews

A single reviewer reads ALL use cases AND ALL design docs. The
reviewer must see the full picture to catch cross-cutting gaps.

Use an Opus-level model — this requires holding many documents in
context and reasoning about their interactions.

### Review Prompt Template

Provide the reviewer with:
1. All use case documents
2. All design documents
3. The architecture vision (for principles and terminology)
4. These instructions:

"For each use case, walk through every step and every alternative path.
For each step, identify which design component handles it and which
port operation is used. Flag:
- Steps with no corresponding design component (coverage gap)
- Steps where the design component exists but lacks the needed operation
  (interface gap)
- Cross-component inconsistencies (output/input mismatches)
- Invariants that aren't enforced for state-changing use cases
- Design components that no use case references (speculative)"

### Output Format

Per finding:
- **Severity**: BLOCKING (can't implement without fixing) / HIGH
  (will cause rework) / MINOR (polish)
- **Use Case**: which UC is affected
- **Design Doc**: which design doc has the gap
- **Issue**: what's missing or inconsistent
- **Suggestion**: how to fix it

Summary: coverage matrix, total findings by severity, overall
readiness verdict.

## When to Run

1. **After Phase 4 completes** — validate the full design against
   all use cases
2. **After any design doc changes** — re-validate affected use cases
3. **Before starting implementation** — final gate

## Common Findings

### Coverage gaps in alternative paths
Happy paths are well-covered. Alternative paths (error cases,
cancellations, timeouts) are often missing from the design.

### Cross-component event gaps
Component A emits an event. Component B should react. But B's design
doesn't mention the event. The integration point is missing.

### Lifecycle state gaps
The use case says "team is paused" but the design's team lifecycle
doesn't have a paused state. Or the transition from active → paused
exists but paused → active doesn't.

### Port operations that don't match
The use case needs "get team status" but the coordinator API only has
"list teams" (which returns a summary, not detailed status). Close
but not the same.
