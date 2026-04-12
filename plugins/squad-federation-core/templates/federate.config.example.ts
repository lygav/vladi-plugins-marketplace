/**
 * Federation Configuration — Example
 *
 * Copy this to your project root as `federate.config.json` and customize.
 *
 * This config covers federation PLUMBING only — how worktrees are branched,
 * what MCP servers are available, and whether telemetry is on.
 *
 * Team-specific configuration (archetypes, playbooks, steps, casting,
 * deliverables, hooks, skills) lives inside each team's worktree, not here.
 * When an archetype is installed into a worktree it brings its own config
 * (e.g. .squad/archetype.yaml) that governs the team's work pattern.
 */

// TypeScript interface (for reference — actual config is JSON)
export interface FederateConfig {
  /** Git branch prefix for team worktrees (default: "squad/") */
  branchPrefix: string;
  /** MCP servers to load for team sessions */
  mcpStack: string[];
  /** OTel observability */
  telemetry: {
    enabled: boolean;
    aspire: boolean;
  };
}

// Example federate.config.json
const example = {
  branchPrefix: "squad/",
  mcpStack: [],
  telemetry: { enabled: true, aspire: true },
};

console.log(JSON.stringify(example, null, 2));
