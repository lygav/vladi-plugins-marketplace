#!/usr/bin/env tsx
/**
 * Create Archetype — Scaffold a complete archetype plugin
 *
 * Generates a full archetype structure from minimal inputs:
 * - Plugin manifest (plugin.json, archetype.json)
 * - Meta skills (setup, monitoring, triage, optional aggregation)
 * - Team skills (playbook, optional recovery)
 * - Meta scripts (monitor, triage, optional aggregate extending SDK base classes)
 * - Templates (launch prompts, cleanup hook)
 * - Contract test (validates against SDK contracts)
 * - README documentation
 *
 * Usage:
 *   npx tsx scripts/create-archetype.ts --name my-archetype --states "phase1,phase2,phase3"
 *   npx tsx scripts/create-archetype.ts --name my-archetype --states "phase1,phase2" --has-aggregation --has-recovery
 *   npx tsx scripts/create-archetype.ts --name my-archetype --states "phase1,phase2" --dry-run
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== Types ====================

interface ParsedArgs {
  name: string;
  states: string[];
  description?: string;
  hasAggregation: boolean;
  hasRecovery: boolean;
  terminals?: string[];
  output?: string;
  dryRun: boolean;
}

interface TemplateContext {
  name: string;
  Name: string; // Capitalized first letter
  PascalName: string; // PascalCase for TypeScript identifiers
  description: string;
  states: string[];
  statesStr: string;
  terminalStates: string[];
  terminalStatesStr: string;
  hasAggregation: boolean;
  hasRecovery: boolean;
  version: string;
  year: string;
}

// ==================== Argument Parsing ====================

function parseArgs(args: string[]): ParsedArgs {
  const parsed: Partial<ParsedArgs> = {
    hasAggregation: false,
    hasRecovery: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];

    switch (arg) {
      case '--name':
        parsed.name = value;
        i++;
        break;
      case '--states':
        parsed.states = value.split(',').map((s) => s.trim());
        i++;
        break;
      case '--description':
        parsed.description = value;
        i++;
        break;
      case '--terminals':
        parsed.terminals = value.split(',').map((s) => s.trim());
        i++;
        break;
      case '--output':
        parsed.output = value;
        i++;
        break;
      case '--has-aggregation':
        parsed.hasAggregation = true;
        break;
      case '--has-recovery':
        parsed.hasRecovery = true;
        break;
      case '--dry-run':
        parsed.dryRun = true;
        break;
    }
  }

  if (!parsed.name || !parsed.states || parsed.states.length < 2) {
    console.error('Usage:');
    console.error('  npx tsx scripts/create-archetype.ts \\');
    console.error('    --name <name> \\');
    console.error('    --states <state1,state2,state3> \\');
    console.error('    [--description "One-line description"] \\');
    console.error('    [--terminals "complete,failed"] \\');
    console.error('    [--has-aggregation] \\');
    console.error('    [--has-recovery] \\');
    console.error('    [--output /path/to/output] \\');
    console.error('    [--dry-run]');
    console.error('');
    console.error('Examples:');
    console.error('  npx tsx scripts/create-archetype.ts --name etl-pipeline --states "extracting,transforming,loading"');
    console.error(
      '  npx tsx scripts/create-archetype.ts --name research --states "scoping,researching,analyzing" --has-aggregation --dry-run'
    );
    process.exit(1);
  }

  return {
    name: parsed.name!,
    states: parsed.states!,
    description: parsed.description,
    hasAggregation: parsed.hasAggregation!,
    hasRecovery: parsed.hasRecovery!,
    terminals: parsed.terminals || ['complete', 'failed'],
    output: parsed.output,
    dryRun: parsed.dryRun!,
  };
}

// ==================== Template Helpers ====================

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toPascalCase(str: string): string {
  return str
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function buildTemplateContext(args: ParsedArgs): TemplateContext {
  const defaultDescription = `Teams that follow the ${args.name} work pattern`;

  return {
    name: args.name,
    Name: capitalize(args.name),
    PascalName: toPascalCase(args.name),
    description: args.description || defaultDescription,
    states: args.states,
    statesStr: args.states.map((s) => `"${s}"`).join(', '),
    terminalStates: args.terminals!,
    terminalStatesStr: args.terminals!.map((s) => `"${s}"`).join(', '),
    hasAggregation: args.hasAggregation,
    hasRecovery: args.hasRecovery,
    version: '0.1.0',
    year: new Date().getFullYear().toString(),
  };
}

function renderTemplate(template: string, ctx: TemplateContext): string {
  let result = template;
  
  // Handle conditionals first
  // {{#if hasAggregation}}...{{/if}}
  result = result.replace(/\{\{#if hasAggregation\}\}(.*?)\{\{\/if\}\}/gs, (_, content) => 
    ctx.hasAggregation ? content : ''
  );
  
  // {{#if hasRecovery}}...{{/if}}
  result = result.replace(/\{\{#if hasRecovery\}\}(.*?)\{\{\/if\}\}/gs, (_, content) => 
    ctx.hasRecovery ? content : ''
  );
  
  // Handle each loops
  // {{#each states}}...{{/each}}
  result = result.replace(/\{\{#each states\}\}(.*?)\{\{\/each\}\}/gs, (_, content) => {
    return ctx.states.map((state, index) => {
      return content
        .replace(/\{\{@index \+ 1\}\}/g, String(index + 1))
        .replace(/\{\{this\}\}/g, state);
    }).join('');
  });
  
  // {{#each terminalStates}}...{{/each}}
  result = result.replace(/\{\{#each terminalStates\}\}(.*?)\{\{\/each\}\}/gs, (_, content) => {
    return ctx.terminalStates.map((state, index) => {
      return content
        .replace(/\{\{@index \+ 1\}\}/g, String(index + 1))
        .replace(/\{\{this\}\}/g, state);
    }).join('');
  });
  
  // Handle simple variables
  result = result
    .replace(/\{\{name\}\}/g, ctx.name)
    .replace(/\{\{Name\}\}/g, ctx.Name)
    .replace(/\{\{PascalName\}\}/g, ctx.PascalName)
    .replace(/\{\{description\}\}/g, ctx.description)
    .replace(/\{\{statesStr\}\}/g, ctx.statesStr)
    .replace(/\{\{terminalStatesStr\}\}/g, ctx.terminalStatesStr)
    .replace(/\{\{states\.length\}\}/g, String(ctx.states.length))
    .replace(/\{\{states\[0\]\}\}/g, ctx.states[0] || '')
    .replace(/\{\{states\[1\]\}\}/g, ctx.states[1] || '')
    .replace(/\{\{version\}\}/g, ctx.version)
    .replace(/\{\{year\}\}/g, ctx.year);
  
  return result;
}

// ==================== File Generation ====================

interface FileEntry {
  path: string;
  content: string;
}

function generateFiles(ctx: TemplateContext): FileEntry[] {
  const files: FileEntry[] = [];

  // Root plugin.json
  files.push({
    path: 'plugin.json',
    content: JSON.stringify(
      {
        name: `squad-archetype-${ctx.name}`,
        description: `${ctx.description} archetype for squad-federation-core`,
        version: ctx.version,
        author: { name: 'Generated by create-archetype' },
        keywords: ['squad', 'archetype', ctx.name],
        engines: {
          node: '>=20.0.0',
          git: '>=2.20.0',
        },
        peerDependencies: {
          'squad-federation-core': '>=0.2.0',
        },
        archetype: 'archetype.json',
        meta: {
          skills: 'meta/skills/',
          scripts: 'meta/scripts/',
        },
        team: {
          skills: 'team/skills/',
          templates: 'team/templates/',
        },
      },
      null,
      2
    ),
  });

  // Root archetype.json
  files.push({
    path: 'archetype.json',
    content: JSON.stringify(
      {
        name: `squad-archetype-${ctx.name}`,
        version: ctx.version,
        description: ctx.description,
        coreCompatibility: '>=0.2.0',
        meta: {
          skills: 'meta/skills/',
          scripts: 'meta/scripts/',
        },
        team: {
          skills: 'team/skills/',
          templates: 'team/templates/',
        },
      },
      null,
      2
    ),
  });

  // Team archetype.json with state machine
  files.push({
    path: 'team/archetype.json',
    content: JSON.stringify(
      {
        states: {
          lifecycle: ctx.states,
          terminal: ctx.terminalStates,
          pauseable: [],
        },
        monitor: {
          display: {
            sectionTitle: `${ctx.Name} Teams`,
            stateProgressFormat: 'step',
            groupByArchetype: true,
          },
        },
      },
      null,
      2
    ),
  });

  // README.md
  files.push({
    path: 'README.md',
    content: renderTemplate(getReadmeTemplate(), ctx),
  });

  // Meta skills
  files.push({
    path: `meta/skills/${ctx.name}-setup/SKILL.md`,
    content: renderTemplate(getSetupSkillTemplate(), ctx),
  });

  files.push({
    path: `meta/skills/${ctx.name}-monitoring/SKILL.md`,
    content: renderTemplate(getMonitoringSkillTemplate(), ctx),
  });

  files.push({
    path: `meta/skills/${ctx.name}-triage/SKILL.md`,
    content: renderTemplate(getTriageSkillTemplate(), ctx),
  });

  if (ctx.hasAggregation) {
    files.push({
      path: `meta/skills/${ctx.name}-aggregation/SKILL.md`,
      content: renderTemplate(getAggregationSkillTemplate(), ctx),
    });
  }

  // Meta scripts
  files.push({
    path: `meta/scripts/${ctx.name}-monitor.ts`,
    content: renderTemplate(getMonitorScriptTemplate(), ctx),
  });

  files.push({
    path: `meta/scripts/${ctx.name}-triage.ts`,
    content: renderTemplate(getTriageScriptTemplate(), ctx),
  });

  if (ctx.hasAggregation) {
    files.push({
      path: `meta/scripts/aggregate.ts`,
      content: renderTemplate(getAggregateScriptTemplate(), ctx),
    });
  }

  // Team skills
  files.push({
    path: `team/skills/${ctx.name}-playbook/SKILL.md`,
    content: renderTemplate(getPlaybookSkillTemplate(), ctx),
  });

  if (ctx.hasRecovery) {
    files.push({
      path: `team/skills/${ctx.name}-recovery/SKILL.md`,
      content: renderTemplate(getRecoverySkillTemplate(), ctx),
    });
  }

  // Team templates
  files.push({
    path: 'team/templates/launch-prompt-first.md',
    content: renderTemplate(getLaunchPromptFirstTemplate(), ctx),
  });

  files.push({
    path: 'team/templates/launch-prompt-refresh.md',
    content: renderTemplate(getLaunchPromptRefreshTemplate(), ctx),
  });

  files.push({
    path: 'team/templates/launch-prompt-reset.md',
    content: renderTemplate(getLaunchPromptResetTemplate(), ctx),
  });

  files.push({
    path: 'team/templates/cleanup-hook.sh',
    content: renderTemplate(getCleanupHookTemplate(), ctx),
  });

  // Contract test
  files.push({
    path: `__tests__/${ctx.name}.contract.test.ts`,
    content: renderTemplate(getContractTestTemplate(), ctx),
  });

  return files;
}

// ==================== Template Content ====================

function getReadmeTemplate(): string {
  return `# squad-archetype-{{name}}

{{description}}

## Structure

This archetype follows the **meta/team split pattern**:

\`\`\`
squad-archetype-{{name}}/
├── archetype.json           # Top-level manifest declaring meta/team structure
├── plugin.json              # Plugin metadata with meta/team sections
├── README.md                # This file
├── meta/                    # Meta-squad orchestration
│   ├── skills/
│   │   ├── {{name}}-setup/          # Setup wizard (meta runs this)
│   │   ├── {{name}}-monitoring/     # Monitoring interpretation
│   │   └── {{name}}-triage/         # Problem diagnosis{{#if hasAggregation}}
│   │   └── {{name}}-aggregation/    # Aggregation (meta collects results){{/if}}
│   └── scripts/
│       ├── {{name}}-monitor.ts      # Mechanical data collection
│       └── {{name}}-triage.ts       # Problem detection{{#if hasAggregation}}
│       └── aggregate.ts             # Aggregation script{{/if}}
└── team/                    # Domain team execution
    ├── archetype.json       # Team-level archetype metadata with state machine
    ├── skills/
    │   └── {{name}}-playbook/       # Playbook teams follow{{#if hasRecovery}}
    │   └── {{name}}-recovery/       # Recovery procedures{{/if}}
    └── templates/
        ├── launch-prompt-first.md
        ├── launch-prompt-refresh.md
        ├── launch-prompt-reset.md
        └── cleanup-hook.sh
\`\`\`

## How It Works

{{description}} following these lifecycle phases:

{{#each states}}
{{@index + 1}}. **{{this}}** — [Describe what happens in this phase]
{{/each}}

Terminal states: {{terminalStatesStr}}

## Installation

Typically auto-installed by \`squad-federation-core\`'s setup wizard. Manual:

\`\`\`bash
copilot plugin install squad-archetype-{{name}}@vladi-plugins-marketplace
\`\`\`

## Requires

- [squad-federation-core](../squad-federation-core/) — the federation plumbing layer (>=0.2.0)

## Customization

After scaffolding:

1. **Customize monitor script** — Add archetype-specific health checks in \`meta/scripts/{{name}}-monitor.ts\`
2. **Flesh out playbook** — Add detailed workflow steps in \`team/skills/{{name}}-playbook/SKILL.md\`
3. **Tailor setup wizard** — Update configuration questions in \`meta/skills/{{name}}-setup/SKILL.md\`
4. **Add failure patterns** — Define triage diagnostics in \`meta/skills/{{name}}-triage/SKILL.md\`
5. **Test validation** — Run \`npm test {{name}}.contract.test.ts\`
`;
}

function getSetupSkillTemplate(): string {
  return `---
name: {{name}}-setup
description: "Configure a {{name}} archetype team. Triggers on: configure {{name}}, {{name}} setup, set up {{name}} team."
version: {{version}}
---

# {{Name}} Setup Wizard

You are configuring a **{{name}} archetype** team. This skill runs after the core federation setup has installed the {{name}} archetype plugin. Core config (description, MCP stack, telemetry) is already in \`federate.config.json\` — don't touch it. Your job is to collect archetype-specific settings and write them to the team's \`.squad/archetype-config.json\`.

## Triggers

- "configure {{name}}"
- "{{name}} setup"
- "set up {{name}} team"

## Prerequisites

Before asking questions, verify:

\`\`\`bash
test -f federate.config.json
\`\`\`

If missing:

> "No federation config found. Run the federation setup first — say **'set up federation'** to start."

## Configuration Questions

Walk through these questions to collect archetype-specific settings:

### Question 1: [Customize based on your archetype needs]

Ask:

> "[Your setup question here]"

Capture: [What you're collecting]

### Question 2: [Add more as needed]

Ask:

> "[Your setup question here]"

Capture: [What you're collecting]

## Write Configuration

After collecting settings, write to \`.squad/archetype-config.json\`:

\`\`\`json
{
  "archetype": "{{name}}",
  "version": "{{version}}",
  "settings": {
    // Your collected settings here
  }
}
\`\`\`

Confirm:

> "✅ {{Name}} archetype configured! Teams can now be onboarded with \`npx tsx scripts/onboard.ts\`"
`;
}

function getMonitoringSkillTemplate(): string {
  return `---
name: {{name}}-monitoring
description: "Interpret {{name}} monitoring data — explain team status, health, and progress. Triggers on: monitor {{name}}, {{name}} status, check {{name}} teams."
version: {{version}}
---

# {{Name}} Monitoring

You interpret mechanical monitoring data from the \`{{name}}-monitor.ts\` script and present human-readable insights.

## Triggers

- "monitor {{name}}"
- "{{name}} status"
- "check {{name}} teams"
- "{{name}} dashboard"

## Input

The monitor script outputs JSON with this structure:

\`\`\`json
{
  "teams": [
    {
      "domain": "team-name",
      "domainId": "team-id",
      "state": "{{states[0]}}",
      "health": "healthy|stalled|failed",
      "progressPct": 50,
      "metadata": {
        // Archetype-specific data
      }
    }
  ],
  "summary": {
    "total": 5,
    "active": 3,
    "complete": 1,
    "failed": 1,
    "stalled": 0
  }
}
\`\`\`

## Output Format

For each team, explain:

1. **What they're doing** — Current state in human terms
2. **How they're progressing** — Percentage or phase completion
3. **Health status** — Any red flags or stalls
4. **Next steps** — What to expect next

Example:

> **Team: auth-service** 🟢
> - **State**: {{states[0]}} (50% complete)
> - **Health**: Healthy — progressing normally
> - **Next**: Moving to {{states[1]}} phase
>
> **Team: payments** 🔴
> - **State**: {{states[1]}} (stalled)
> - **Health**: No progress for 6 hours
> - **Action needed**: Run triage to diagnose

## Summary

Provide aggregate insights:

> **Federation Summary**
> - ✅ 1 team complete
> - 🟢 3 teams active and healthy
> - 🔴 1 team failed (see triage for details)
> - 📊 Overall: 60% of teams complete or on track
`;
}

function getTriageSkillTemplate(): string {
  return `---
name: {{name}}-triage
description: "Diagnose {{name}} team problems — detect failures, identify root causes, recommend recovery. Triggers on: triage {{name}}, {{name}} problems, diagnose {{name}} failures."
version: {{version}}
---

# {{Name}} Triage

You diagnose problems detected by the \`{{name}}-triage.ts\` script and recommend recovery actions.

## Triggers

- "triage {{name}}"
- "{{name}} problems"
- "diagnose {{name}} failures"
- "{{name}} stuck teams"

## Input

The triage script outputs detected problems:

\`\`\`json
{
  "problems": [
    {
      "teamId": "team-id",
      "domain": "team-name",
      "severity": "critical|high|medium|low",
      "category": "stalled|failed|data-quality|schema-mismatch",
      "description": "Team stuck in {{states[0]}} for 6 hours",
      "diagnosticId": "stalled-{{states[0]}}",
      "suggestedRecovery": ["check-logs", "reset-state"]
    }
  ]
}
\`\`\`

## Diagnostic Decision Tree

For each problem category, walk through:

### Stalled Teams

**Indicators:**
- No status update for > 4 hours
- State unchanged for extended period
- No error message

**Diagnosis:**
1. Check learning log for recent errors
2. Check signal inbox for unhandled directives
3. Check active agent status

**Recovery:**
- Send wake-up directive via inbox
- Suggest manual intervention if truly stuck

### Failed Teams

**Indicators:**
- State = "failed"
- Error message present in status.json

**Diagnosis:**
1. Read error message
2. Check for known failure patterns
3. Review recent learning entries

**Recovery:**
{{#if hasRecovery}}- Run recovery skill if automated fix available
- {{/if}}Provide manual recovery steps
- Escalate to human if unrecoverable

### [Add More Categories]

Define additional diagnostic patterns based on your archetype's failure modes.

## Output Format

For each problem:

> 🔴 **Team: payments** (Critical)
> - **Problem**: Stuck in {{states[0]}} for 6 hours
> - **Root Cause**: [Your diagnosis here]
> - **Recommended Action**: [Recovery steps]
>   {{#if hasRecovery}}1. Run: \`copilot chat "recover payments team"\`
>   {{/if}}2. Check logs in \`.squad/learning-log.jsonl\`
>   3. Send directive if needed
`;
}

function getAggregationSkillTemplate(): string {
  return `---
name: {{name}}-aggregation
description: "Orchestrate {{name}} output aggregation — collect, validate, merge team results. Triggers on: aggregate {{name}}, merge {{name}} outputs, collect {{name}} results."
version: {{version}}
---

# {{Name}} Aggregation

You orchestrate the aggregation of team outputs using the \`aggregate.ts\` script.

## Triggers

- "aggregate {{name}}"
- "merge {{name}} outputs"
- "collect {{name}} results"

## Process

1. **Collect** — Gather outputs from all teams in terminal states
2. **Validate** — Check each output against schema (if exists)
3. **Merge** — Combine outputs using aggregation logic
4. **Publish** — Write merged result to \`.squad/aggregation/\`

## Invocation

Run the aggregation script:

\`\`\`bash
npx tsx meta/scripts/aggregate.ts
\`\`\`

The script will:
- Read all team outputs
- Merge them according to archetype logic
- Validate the merged result
- Write to \`.squad/aggregation/result.json\`

## Output

Report aggregation results:

> ✅ Aggregated {{name}} outputs from 5 teams
> - **Source teams**: auth, payments, notifications, analytics, reports
> - **Output location**: \`.squad/aggregation/result.json\`
> - **Size**: 12.5 KB
> - **Validation**: Passed schema checks
> - **Next**: Review aggregated result and publish if ready
`;
}

function getPlaybookSkillTemplate(): string {
  return `---
name: {{name}}-playbook
description: "{{description}} — step-by-step workflow for team execution. Triggers on: {{name}}, {{name}} workflow, {{name}} process."
version: {{version}}
---

# {{Name}} Playbook

How teams work through the {{name}} lifecycle.

## Triggers

- "{{name}}"
- "{{name}} workflow"
- "{{name}} process"

## Lifecycle Phases

{{#each states}}
### {{@index + 1}}. {{this}}

**What happens:**
[Describe what the team does in this phase]

**Outputs:**
[What artifacts/data the team produces]

**Completion criteria:**
[How the team knows this phase is done]

---

{{/each}}

## Terminal States

{{#each terminalStates}}
### {{this}}

**When reached:**
[Describe conditions that lead to this terminal state]

**Actions:**
[What happens when team reaches this state]

---

{{/each}}

## Workflow Tips

- **Stay focused** — Complete one phase before moving to the next
- **Update status** — Keep status.json current so meta-squad can monitor
- **Log learnings as you work** — Don't wait until the end:
  - After discovery/investigation: Log "discovery" or "pattern" entries
  - When correcting mistakes: Log "correction" with supersedes field
  - After figuring out techniques: Log "technique" entries
  - When hitting gotchas: Log "gotcha" to warn future teams
  - Update agent history after each work session
  - Record significant choices in decisions.md
- **Signal when stuck** — Use outbox to request help from meta-squad
- **Extract reusable patterns** — After validating a technique 3+ times, extract to .squad/skills/

**Knowledge Integration:** Each phase description above should include a "**Knowledge:**" callout explaining what to log and when. Update this playbook skill with phase-specific knowledge capture instructions.
`;
}

function getRecoverySkillTemplate(): string {
  return `---
name: {{name}}-recovery
description: "Recover {{name}} teams from failures — automated and manual recovery procedures. Triggers on: recover {{name}}, {{name}} recovery, fix {{name}} team."
version: {{version}}
---

# {{Name}} Recovery

Recovery procedures for {{name}} teams.

## Triggers

- "recover {{name}}"
- "{{name}} recovery"
- "fix {{name}} team"

## Automated Recovery Actions

### Action 1: [Recovery Action Name]

**When to use:**
[Describe when this recovery action applies]

**Steps:**
\`\`\`bash
# Automated recovery commands
[Your recovery script here]
\`\`\`

**Validation:**
[How to verify recovery succeeded]

---

### Action 2: [Add More Actions]

## Manual Recovery Procedures

### Procedure 1: [Manual Fix Name]

**When to use:**
[Describe when manual intervention is needed]

**Steps:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Validation:**
[How to verify fix worked]

---

## Recovery Decision Tree

Use this decision tree to choose the right recovery action:

1. **Check error type** — What kind of failure occurred?
2. **Assess impact** — Can the team resume or must it restart?
3. **Choose action** — Automated recovery or manual intervention?
4. **Validate** — Confirm recovery succeeded before resuming
5. **Capture learnings** — Record what went wrong and the fix:
   - Log the incident as a "gotcha" learning in \`.squad/learnings/log.jsonl\`
   - Update \`.squad/decisions.md\` if architectural changes were needed
   - Example learning entry:
     \`\`\`json
     {
       "ts": "2025-04-14T15:30:00Z",
       "type": "gotcha",
       "agent": "recovery-team",
       "domain": "local",
       "tags": ["recovery", "{{name}}"],
       "title": "{{Name}} failed due to [specific issue]",
       "body": "Detailed explanation of what went wrong and how to fix it. Include preventive measures for future teams.",
       "confidence": "high"
     }
     \`\`\`
   - This helps prevent future teams from hitting the same issue
`;
}

function getLaunchPromptFirstTemplate(): string {
  return `# Launch Prompt (First Run)

You are the **{team}** domain squad, working on **{{name}}** tasks.

## Your Mission

{{description}}

## Knowledge Accumulation

**This team builds knowledge over time through five channels:**

1. **Learning Log** (\`.squad/learnings/log.jsonl\`)
   - Append-only JSONL of discoveries, patterns, techniques, gotchas
   - Required fields: id, ts, type, agent, domain, tags, title, body, confidence
   - Types: discovery, correction, pattern, technique, gotcha
   - Domain: local (project-specific) or generalizable (broadly applicable)

2. **Agent History** (\`.squad/agents/*/history.md\`)
   - Personal markdown journal per agent
   - Update after each work session with what you learned

3. **Team Decisions** (\`.squad/decisions.md\`)
   - Significant choices with rationale
   - "Why we chose X over Y", "Tradeoffs we accepted"

4. **Team Wisdom** (\`.squad/identity/wisdom.md\`)
   - Distilled principles that emerge from repeated patterns
   - Higher-level insights: "This domain always has X structure"

5. **Reusable Skills** (\`.squad/skills/\`)
   - Extracted patterns validated 3+ times
   - Domain-specific validation logic, investigation techniques

**Integration into workflow:** As you work through each phase, log what you learn. The playbook skill explains when to use each channel.

## Lifecycle Phases

You'll progress through these phases:

{{#each states}}
{{@index + 1}}. **{{this}}**
{{/each}}

## First Steps

1. **Understand your domain** — Read the domain context and scope
2. **Review the playbook** — Activate \`{{name}}-playbook\` skill to understand workflow
3. **Initialize state** — Create \`.squad/status.json\` with initial state
4. **Start work** — Begin with {{states[0]}} phase

## Skills Available

- **{playbookSkill}** — Your workflow guide{{#if hasRecovery}}
- **{{name}}-recovery** — Recovery procedures if you get stuck{{/if}}

## Remember

- Update status.json as you progress
- Log learnings as you discover them (not just at the end)
- Signal via outbox if you need meta-squad help

Good luck! 🚀
`;
}

