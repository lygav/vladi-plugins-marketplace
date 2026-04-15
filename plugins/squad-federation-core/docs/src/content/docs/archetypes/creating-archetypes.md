---
title: Creating Custom Archetypes
description: Build specialized team templates for your workflows
---

# Creating Custom Archetypes

Custom archetypes let you define specialized team behaviors for workflows beyond coding, documentation, and consulting.

## When to Create Custom Archetypes

Build a custom archetype when you have:

- **Repeatable workflows** that don't fit existing archetypes
- **Specialized tools or conventions** unique to your domain
- **Multi-step processes** with clear state transitions
- **Team-specific outputs** that need standardized structure

**Examples:**
- Database migration teams (DDL changes, backfills, rollback plans)
- CI/CD pipeline teams (workflow definitions, deployment configs)
- API design teams (OpenAPI specs, contract validation)
- Security audit teams (threat models, penetration testing)
- Data analysis teams (SQL queries, visualizations, insights)

## Using the Archetype Creator Skill

The **archetype-creator** skill guides you through conversational archetype design.

**Via Copilot:** "Create a custom archetype for database migrations"

The skill will ask you:

1. **Purpose** — What does this team do?
2. **Outputs** — What artifacts does it produce?
3. **Lifecycle** — What phases does work go through?
4. **Failure modes** — What can go wrong?
5. **Skills** — What knowledge does the team need?

Based on your answers, it generates:
- State machine (`archetype.json`)
- System prompt (`system-prompt.md`)
- Skills (`skills/*.md`)
- Plugin structure

## Archetype Design Process

### Step 1: Define Purpose and Outputs

**Questions to answer:**
- What is the team's primary goal?
- What does "done" look like?
- What files or artifacts does the team produce?

**Example (DB Migrations):**

| Question | Answer |
|----------|--------|
| Goal | Apply schema changes to databases safely |
| "Done" means | Migration tested, applied to prod, rollback plan documented |
| Outputs | SQL migration files, rollback scripts, migration log |

### Step 2: Design Lifecycle States

**Questions to answer:**
- What phases does work go through?
- What are the decision points?
- What are the failure scenarios?

**Example (DB Migrations):**

```
preparing
  ↓
generating-ddl
  ↓
validating-schema
  ↓  
creating-backfill
  ↓
testing-migration
  ↓
creating-rollback
  ↓
applying-prod
  ↓
complete

(any state) → failed
```

### Step 3: Define Agent Configuration

**Questions to answer:**
- What tools does the team need?
- Should execution be precise or creative?
- Are multiple agents needed?

**Example (DB Migrations):**

| Setting | Value | Reason |
|---------|-------|--------|
| Tools | `bash`, `edit`, `view`, `grep` | Need to run SQL, edit files, search schema |
| Temperature | 0.05 | DDL must be precise, no creativity |
| Model | `claude-sonnet-4` | Standard for coding-like tasks |

### Step 4: Identify Required Skills

**Questions to answer:**
- What conventions must the team follow?
- What patterns should it use?
- What gotchas should it avoid?

**Example (DB Migrations):**

| Skill | Category | Content |
|-------|----------|---------|
| `ddl-conventions.md` | convention | Naming, types, constraints |
| `migration-testing.md` | pattern | How to test against staging |
| `rollback-planning.md` | pattern | Rollback strategy for common ops |
| `postgres-gotchas.md` | gotcha | Common PostgreSQL pitfalls |

## Archetype Manifest Reference

### Root `archetype.json`

Located in `plugins/squad-archetype-{name}/archetype.json`:

```json
{
  "id": "db-migration",
  "name": "Database Migration Team",
  "description": "Teams that apply schema changes to databases",
  "version": "1.0.0",
  "defaultAgents": {
    "lead": {
      "model": "claude-sonnet-4",
      "temperature": 0.05,
      "tools": ["bash", "edit", "view", "grep", "glob"]
    }
  },
  "outputFiles": ["migration.sql", "rollback.sql", "migration-log.md"]
}
```

**Fields:**

- `id` — Unique archetype identifier (kebab-case)
- `name` — Human-readable name
- `description` — One-line summary
- `version` — Semver version
- `defaultAgents` — Agent configuration (model, temperature, tools)
- `outputFiles` — (Optional) Expected deliverable files

### Team `archetype.json`

Located in `plugins/squad-archetype-{name}/team/archetype.json`:

```json
{
  "states": {
    "preparing": {
      "description": "Reading requirements, analyzing schema",
      "transitions": ["generating-ddl", "failed"]
    },
    "generating-ddl": {
      "description": "Writing SQL DDL statements",
      "transitions": ["validating-schema", "failed"]
    },
    "validating-schema": {
      "description": "Checking schema consistency",
      "transitions": ["creating-backfill", "generating-ddl", "failed"]
    },
    "creating-backfill": {
      "description": "Writing data backfill scripts",
      "transitions": ["testing-migration", "failed"]
    },
    "testing-migration": {
      "description": "Running migration against staging DB",
      "transitions": ["creating-rollback", "creating-backfill", "failed"]
    },
    "creating-rollback": {
      "description": "Writing rollback SQL script",
      "transitions": ["applying-prod", "failed"]
    },
    "applying-prod": {
      "description": "Executing migration on production",
      "transitions": ["complete", "failed"]
    },
    "complete": {
      "description": "Migration applied successfully",
      "terminal": true
    },
    "failed": {
      "description": "Migration failed",
      "terminal": true
    }
  },
  "initialState": "preparing",
  "pauseable": true
}
```

