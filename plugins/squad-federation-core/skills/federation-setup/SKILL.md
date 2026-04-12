---
name: "federation-setup"
description: "The user wants to set up or configure a new federation from scratch, initialize federated squads, create a federate.config.json, or run the federation configuration wizard. Triggers on: set up federation, configure federation, federate init, initialize federation, setup wizard, create federation config, new federation."
version: "0.1.0"
---

## Purpose

Guide the user through interactive federation setup. This skill replaces a CLI wizard with a conversational flow. Walk the user through each configuration decision, validate prerequisites, and generate a complete `federate.config.json` that powers the federation system.

## Prerequisites Check

Before starting setup, verify the environment. Run these checks and report failures before proceeding:

### Required: Git

```bash
git --version
```

Minimum: git 2.20+ (worktree improvements). If missing, stop and instruct the user to install git.

### Required: Node.js 20+

```bash
node --version
```

Must be v20.0.0 or later. The federation scripts use modern Node.js features (native fetch, structured clone). If the version is too old, recommend `nvm install 20`.

### Optional: Docker (for Aspire Dashboard)

```bash
docker --version
```

Docker is only required if the user wants OTel observability via the Aspire dashboard. If Docker is missing, note it and continue — telemetry can be enabled later.

### Required: Repository State

```bash
git rev-parse --is-inside-work-tree
git status --porcelain
```

Must be inside a git repository. Warn if there are uncommitted changes — onboarding creates branches and worktrees, so a clean state is recommended.

Report all results to the user in a summary before proceeding:

```
✅ git 2.43.0
✅ Node.js v20.11.0
⚠️  Docker not found (OTel dashboard will not be available)
✅ Git repository detected
⚠️  3 uncommitted changes (recommend committing before setup)
```

## Conversational Setup Flow

Walk through each step in order. Ask one question at a time. Provide sensible defaults. Explain why each setting matters.

### Step 1: Domain Description

Ask the user to describe what their federation will manage.

**Prompt:** "What does this federation cover? Describe the product area, system, or problem domain in a sentence or two."

**Why:** This description seeds the agent charters and helps generate meaningful domain names. It appears in the config for documentation purposes.

Store the answer as `description` in the config.

**Example responses:**
- "A suite of cloud security monitoring services"
- "Our payment processing platform with multiple microservices"
- "The data analytics pipeline from ingestion to reporting"

### Step 1.5: Squad Archetype

Ask: "What type of work will your squads do?"

Present choices:
- **Deliverable** — squads produce a file artifact (JSON output). Meta-squad aggregates results. *(inventory, audit report, compliance check)*
- **Coding** — squads implement features or fixes. Output is pull requests. *(feature dev, bug fixes, refactoring)*
- **Research** — squads investigate and produce documents. Output is design docs, PRDs, ADRs. *(architecture research, feasibility study)*
- **Task** — squads execute work items. Output is status updates with optional follow-ups. *(migration, cleanup, one-off ops)*

Note: "You can also mix archetypes — a meta-squad can manage squads of different types."

Store as `archetype`. This adjusts subsequent defaults:
- Deliverable: ask for filename + schema in Step 2
- Coding: skip deliverable, default steps = design/implement/test/pr
- Research: skip deliverable, default steps = explore/analyze/draft/review
- Task: skip deliverable, default steps = plan/execute/verify

### Step 1.6: Install Archetype

Based on the user's selection, install the archetype plugin:
- Deliverable: `copilot plugin install squad-archetype-deliverable@vladi-plugins-marketplace`
- Coding: `copilot plugin install squad-archetype-coding@vladi-plugins-marketplace`

Run the install command via bash. Confirm success before proceeding.
If the marketplace isn't registered: `copilot plugin marketplace add lygav/vladi-plugins-marketplace`

### Step 2: Deliverable Name (deliverable archetype only)

Ask what the output file should be called.

**Prompt:** "What should each domain's output file be called? This is the JSON file that each domain squad produces as its final deliverable."