function getLaunchPromptRefreshTemplate(): string {
  return `# Launch Prompt (Refresh)

You are the **{team}** domain squad, resuming **{{name}}** work.

## Context

You've been running before. Review your prior state:

- **Status**: \`.squad/status.json\`
- **Learnings**: \`.squad/learnings/log.jsonl\`
- **Signals**: \`.squad/signals/inbox/\` and \`.squad/signals/outbox/\`

## Knowledge Continuity

**Leverage accumulated knowledge from prior runs:**

1. **Search learnings** — Query \`.squad/learnings/log.jsonl\` for relevant discoveries and patterns
2. **Read your history** — Review \`.squad/agents/{your-name}/history.md\` to recall what you learned
3. **Check decisions** — Review \`.squad/decisions.md\` to understand prior architectural choices
4. **Apply wisdom** — Use patterns in \`.squad/identity/wisdom.md\` to inform new work
5. **Reuse skills** — Activate domain skills in \`.squad/skills/\` when patterns recur

**As you work:** Capture deltas as new learnings. "Discovered that X also applies to Y." "Corrected assumption about Z." This builds on prior knowledge rather than relearning from scratch.

## Resume Point

Pick up where you left off:

1. Read status.json to see your current state
2. Check inbox for any new directives from meta-squad
3. Review recent learnings to recall context
4. Continue from your current phase

## Skills Available

- **{playbookSkill}** — Your workflow guide{{#if hasRecovery}}
- **{{name}}-recovery** — Recovery procedures if you get stuck{{/if}}

Continue the work! 🔄
`;
}

