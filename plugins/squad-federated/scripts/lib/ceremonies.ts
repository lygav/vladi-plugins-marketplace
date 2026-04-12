/**
 * Ceremony Definitions for Federated Squads
 *
 * Ceremony TEMPLATES that get written to .squad/ceremonies.md during onboarding.
 * Auto-triggered based on scan state. Provide structured reflection and coordination.
 *
 * These are domain-agnostic templates. Projects customize them via FederateConfig.
 */

export interface CeremonyDefinition {
  name: string;
  trigger: {
    when: 'before' | 'after' | 'manual';
    condition: string;
  };
  facilitator: string;
  participants: string[];
  agenda: string[];
  outputs: string[];
}

/**
 * Post-Task Retro — Reflection after task completion.
 */
const TASK_RETRO: CeremonyDefinition = {
  name: 'task-retro',
  trigger: {
    when: 'after',
    condition: 'status.json state == complete',
  },
  facilitator: 'lead',
  participants: ['all'],
  agenda: [
    'Review deliverable quality and completeness',
    'Surface new learnings — read log.jsonl entries from this run',
    'Tag generalizable patterns (domain: "generalizable") for graduation',
    'Write retro report to outbox (findings count, graduation candidates, quality assessment)',
    'Update domain-specific skill extensions if new patterns discovered',
  ],
  outputs: [
    'outbox/retro-report.json',
    'updated learnings with graduation tags',
  ],
};

/**
 * Knowledge Check — Pre-rescan review.
 */
const KNOWLEDGE_CHECK: CeremonyDefinition = {
  name: 'knowledge-check',
  trigger: {
    when: 'before',
    condition: 'rescan requested',
  },
  facilitator: 'lead',
  participants: ['all'],
  agenda: [
    'Review what we already know — read deliverable and learnings',
    'Check inbox for meta-squad updates (skill syncs, directives)',
    'Acknowledge all pending inbox messages',
    'Identify gaps and set priorities for this run',
    'Assign focus areas to team members',
  ],
  outputs: [
    'updated status.json with priorities',
    'acknowledged inbox messages',
  ],
};

/**
 * Pre-Task Triage — Scope setting before first run.
 */
const PRE_TASK_TRIAGE: CeremonyDefinition = {
  name: 'pre-task-triage',
  trigger: {
    when: 'before',
    condition: 'first run (no deliverable exists)',
  },
  facilitator: 'lead',
  participants: ['all'],
  agenda: [
    'Review domain context and project description',
    'Read all seeded skills thoroughly',
    'Identify primary data sources and access requirements',
    'Draft initial work breakdown by agent',
    'Set quality criteria for the deliverable',
  ],
  outputs: [
    'work breakdown in status.json step field',
    'access requirements documented',
  ],
};

export const CEREMONIES: Record<string, CeremonyDefinition> = {
  'task-retro': TASK_RETRO,
  'knowledge-check': KNOWLEDGE_CHECK,
  'pre-task-triage': PRE_TASK_TRIAGE,
};

/**
 * Generate ceremonies.md content for seeding into domain squads.
 */
export function generateCeremoniesMarkdown(ceremonies?: Record<string, CeremonyDefinition>): string {
  const cers = ceremonies || CEREMONIES;
  let md = '# Ceremonies\n\nAuto-triggered coordination points for the squad.\n\n';

  for (const [key, c] of Object.entries(cers)) {
    md += `## ${c.name}\n\n`;
    md += `**Trigger:** ${c.trigger.when} — ${c.trigger.condition}\n`;
    md += `**Facilitator:** ${c.facilitator}\n`;
    md += `**Participants:** ${c.participants.join(', ')}\n\n`;
    md += `### Agenda\n\n`;
    c.agenda.forEach((item, i) => { md += `${i + 1}. ${item}\n`; });
    md += `\n### Outputs\n\n`;
    c.outputs.forEach(item => { md += `- ${item}\n`; });
    md += '\n---\n\n';
  }

  return md;
}