**Default:** `deliverable.json`

**Why:** The aggregation pipeline collects this file from each domain worktree. Naming it consistently matters.

Store as `deliverable` in the config. If the user provides a schema file path, store it as `deliverableSchema`.

**Follow-up:** "Do you have a JSON schema for this deliverable? If so, provide the path (relative to repo root). Otherwise, we'll skip schema validation."

### Step 3: MCP Server Stack

Ask which MCP servers the domain squads need.

**Prompt:** "Which MCP servers should domain squads have access to? These provide tools to the Copilot sessions running in each domain worktree."

**Common options:**
- `filesystem` — file reading and writing within the worktree
- `otel` — OpenTelemetry instrumentation (spans, metrics, events, logs)
- `fetch` — HTTP requests to external APIs
- Custom servers the user has built

**Default:** `["filesystem", "otel"]`

**Why:** Domain squads run as headless Copilot sessions. Their tool access is determined by the MCP servers configured here. Too few = squads are limited. Too many = potential security or confusion issues.

Store as `mcpStack` array in the config.

### Step 4: Universe Definition

Ask the user to list their domains.

**Prompt:** "List the domains (areas of expertise) for this federation. Each domain becomes an independent expert squad. Give a short name and optional description for each."

**Format guidance:** Names should be lowercase, hyphenated, and descriptive. Examples: `payments`, `auth-service`, `data-pipeline`, `api-gateway`.

**Why:** This defines the "universe" — the set of domain squads that will be onboarded. Each domain gets its own branch, worktree, and agent team.

Store as `universe` array in the config:

```json
{
  "universe": [
    { "name": "payments", "description": "Payment processing and billing services" },
    { "name": "auth-service", "description": "Authentication and authorization layer" }
  ]
}
```

**Follow-up questions per domain (optional):**
- Team size (default: 5)
- Role composition (default: lead, data-engineer ×2, sre, research-analyst)
- Domain-specific ID or identifier

### Step 5: Playbook Steps

Ask about the workflow pipeline.

**Prompt:** "What steps should each domain squad follow? These are the phases of work, executed in order."

**Default pipeline:**
1. `discovery` — inventory resources and dependencies
2. `analysis` — examine configurations and patterns
3. `deep-dives` — investigate findings in detail
4. `validation` — cross-check and verify findings
5. `documentation` — write structured findings
6. `distillation` — compress into final deliverable

**Why:** The playbook defines the domain squad's workflow. Each step is a prompt template that drives the agent's behavior.

Store as `steps` array in the config. The user can add, remove, or reorder steps.

### Step 6: Telemetry Configuration

Ask about observability preferences.

**Prompt:** "Do you want to enable OpenTelemetry observability? This gives you a dashboard to monitor all domain squads in real time — traces, metrics, and logs."

**Default:** enabled if Docker is available, disabled otherwise.

**If enabling, confirm:**
- Dashboard port (default: 18888)
- OTLP endpoint (default: `http://localhost:4318`)
- Service name (default: `squad-federation-core`)

Store as `telemetry` object in the config:

```json
{
  "telemetry": {
    "enabled": true,
    "endpoint": "http://localhost:4318",
    "serviceName": "squad-federation-core",
    "dashboardPort": 18888
  }
}
```

**If Docker was not found in prerequisites:** "Docker is not installed, so the Aspire dashboard won't be available. You can still enable telemetry — data will be exported to the OTLP endpoint, and you can point it at any compatible collector later."

### Step 7: Additional Settings

Ask about optional configuration.

**Prompt:** "Any additional settings?"

**Optional fields:**
- `branchPrefix`: branch naming prefix (default: `scan/`)
- `importHook`: path to a script that runs after deliverable aggregation
- `playbookSkill`: name of the skill that contains step prompts (default: `domain-playbook`)

Most users accept defaults here. Only ask if the user seems experienced or has specific requirements.

## Generating the Config

After collecting all answers, generate `federate.config.json` at the repository root.