function getLaunchPromptResetTemplate(): string {
  return `# Launch Prompt (Reset)

You are the **{team}** domain squad, starting fresh on **{{name}}** tasks.

## Reset Notice

Your state has been reset. Prior work may exist but you're starting from scratch.

## Knowledge with Hindsight

**You have access to prior knowledge even though state is reset:**

- **Learnings**: \`.squad/learnings/log.jsonl\` — what was discovered before
- **Wisdom**: \`.squad/identity/wisdom.md\` — distilled patterns
- **Skills**: \`.squad/skills/\` — reusable techniques
- **Decisions**: \`.squad/decisions.md\` — why prior choices were made

**Use this as informed context**, not as current state. You're starting work from scratch, but with the benefit of hindsight. Avoid repeating mistakes, leverage patterns that worked, but don't assume prior conclusions still hold.

**As you work:** Log new learnings as usual. If something changed, log a "correction" entry that supersedes the prior learning. If patterns hold, reinforce them in wisdom.md.

## First Steps

1. **Clean slate** — Assume no prior state context
2. **Review the playbook** — Activate \`{{name}}-playbook\` skill
3. **Initialize state** — Create fresh \`.squad/status.json\`
4. **Start work** — Begin with {{states[0]}} phase

## Skills Available

- **{playbookSkill}** — Your workflow guide{{#if hasRecovery}}
- **{{name}}-recovery** — Recovery procedures if you get stuck{{/if}}

Fresh start! 🆕
`;
}

