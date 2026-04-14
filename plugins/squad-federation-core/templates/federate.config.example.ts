/**
 * Federation Configuration — Example
 *
 * Copy this to your project root as `federate.config.json` and customize.
 *
 * This config covers federation CORE concerns only — what MCP servers are 
 * available and whether telemetry is on.
 *
 * Team-specific configuration (archetypes, playbooks, steps, casting,
 * deliverables, hooks, skills, transport details) lives inside each team's
 * workspace, not here. When an archetype is installed into a workspace it
 * brings its own config (e.g. .squad/archetype.yaml) that governs the team's
 * work pattern. Transport (worktree, directory, Teams) is chosen per-team 
 * during onboarding.
 */

// TypeScript interface (for reference — actual config is JSON)
export interface FederateConfig {
  /** What this federation is trying to accomplish */
  description: string;
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
  description: "Inventory all Azure services across the organization",
  mcpStack: [],
  telemetry: { enabled: true, aspire: true },
};

console.log(JSON.stringify(example, null, 2));
