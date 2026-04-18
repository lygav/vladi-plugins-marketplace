# Use Case Consistency Checking

## Why Consistency Matters

Use cases are written in parallel (one per flow, often by different
agents). Without consistency checking, they drift — different names
for the same actor, different assumptions about state, different
levels of detail. These inconsistencies compound into design bugs.

## What to Check

### 1. Terminology

Every concept should have ONE name used everywhere.

**Process:**
- Extract all actor names from all use cases
- Extract all state/entity names
- Extract all action verbs for the same operation
- Flag any concept with multiple names
- Choose the canonical name and update all documents

**Example of drift:**
- UC-01: "Server", UC-03: "Coordinator", UC-06: "Federation Server"
- UC-02: "User", UC-03: "Human", UC-08: "Operator"
- Fix: pick one per concept, search-and-replace across all docs

### 2. Actor Classifications

The same actor should have the same ACTIVE/REACTIVE classification
when performing the same role across different use cases.

**Process:**
- Build a table: Actor × Use Case → Classification
- Flag any actor that changes classification without clear reason
- A server that is REACTIVE in UC-01 (receives request) but ACTIVE
  in UC-09 (initiates recovery) is valid — the role changed
- A server that is REACTIVE in UC-01 and ACTIVE in UC-02 for the
  same kind of operation is inconsistent

### 3. Precondition/Postcondition Chains

Use cases form chains — UC-00 enables UC-01 enables UC-02.

**Process:**
- Map the dependency order of all use cases
- For each pair (X depends on Y): verify Y's postconditions
  explicitly satisfy X's preconditions
- Flag any precondition that has no matching postcondition
  in a prerequisite use case

**Example:**
- UC-02 precondition: "Federation is active with a leadership session"
- UC-01 postcondition: must include "Federation is active" AND
  "Leadership session is running"
- If UC-01 postcondition says "Federation created" but doesn't mention
  "active" or "leadership session" — gap found

### 4. State Model

All use cases should agree on what entities exist and what states
they can be in.

**Process:**
- Extract all state changes from all use cases
- Build an entity list: what gets created, modified, deleted?
- For each entity: what states/conditions are referenced?
- Flag any use case that references state another use case doesn't
  know about
- Flag any use case that assumes an entity exists without a
  prerequisite use case creating it

### 5. Flow Patterns

Common patterns should be described the same way everywhere.

**Process:**
- Identify repeated patterns (e.g., "user sends message to a team")
- Compare how each use case describes the pattern
- Flag differences in the number of steps, the actors involved,
  or the behavioral description
- Establish the canonical version and update all instances

### 6. Implementation Detail Leaks

After the initial consistency pass, scan for implementation details
that survived.

**Process:**
- Search all use cases for: protocol names, DB operations, status
  enums, technology names, code, file formats
- Each match is either: (a) a leak to fix, or (b) a false positive
  in an example or quote
- Fix all leaks

## Review Checklist

Run through these checks in order:

```
□ All actors named consistently across all use cases
□ Actor classifications consistent for same roles
□ Precondition chains verified (Y's postconditions → X's preconditions)
□ Entity/state model consistent (no orphaned states or entities)
□ Common flow patterns described identically
□ No implementation details in any use case
□ Full user journey covered (no gaps between use cases)
□ Alternative paths cover realistic failure modes
```

## Running the Review

The consistency review should be done by a SINGLE reviewer who reads
ALL use cases in one pass. Parallel reviews miss cross-document issues.

Use the highest-quality model available — it catches subtle
inconsistencies that faster models miss.

Provide the reviewer with:
- All use cases
- The architecture vision doc (for canonical terminology)
- Explicit instructions on what to check (the 6 categories above)

### Review Prompt Template

"Review ALL use case documents for cross-document consistency.

Check these 6 categories:
1. TERMINOLOGY — are the same concepts named the same everywhere?
2. ACTOR NAMES — consistent names and ACTIVE/REACTIVE classifications?
3. PRECONDITION CHAINS — does UC-X's postconditions satisfy UC-Y's
   preconditions where Y depends on X?
4. STATE MODEL — do all UCs agree on what entities exist and their states?
5. FLOW PATTERNS — are repeated patterns described the same way?
6. IMPLEMENTATION LEAKS — any protocols, DB operations, framework names?

Also check:
- Does the full user journey make sense? Any confusing UX moments?
- Any missing feedback (user does something, gets no acknowledgment)?
- Are alternative paths realistic?

For each finding: severity (CRITICAL/MAJOR/MINOR), which UCs, what
the issue is, suggested fix."

### After the Review

Fix all findings. Then run the review AGAIN. The second pass catches
issues introduced by the fixes and verifies the corrections are
consistent. Expect 2-3 review cycles before use cases are clean.