function getCleanupHookTemplate(): string {
  return `#!/bin/bash
# Cleanup Hook — Reset archetype-specific state
#
# Called by core's reset command. Core clears common state (signals, acks, status.json).
# This hook clears archetype-specific state.

set -e

# Clear archetype-specific state here
# Example:
# rm -rf .squad/{{name}}/
# rm -f deliverable.json
# rm -rf raw/

echo "✅ {{Name}} archetype state cleared"
`;
}

function getMonitorScriptTemplate(): string {
  return `#!/usr/bin/env tsx
/**
 * {{Name}} Monitor — Collect mechanical monitoring data
 *
 * Extends MonitorBase to add {{name}}-specific data collection.
 * Outputs JSON consumed by {{name}}-monitoring skill.
 */

import { MonitorBase } from '@squad/federation-core/sdk';
import type { TeamPlacement, TeamCommunication, ScanStatus, DashboardEntry } from '@squad/federation-core/sdk/types.js';

interface {{PascalName}}Data {
  // Add archetype-specific monitoring data fields here
  // Example: fragmentCount: number;
}

export class {{PascalName}}Monitor extends MonitorBase<{{PascalName}}Data> {
  get archetypeName(): string {
    return '{{name}}';
  }

  /**
   * Collect archetype-specific monitoring data for a team.
   *
   * @param placement - Placement adapter for team workspace
   * @param communication - Communication adapter for team signals
   * @param status - Team's current status
   * @returns Archetype-specific data to enrich dashboard entry
   */
  async collectArchetypeData(
    placement: TeamPlacement,
    communication: TeamCommunication,
    status: ScanStatus
  ): Promise<{{PascalName}}Data> {
    // TODO: Collect archetype-specific data
    // Example:
    // const files = await placement.listFiles(status.domain_id, '.squad/{{name}}/');
    // return { fragmentCount: files.length };

    return {};
  }

  /**
   * Format archetype-specific dashboard columns.
   *
   * @param entry - Dashboard entry with metadata
   * @returns Formatted string for display
   */
  formatArchetypeColumns(entry: DashboardEntry): string {
    // TODO: Format archetype-specific data for display
    // Example:
    // const data = entry.metadata as {{PascalName}}Data;
    // return \`Fragments: \${data.fragmentCount || 0}\`;

    return '';
  }
}

// CLI entry point
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  // TODO: Initialize placement/communication maps and run monitor
  // See deliverable-monitor.ts for reference implementation
  console.log('{{Name}} monitor CLI not yet implemented');
}
`;
}