**State definition:**

```json
{
  "state-name": {
    "description": "What happens in this state",
    "transitions": ["next-state", "alternate-state", "failed"],
    "terminal": false  // Optional, defaults to false
  }
}
```

**Rules:**
- Every state must have `description` and `transitions`
- Terminal states (`"terminal": true`) have no outgoing transitions
- Initial state set via `initialState` field
- `pauseable: true` allows manual pause from any non-terminal state

### System Prompt

Located in `plugins/squad-archetype-{name}/team/system-prompt.md`:

```markdown
---
role: Database Migration Team Lead
---

# System Prompt: Database Migration Team

You are the lead agent for a database migration team. Your mission is to apply schema changes safely.

## Your Responsibilities

1. **Read requirements** from inbox signals
2. **Generate DDL** statements for schema changes
3. **Validate schema** consistency (types, constraints, indexes)
4. **Create backfill scripts** for data migration
5. **Test migration** against staging database
6. **Write rollback plan** for failure scenarios
7. **Apply to production** when testing passes

## State Transitions

- **preparing** → Read signal, analyze current schema → `generating-ddl`
- **generating-ddl** → Write SQL DDL → `validating-schema`
- **validating-schema** → Check consistency → `creating-backfill` (or back to `generating-ddl` if errors)
- **creating-backfill** → Write data migration → `testing-migration`
- **testing-migration** → Run against staging → `creating-rollback` (or back to `creating-backfill` if fails)
- **creating-rollback** → Write rollback SQL → `applying-prod`
- **applying-prod** → Execute on prod → `complete`

## Tools

- `bash` — Run `psql`, `pg_dump`, SQL scripts
- `edit` — Create/modify `.sql` files
- `view` — Read schema definitions
- `grep` — Search for table/column references

## Output Files

1. **migration.sql** — Forward migration DDL + DML
2. **rollback.sql** — Rollback DDL + DML
3. **migration-log.md** — Execution log, test results, prod application summary

## Skills

You have access to:
- `ddl-conventions.md` — Naming, types, constraints
- `migration-testing.md` — How to test safely
- `rollback-planning.md` — Rollback strategies
- `postgres-gotchas.md` — Common pitfalls

Read these when relevant.

## Failure Modes

Transition to `failed` state if:
- Schema validation fails
- Staging migration fails
- Rollback script cannot be generated
- Production migration fails

Always write error details to `migration-log.md`.
```

**Structure:**
- Frontmatter with `role` field
- Responsibilities list
- State transition guide
- Tools available
- Expected outputs
- Skills reference
- Failure handling

## Example: Full Archetype Plugin

```
plugins/squad-archetype-db-migration/
  ├── plugin.json
  ├── archetype.json          ← Root meta definition
  ├── meta/
  │   └── skills/
  │       └── when-to-use-db-migrations.md
  └── team/
      ├── archetype.json      ← Team state machine
      ├── system-prompt.md    ← Agent instructions
      └── skills/
          ├── ddl-conventions.md
          ├── migration-testing.md
          ├── rollback-planning.md
          └── postgres-gotchas.md
```

## Best Practices

### Clear State Names

Use verb phrases:

✅ **Good:** `generating-ddl`, `validating-schema`, `applying-prod`

❌ **Bad:** `gen`, `validate`, `apply`

### Explicit Failure Paths

Include `failed` in transitions from every state:

```json
{
  "validating-schema": {
    "description": "Checking schema consistency",
    "transitions": ["creating-backfill", "generating-ddl", "failed"]
  }
}
```

### Focused Skills

Each skill should cover one topic:

✅ **Good:** `ddl-conventions.md`, `migration-testing.md`, `rollback-planning.md`

❌ **Bad:** `everything-about-migrations.md`

### Specific System Prompts

Tell the agent exactly what to do in each state:

✅ **Good:**
```markdown
## generating-ddl state

1. Read requirements from signal
2. Analyze current schema in `schema/tables.sql`
3. Write DDL to `migration.sql`
4. Transition to `validating-schema`
```

❌ **Bad:**
```markdown
Generate SQL for the migration.
```

### Realistic State Durations

Estimate how long each state takes:

| State | Duration | Why |
|-------|----------|-----|
| `preparing` | 1-2 min | Read signal, analyze schema |
| `generating-ddl` | 5-10 min | Write SQL statements |
| `validating-schema` | 2-3 min | Check consistency |
| `testing-migration` | 10-15 min | Run against staging |

This helps users understand progress.

## Testing Your Archetype

After creating an archetype, test it:

1. **Onboard a test team** using your archetype
   - Via Copilot: "Onboard a db-migration team for test-migration"

2. **Send a sample mission**
   - Via Copilot: "Send directive to test-migration: Add user_email column to users table"

3. **Monitor execution**
   - Via Copilot: "Monitor test-migration team status"

4. **Review outputs**
   - Check deliverable files (`migration.sql`, `rollback.sql`, `migration-log.md`)
   - Verify state transitions make sense
   - Confirm skills were used appropriately

5. **Iterate**
   - Refine system prompt based on agent behavior
   - Add missing skills
   - Adjust state transitions

## Next Steps

- [View coding archetype example](/vladi-plugins-marketplace/archetypes/coding)
- [View deliverable archetype example](/vladi-plugins-marketplace/archetypes/deliverable)
- [View consultant archetype example](/vladi-plugins-marketplace/archetypes/consultant)
- **Use archetype-creator skill** — Conversationally design your archetype
