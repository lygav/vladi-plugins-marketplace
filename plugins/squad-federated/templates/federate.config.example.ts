/**
 * Federation Configuration — Example
 *
 * Copy this to your project root as `federate.config.json` and customize.
 * The federation scripts read this file for all configurable settings.
 */

// TypeScript interface (for reference — actual config is JSON)
export interface FederateConfig {
  /** Human-readable domain description (e.g., "security audit", "feature development") */
  domain: string;

  /**
   * Squad archetype — determines the work pattern and completion criteria.
   *
   * - "deliverable": squads produce a file artifact (scatter-gather). Aggregation collects outputs.
   * - "coding": squads produce PRs. Completion = PR opened/merged.
   * - "research": squads produce design docs / PRDs / ADRs. Completion = doc approved.
   * - "task": squads execute work items. Completion = status update + optional follow-up.
   *
   * Default: "deliverable" (backward compatible with scatter-gather pattern).
   * Meta-squads can manage mixed archetypes (non-homogeneous federation).
   */
  archetype: 'deliverable' | 'coding' | 'research' | 'task';

  /** Output filename produced by deliverable squads (e.g., "audit-report.json"). Ignored for other archetypes. */
  deliverable?: string;

  /** Path to JSON schema for deliverable validation (optional, deliverable archetype only) */
  deliverableSchema?: string;

  /** Casting universe for domain squads (default: "Transformers") */
  universe: string;

  /** Name reuse across domain squads: 'reuse' or 'unique' (default: "reuse") */
  castingStrategy: 'reuse' | 'unique';

  /** MCP servers to load for domain squad sessions */
  mcpStack: string[];

  /** Path to custom pre-discovery triage script (runs before casting) */
  triageHook?: string;

  /** Path to custom import script (runs during aggregate, deliverable archetype only) */
  importHook?: string;

  /** Path to custom completion hook (runs when a squad reports complete) */
  completionHook?: string;

  /** Name of the domain playbook skill */
  playbookSkill: string;

  /** Additional skills to seed into domain squads */
  seedSkills: string[];

  /** Playbook step names (for --step targeting) */
  steps: string[];

  /** Git branch prefix for domain worktrees (default: "squad/") */
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

// Example: Deliverable squad (scatter-gather)
const deliverableExample = {
  domain: "service inventory",
  archetype: "deliverable",
  deliverable: "inventory.json",
  deliverableSchema: "docs/schemas/inventory.schema.json",
  universe: "Transformers",
  castingStrategy: "reuse",
  mcpStack: [],
  playbookSkill: "inventory-playbook",
  seedSkills: [],
  steps: ["discovery", "analysis", "deep-dives", "validation", "distillation"],
  branchPrefix: "squad/",
  telemetry: { enabled: true, aspire: true },
  worktreeStrategy: "persistent",
};

// Example: Coding squad (feature work)
const codingExample = {
  domain: "feature development",
  archetype: "coding",
  universe: "Marvel",
  castingStrategy: "unique",
  mcpStack: [],
  playbookSkill: "feature-playbook",
  seedSkills: ["code-review", "testing-patterns"],
  steps: ["design", "implement", "test", "pr"],
  branchPrefix: "squad/",
  telemetry: { enabled: true, aspire: false },
  worktreeStrategy: "persistent",
};

// Example: Research squad (design/PRD work)
const researchExample = {
  domain: "architecture research",
  archetype: "research",
  universe: "Star Wars",
  castingStrategy: "reuse",
  mcpStack: [],
  playbookSkill: "research-playbook",
  seedSkills: [],
  steps: ["explore", "analyze", "draft", "review"],
  branchPrefix: "squad/",
  telemetry: { enabled: false, aspire: false },
  worktreeStrategy: "on-demand",
};

console.log("=== Deliverable Squad ===");
console.log(JSON.stringify(deliverableExample, null, 2));
console.log("\n=== Coding Squad ===");
console.log(JSON.stringify(codingExample, null, 2));
console.log("\n=== Research Squad ===");
console.log(JSON.stringify(researchExample, null, 2));