function getTriageScriptTemplate(): string {
  return `#!/usr/bin/env tsx
/**
 * {{Name}} Triage — Detect and diagnose team problems
 *
 * Extends TriageBase to add {{name}}-specific problem detection.
 * Outputs JSON consumed by {{name}}-triage skill.
 */

import { TriageBase } from '@squad/federation-core/sdk';
import type { DashboardEntry, TriageResult, RecoveryAction } from '@squad/federation-core/sdk';

export class {{PascalName}}Triage extends TriageBase {
  get archetypeName(): string {
    return '{{name}}';
  }

  /**
   * Detect archetype-specific problems for a team.
   *
   * @param entries - Dashboard entries to analyze
   * @returns Detected problems (empty array if none)
   */
  async diagnose(entries: DashboardEntry[]): Promise<TriageResult[]> {
    const problems: TriageResult[] = [];

    // TODO: Add archetype-specific problem detection
    // Examples:
    // - Check for stalled states
    // - Validate data quality
    // - Detect schema mismatches
    // - Check for missing outputs

    return problems;
  }

  /**
   * Suggest recovery actions for a diagnosed issue.
   *
   * @param diagnosis - Problem diagnosis
   * @returns Suggested recovery actions
   */
  async suggestRecovery(diagnosis: TriageResult): Promise<RecoveryAction[]> {
    // TODO: Add archetype-specific recovery actions
    return [];
  }
}

// CLI entry point
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  // TODO: Initialize dashboard entries and run triage
  // See deliverable-triage.ts for reference implementation
  console.log('{{Name}} triage CLI not yet implemented');
}
`;
}

