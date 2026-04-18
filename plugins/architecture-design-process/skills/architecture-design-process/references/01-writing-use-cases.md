# Writing and Refining Use Cases

## What a Use Case Is

A use case is a behavioral description of a user journey through the
system. It describes WHAT happens from the actors' perspective, never
HOW the system implements it.

A use case is NOT:
- A design document (no protocols, schemas, or architecture)
- A test plan (though tests can be derived from it)
- A user story (use cases are more detailed and structured)
- A requirements spec (use cases describe flows, not features)

## Structure

Every use case follows this exact structure:

### Title and Preamble
- Clear name describing the user goal (e.g., "Create a Project")
- One-paragraph summary of what this flow accomplishes
- Prerequisites (which other use cases must be completed first)

### Preconditions
Table of what must be true before the flow can start.
- State the observable condition, not the implementation
- GOOD: "Server is running and accepting requests"
- BAD: "SQLite database is open in WAL mode"

### Postconditions
Table of what will be true after successful execution.
- State the observable result, not the mechanism
- GOOD: "Team is active and addressable by name"
- BAD: "INSERT INTO teams SET status = 'active'"

### Actors
Table listing every participant with:
- **Name** — consistent across all use cases
- **Type** — ACTIVE (initiates actions) or REACTIVE (responds to actions)
- **Role** — what they do in this specific flow

### Happy Path
Numbered steps describing the main success scenario.
For each step:
- **WHO** does the action (which actor)
- **WHAT** they do (observable behavior)
- No implementation details (no protocol names, no API calls)

### Alternative Paths
Named scenarios (A1, A2, etc.) for what can go wrong:
- At which step it's detected
- What behavior results
- How recovery works (or that it's a terminal failure)

### State Changes Summary
Table of what was created, modified, or deleted.
- Observable state changes only
- GOOD: "New team record created"
- BAD: "INSERT INTO teams table with FK to federations"

## Writing Rules

### Rule 1: No Implementation Details
The most common mistake. Implementation details include:
- Protocol names (HTTP, gRPC, WebSocket, JSON-RPC)
- Database operations (INSERT, UPDATE, tables, schemas)
- Status enum values (use natural language: "question is pending")
- Framework or technology names
- Code or pseudocode
- File paths or formats
- Internal architecture names

Always ask: "Could a product manager read this?" If not, strip the
implementation details.

### Rule 2: Behavioral Language
Describe what actors observe, not what the system does internally.

- GOOD: "Server creates a new session in the project workspace"
- BAD: "Coordinator calls session/new via JSON-RPC over stdio"

### Rule 3: One Actor Per Step
Each step has exactly one actor doing one thing. Avoid compound steps.

### Rule 4: Consistent Actor Names
Use the SAME name for the same actor across ALL use cases.

### Rule 5: Precondition Chains
If UC-02 depends on UC-01, then UC-01's postconditions must satisfy
UC-02's preconditions. Verify this explicitly.

### Rule 6: Question Every Assumption
For each step where the system asks the user a question, challenge it:
- Does this NEED to be a question? Or should it always be true?
- Is this asked once (global config) or every time?
- Can the system infer the answer instead of asking?
Unnecessary questions add complexity. Remove them aggressively.

### Rule 7: Informed by Existing Domain
Use cases should be grounded in the actual domain — existing workflows,
skills, and processes. Read the existing system before writing abstract
use cases. Flows that don't match how users actually work will produce
designs that don't match reality.

## The Refinement Loop

Use cases are NOT one-shot. They go through multiple passes:

### Pass 1: Draft the happy path
Get the main flow down. Don't worry about quality yet.

### Pass 2: Add preconditions, postconditions, actors
Work backwards from the happy path.

### Pass 3: Add alternative paths
For each step: "What could go wrong here?"

### Pass 4: Strip implementation details
Read every sentence: "Is this behavior or implementation?" Remove all
protocol names, DB operations, framework references. This pass is
critical — first drafts almost always leak implementation.

### Pass 5: Review and challenge
Submit all use cases for consistency review (see 02-use-case-consistency).
Fix everything flagged.

### Pass 6: Simplify
After the consistency pass, re-read all use cases and ask:
- Can any steps be collapsed?
- Are any use cases redundant (merge them)?
- Are any questions unnecessary (remove them)?
- Is the overall journey coherent from install to daily use?

### Pass 7: Final review
One more consistency + completeness check after simplification.
Only proceed to design when this pass is clean.

**Expect 3-4 iterations before use cases are ready.** The first draft
is never good enough. The value is in the refinement.

## Common Mistakes

### Conflating "what" with "how"
"Server stores the question in the database with status PENDING."
Behavioral version: "Server records the question as pending."

### Inventing actors per use case
UC-01 calls it "Coordinator", UC-02 calls it "Server". Same actor,
two names.

### Skipping alternative paths
Happy paths are easy. Alternative paths reveal the edge cases the
design must handle.

### Too much detail in steps
Six operations compressed into one step. Break it apart.

### Accepting the first draft
The first draft leaks implementation, has inconsistent actors, and
misses use cases. Iterate.
