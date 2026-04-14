---
name: consultant-playbook
description: "Domain expert teams that answer questions about codebases and specialized domains — step-by-step workflow for team execution. Triggers on: consultant, consultant workflow, consultant process."
version: 0.1.0
---

# Consultant Playbook

How teams work through the consultant lifecycle.

## Triggers

- "consultant"
- "consultant workflow"
- "consultant process"

## Lifecycle Phases


### 1. onboarding

**What happens:**
Team is being initialized. Meta-squad runs onboard script to create worktree, write domain context, configure archetype settings. Team agents are being chartered.

**Outputs:**
- `.squad/archetype-config.json` with domain, codebaseLocation, questionTypes, indexingDepth
- `DOMAIN_CONTEXT.md` describing the consultant's area of expertise
- `.squad/status.json` initialized with state="onboarding"

**Completion criteria:**
When onboard script completes and team charter is written, transition to "indexing"

---


### 2. indexing

**What happens:**
Team systematically reads and analyzes the target codebase or documentation set. Build understanding of:
- Architecture and design patterns
- Key files and their purposes
- Conventions and coding standards
- Common gotchas and edge cases
- API contracts and integration points

**Outputs:**
- Learnings written to `.squad/learnings/log.jsonl` with type "discovery" or "pattern"
- Status updates with progress (can estimate % based on files read vs total files)
- Update status.json: `state="indexing"`, `step="analyzing module X"`

**Knowledge:** As you index, log architectural discoveries immediately. "Module X handles authentication using JWT tokens in src/auth/jwt.ts." "API versioning follows pattern /api/v{N}/{resource}." "Common gotcha: async functions don't auto-retry on failure." Tag entries appropriately so they're searchable later.

**Completion criteria:**
When sufficient understanding is reached (depth based on archetype-config.json):
- **surface**: README + top-level architecture files read
- **moderate**: Core modules and patterns documented
- **deep**: Comprehensive coverage including edge cases

Then transition to "ready"

---


### 3. ready

**What happens:**
Consultant is in steady state, waiting for questions. This is the primary operational mode.

**Loop:**
1. Check `.squad/signals/inbox/` for new signals with `type="question"`
2. If question found:
   - Read question from inbox signal file
   - Transition to "researching"
3. If no questions:
   - Stay in "ready" state
   - Optionally: Proactive indexing (deepen knowledge on specific areas)
   - Optionally: Share unsolicited insights (if proactiveInsights=true in config)

**Outputs:**
- Status updates: `state="ready"`, `step="monitoring inbox"`
- Optional proactive learnings (if configured)

**Completion criteria:**
This is NOT a terminal state. Ready is the steady loop. Transition to "researching" when question arrives, or to "retired" when explicitly shut down.

---


### 4. researching

**What happens:**
Team received a question and is actively researching the answer. Use accumulated knowledge from indexing phase plus direct codebase access.

**Process:**
1. Parse question from inbox signal (subject + body)
2. Search learnings log for relevant patterns/discoveries
3. Access codebase directly if needed (read specific files)
4. Formulate answer with:
   - Direct response to the question
   - Code examples or file references
   - Confidence level (high/medium/low)
   - Caveats or edge cases
5. Write answer to `.squad/signals/outbox/` as a report signal
6. Log the Q&A pair as a learning (type="discovery" or "technique")
7. Transition back to "ready"

**Outputs:**
- Outbox signal with answer (type="report", subject=original question, body=answer)
- Learning entry recording the Q&A for future reference
- Status update: `state="researching"`, `step="researching: [question summary]"`

**Knowledge:** After answering each question, log the Q&A pair to `.squad/learnings/log.jsonl`. Include the question as the title and the answer summary in the body. Tag with relevant topics. This builds a searchable knowledge base — when similar questions arrive later, you can reference prior answers. After answering multiple questions on a topic, update `.squad/identity/wisdom.md` with patterns.

**Completion criteria:**
When answer is written to outbox and learning logged, transition to "ready"

**Escape hatch:** If you can't answer with existing knowledge and need human clarification, transition to "waiting-for-feedback"

---


### 5. waiting-for-feedback

**What happens:**
Consultant needs human clarification or additional context to answer the question. Write a question to outbox and wait for response in inbox.

**Process:**
1. Write clarifying question to outbox (type="question", from="consultant-team")
2. Update status: `state="waiting-for-feedback"`, `step="waiting for clarification on [topic]"`
3. Poll inbox for response signal
4. When response arrives, resume researching

**Outputs:**
- Outbox signal with clarifying question
- Status update indicating what's being waited on

**Completion criteria:**
When response arrives in inbox, transition back to "researching"

---



## Terminal States


### retired

**When reached:**
Consultant is no longer needed. Domain is archived, codebase deprecated, or consultant replaced.

**Actions:**
- Write final summary to outbox (total Q&A count, key learnings)
- Update status.json: `state="retired"`, `completed_at=timestamp`
- Meta-squad can remove worktree or keep as read-only archive

**Knowledge:** Before retiring, update `.squad/agents/*/history.md` with a final retrospective. What did you learn overall? What wisdom proved most valuable? This helps if the consultant is ever revived or if similar consultants are created for other domains.

---


### failed

**When reached:**
Unrecoverable error occurred:
- Codebase access permanently lost (repo deleted, permissions revoked)
- Repeated crashes during indexing
- Critical bugs in consultant logic

**Actions:**
- Write error details to status.json error field
- Update state to "failed"
- Notify meta-squad via outbox signal (type="alert")
- Wait for human intervention or triage recovery

**Knowledge:** Log what went wrong as a "gotcha" learning in `.squad/learnings/log.jsonl`. "Indexing failed because dependency X requires authentication — needs to be configured before launch." This helps recovery and prevents future teams from hitting the same issue.

---



## Workflow Tips

- **Stay focused** — Complete one phase before moving to the next
- **Update status** — Keep status.json current so meta-squad can monitor
- **Log learnings** — Capture insights in learning-log.jsonl (builds knowledge base over time)
- **Signal when stuck** — Use outbox to request help from meta-squad
- **Be concise** — Answer questions directly, provide code examples when useful
- **Acknowledge limits** — If you don't know, say so and transition to waiting-for-feedback