function getAggregateScriptTemplate(): string {
  return `#!/usr/bin/env tsx
/**
 * {{Name}} Aggregation — Merge team outputs
 *
 * Collects outputs from all teams and merges them according to
 * archetype-specific aggregation logic.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface {{PascalName}}Output {
  // Define your output schema here
  domain: string;
  // Add archetype-specific fields
}

async function aggregate() {
  console.log('Starting {{name}} aggregation...');

  // TODO: Implement aggregation logic
  // 1. Discover all team workspaces
  // 2. Read each team's output file
  // 3. Validate against schema (if exists)
  // 4. Merge outputs
  // 5. Write to .squad/aggregation/result.json

  console.log('✅ Aggregation complete');
}

// Run if invoked directly
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  aggregate().catch((error) => {
    console.error('❌ Aggregation failed:', error);
    process.exit(1);
  });
}
`;
}

function getContractTestTemplate(): string {
  return `/**
 * Contract Tests — Validate {{name}} archetype against SDK contracts
 *
 * Ensures monitor and triage scripts correctly extend SDK base classes
 * and that archetype manifest conforms to expected schema.
 */

import { describe, it, expect } from 'vitest';
import { {{PascalName}}Monitor } from '../meta/scripts/{{name}}-monitor.js';
import { {{PascalName}}Triage } from '../meta/scripts/{{name}}-triage.js';
import type { StateSchema, ArchetypeManifest } from '@squad/federation-core/sdk/types.js';

describe('{{Name}} Archetype Contract Tests', () => {
  describe('Monitor Script', () => {
    it('extends MonitorBase correctly', () => {
      const monitor = new {{PascalName}}Monitor(new Map());
      expect(monitor.archetypeName).toBe('{{name}}');
      expect(typeof monitor.collectArchetypeData).toBe('function');
      expect(typeof monitor.formatArchetypeColumns).toBe('function');
    });
  });

  describe('Triage Script', () => {
    it('extends TriageBase correctly', () => {
      const triage = new {{PascalName}}Triage(new Map());
      expect(triage.archetypeName).toBe('{{name}}');
      expect(typeof triage.diagnose).toBe('function');
    });
  });

  describe('State Machine', () => {
    it('has valid lifecycle states', () => {
      const states: StateSchema = {
        lifecycle: [{{statesStr}}],
        terminal: [{{terminalStatesStr}}],
        pauseable: [],
      };

      expect(states.lifecycle).toHaveLength({{states.length}});
      expect(states.terminal).toContain('complete');
      expect(states.terminal).toContain('failed');
    });

    it('lifecycle states are non-empty strings', () => {
      const states = [{{statesStr}}];
      states.forEach((state) => {
        expect(state).toBeTruthy();
        expect(typeof state).toBe('string');
      });
    });
  });

  describe('Archetype Manifest', () => {
    it('declares required fields', async () => {
      const manifest = await import('../archetype.json');

      expect(manifest.name).toBe('squad-archetype-{{name}}');
      expect(manifest.version).toBeTruthy();
      expect(manifest.description).toBeTruthy();
      expect(manifest.coreCompatibility).toBeTruthy();
      expect(manifest.meta).toBeDefined();
      expect(manifest.team).toBeDefined();
    });

    it('has valid meta/team paths', async () => {
      const manifest = await import('../archetype.json');

      expect(manifest.meta.skills).toBe('meta/skills/');
      expect(manifest.meta.scripts).toBe('meta/scripts/');
      expect(manifest.team.skills).toBe('team/skills/');
      expect(manifest.team.templates).toBe('team/templates/');
    });
  });
});
`;
}