### FederateConfig Schema

```typescript
interface FederateConfig {
  // Core
  description: string;              // What this federation covers
  deliverable: string;              // Output filename per domain
  deliverableSchema?: string;       // Path to JSON schema for validation

  // Execution
  mcpStack: string[];               // MCP servers for domain sessions
  playbookSkill: string;            // Skill containing step prompts
  steps: string[];                  // Ordered playbook steps
  branchPrefix: string;             // Branch prefix for domains

  // Universe
  universe: DomainDefinition[];     // Domain definitions

  // Telemetry
  telemetry: TelemetryConfig;       // OTel settings

  // Hooks
  importHook?: string;              // Post-aggregation script path
}

interface DomainDefinition {
  name: string;                     // Domain name (kebab-case)
  description?: string;             // What this domain covers
  domainId?: string;                // External identifier
  teamSize?: number;                // Number of agents (default: 5)
  roles?: string[];                 // Role composition
}

interface TelemetryConfig {
  enabled: boolean;
  endpoint?: string;                // OTLP endpoint URL
  serviceName?: string;             // OTel service name
  dashboardPort?: number;           // Dashboard web UI port
}
```

### Example Output

```json
{
  "description": "Cloud security monitoring platform with multiple detection services",
  "deliverable": "deliverable.json",
  "deliverableSchema": "schemas/deliverable.schema.json",
  "mcpStack": ["filesystem", "otel"],
  "playbookSkill": "domain-playbook",
  "steps": ["discovery", "analysis", "deep-dives", "validation", "documentation", "distillation"],
  "branchPrefix": "scan/",
  "universe": [
    { "name": "payments", "description": "Payment processing subsystem", "teamSize": 5 },
    { "name": "auth-service", "description": "Authentication and identity", "teamSize": 4 },
    { "name": "data-pipeline", "description": "Data ingestion and transformation", "teamSize": 5 }
  ],
  "telemetry": {
    "enabled": true,
    "endpoint": "http://localhost:4318",
    "serviceName": "squad-federation-core",
    "dashboardPort": 18888
  }
}
```

## Post-Setup Actions

After generating the config file, guide the user through next steps:

### 1. Review the Config

Show the generated config and ask the user to confirm. Offer to adjust any field.

### 2. Onboard Domains

For each domain in the universe, run the onboard script:

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/onboard.ts \
  --name "{domain.name}" \
  --domain-id "{domain.domainId || domain.name}" \
  --team-size {domain.teamSize || 5} \
  --roles "{domain.roles?.join(',') || 'lead,data-engineer,data-engineer,sre,research-analyst'}"
```

Offer to run this automatically for all domains or one at a time.

### 3. Start the Dashboard (if telemetry enabled)

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/dashboard.ts
```

Verify the dashboard is accessible at `http://localhost:{dashboardPort}`.

### 4. Launch the First Scan

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/launch.ts --all
```

Or launch one domain at a time to verify the setup works:

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/launch.ts --team {first-domain}
```

### 5. Monitor Progress

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/monitor.ts --watch
```

## Re-Running Setup

If the user already has a `federate.config.json`, inform them:

- **Editing**: open the file and modify fields directly. The schema above documents all fields.
- **Adding domains**: add entries to the `universe` array, then run `onboard.ts` for each new domain.
- **Resetting**: delete `federate.config.json` and re-run this setup flow.
- **Partial re-config**: this wizard can be re-run. It will overwrite the existing config. Existing worktrees and branches are not affected — only the config file changes.

## Error Handling During Setup

- If `git status` shows uncommitted changes, warn but do not block. Offer to commit or stash.
- If Node.js is too old, provide upgrade instructions for the detected OS.
- If Docker is not found, disable telemetry by default and note the limitation.
- If the repo already has `scan/*` branches, list them and ask if the user wants to include them in the new config's universe or start fresh.
- If `federate.config.json` already exists, show the current config and ask: "Update the existing config or start fresh?"
