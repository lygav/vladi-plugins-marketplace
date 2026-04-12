/**
 * Federation Configuration — Example
 *
 * Copy this to your project root as `federate.config.json` and customize.
 * The federation scripts read this file for all configurable settings.
 */

// TypeScript interface (for reference — actual config is JSON)
export interface FederateConfig {
  /** Human-readable domain description (e.g., "security audit", "service inventory") */
  domain: string;

  /** Output filename produced by each domain squad (e.g., "audit-report.json") */
  deliverable: string;

  /** Path to JSON schema for deliverable validation (optional) */
  deliverableSchema?: string;

  /** Casting universe for domain squads (default: "Transformers") */
  universe: string;

  /** Name reuse across domain squads: 'reuse' or 'unique' (default: "reuse") */
  castingStrategy: 'reuse' | 'unique';

  /** MCP servers to load for domain squad sessions */
  mcpStack: string[];

  /** Path to custom pre-discovery triage script (runs before casting) */
  triageHook?: string;

  /** Path to custom import script (runs during aggregate) */
  importHook?: string;

  /** Name of the domain playbook skill */
  playbookSkill: string;

  /** Additional skills to seed into domain squads */
  seedSkills: string[];

  /** Playbook step names (for --step targeting) */
  steps: string[];

  /** Git branch prefix for domain worktrees (default: "scan/") */
  branchPrefix: string;

  /** OTel observability settings */
  telemetry: {
    enabled: boolean;
    /** Auto-start Aspire dashboard */
    aspire: boolean;
  };

  /** Worktree strategy */
  worktreeStrategy: 'persistent' | 'on-demand';
}

// Example configuration (save as federate.config.json):
const exampleConfig = {
  domain: "service inventory",
  deliverable: "deliverable.json",
  deliverableSchema: "docs/schemas/deliverable.schema.json",
  universe: "Transformers",
  castingStrategy: "reuse",
  mcpStack: [],
  playbookSkill: "domain-playbook",
  seedSkills: [],
  steps: ["discovery", "analysis", "deep-dives", "validation", "documentation", "distillation"],
  branchPrefix: "scan/",
  telemetry: {
    enabled: true,
    aspire: true,
  },
  worktreeStrategy: "persistent",
};

console.log(JSON.stringify(exampleConfig, null, 2));