// ==================== Main ====================

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ctx = buildTemplateContext(args);

  // Determine output directory
  const repoRoot = path.resolve(__dirname, '../..');
  const outputDir = args.output || path.join(repoRoot, 'plugins', `squad-archetype-${ctx.name}`);

  console.log(`\n📦 Creating archetype: ${ctx.name}`);
  console.log(`📍 Output: ${outputDir}`);
  console.log(`🏗️  Lifecycle states: ${ctx.states.join(' → ')}`);
  console.log(`🏁 Terminal states: ${ctx.terminalStates.join(', ')}`);
  if (ctx.hasAggregation) console.log(`📊 Aggregation: enabled`);
  if (ctx.hasRecovery) console.log(`🔧 Recovery: enabled`);

  // Generate files
  const files = generateFiles(ctx);

  if (args.dryRun) {
    console.log(`\n🔍 Dry run — showing file tree (not writing):\n`);
    const tree = new Map<string, string[]>();

    files.forEach((file) => {
      const dir = path.dirname(file.path);
      if (!tree.has(dir)) tree.set(dir, []);
      tree.get(dir)!.push(path.basename(file.path));
    });

    const sortedDirs = Array.from(tree.keys()).sort();
    sortedDirs.forEach((dir) => {
      console.log(`${dir || '.'}/`);
      tree.get(dir)!.forEach((file) => {
        console.log(`  ${file}`);
      });
    });

    console.log(`\n📋 Total: ${files.length} files`);
    console.log(`\n▶️  To create files, remove --dry-run flag`);
    return;
  }

  // Write files
  console.log(`\n✍️  Writing files...\n`);
  for (const file of files) {
    const fullPath = path.join(outputDir, file.path);
    const dir = path.dirname(fullPath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, file.content, 'utf-8');
    console.log(`  ✅ ${file.path}`);
  }

  console.log(`\n✅ Archetype scaffolded successfully!`);
  console.log(`\n📂 Location: ${outputDir}`);
  console.log(`\n📝 Next steps:`);
  console.log(`   1. Review generated files`);
  console.log(`   2. Customize monitor script: meta/scripts/${ctx.name}-monitor.ts`);
  console.log(`   3. Flesh out playbook: team/skills/${ctx.name}-playbook/SKILL.md`);
  console.log(`   4. Tailor setup wizard: meta/skills/${ctx.name}-setup/SKILL.md`);
  console.log(`   5. Run contract tests: npm test ${ctx.name}.contract.test.ts`);
  console.log(`   6. Update README with archetype-specific details`);
  console.log(`\n💡 Your archetype will be automatically discovered by the federation setup wizard.`);
  console.log(`   No manual registration needed — just install the plugin and it appears in setup options.`);
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
