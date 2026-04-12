#!/usr/bin/env tsx
/**
 * Onboard — Create a new domain expert squad
 *
 * Automates end-to-end setup for a federated domain squad:
 * - Creates domain branch (scan/{name})
 * - Sets up persistent git worktree
 * - Seeds template files
 * - Generates squad.config.ts using Squad SDK builders
 * - Runs `squad build` to generate .squad/ from config
 * - Creates agent charters, histories, and skills
 * - Cleans up meta-squad files from domain branch
 * - Makes initial commit
 *
 * Usage:
 *   npx tsx scripts/onboard.ts \
 *     --name "my-product" \
 *     --domain-id "abc-123" \
 *     --team-size 5 \
 *     --roles "lead,data-engineer,data-engineer,sre,research-analyst" \
 *     --agents "Agent Alpha,Agent Beta,Agent Gamma,Agent Delta,Agent Epsilon"
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { generateCeremoniesMarkdown, CEREMONIES } from './lib/ceremonies.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== Types ====================

interface ParsedArgs {
  name: string;
  domainId: string;
  teamSize: number;
  roles: string[];
  agents: string[];
  baseBranch: string;
}

interface RoleConfig {
  emoji: string;
  expertise: string;
  ownership: string[];
  workStyle: string;
  boundaries: string;
}

// ==================== Role Configurations (generic) ====================

const ROLE_CONFIGS: Record<string, RoleConfig> = {
  'lead': {
    emoji: '🏗️',
    expertise: 'Architecture, technical leadership, cross-team coordination, delivery ownership',
    ownership: [
      'Overall technical direction for this domain',
      'Deliverable quality and completeness',
      'Cross-agent coordination and handoffs',
      'Escalation point for blockers',
      'Output approval and sign-off',
    ],
    workStyle: `- Lead by example: hands-on when needed, delegate when appropriate
- Keep the team unblocked: clear decisions, fast escalations
- Balance depth (accuracy) vs. breadth (coverage)
- Review all output before commit`,
    boundaries: `**I handle:** Technical decisions, output reviews, team coordination, escalations.
**I delegate:** Running scans (specialists), writing queries (Data Engineers), infrastructure analysis (SRE).
**When others need help:** I unblock by making decisions, connecting people, or escalating to meta-squad.`,
  },
  'data-engineer': {
    emoji: '📊',
    expertise: 'Data queries, telemetry pipelines, data quality validation, schema analysis',
    ownership: [
      'Data extraction and validation queries',
      'Telemetry pipeline analysis',
      'Raw data quality checks',
      'Schema compliance validation',
    ],
    workStyle: `- Query first, code second
- Validate data quality before trusting it
- Cross-reference multiple sources`,
    boundaries: `**I handle:** Data queries, telemetry validation, data extraction, quality checks.
**I delegate:** Architecture decisions (Lead), documentation (Research).`,
  },
  'sre': {
    emoji: '🔧',
    expertise: 'Infrastructure, deployment topology, reliability, monitoring',
    ownership: [
      'Infrastructure and deployment analysis',
      'Reliability and monitoring assessment',
      'Regional deployment mapping',
    ],
    workStyle: `- Map infrastructure before analyzing services
- Check deployment topology and regions
- Validate monitoring and alerting`,
    boundaries: `**I handle:** Infrastructure scanning, deployment topology, reliability analysis.
**I delegate:** Data queries (Data Engineer), documentation (Research).`,
  },
  'research-analyst': {
    emoji: '🔍',
    expertise: 'Documentation discovery, dependency mapping, org chart validation',
    ownership: [
      'Documentation discovery and extraction',
      'Dependency graph mapping',
      'Organizational context validation',
    ],
    workStyle: `- Search documentation and wikis first
- Cross-reference multiple sources
- Validate findings with data engineers`,
    boundaries: `**I handle:** Documentation discovery, dependency mapping, context research.
**I delegate:** Data queries (Data Engineer), infrastructure (SRE).`,
  },
};

// ==================== Argument Parsing ====================

function parseArgs(args: string[]): ParsedArgs {
  const parsed: Partial<ParsedArgs> = {
    baseBranch: execSync('git branch --show-current', { encoding: 'utf-8' }).trim(),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];
    switch (arg) {
      case '--name': parsed.name = value; i++; break;
      case '--domain-id': parsed.domainId = value; i++; break;
      case '--team-size': parsed.teamSize = parseInt(value, 10); i++; break;
      case '--roles': parsed.roles = value.split(',').map(r => r.trim()); i++; break;
      case '--agents': parsed.agents = value.split(',').map(a => a.trim()); i++; break;
      case '--base-branch': parsed.baseBranch = value; i++; break;
    }
  }

  if (!parsed.name || !parsed.domainId || !parsed.teamSize || !parsed.roles || !parsed.agents) {
    console.error('Usage:');
    console.error('  npx tsx scripts/onboard.ts \\');
    console.error('    --name "my-product" \\');
    console.error('    --domain-id "abc-123" \\');
    console.error('    --team-size 5 \\');
    console.error('    --roles "lead,data-engineer,..." \\');
    console.error('    --agents "Alpha,Beta,..."');
    process.exit(1);
  }

  return parsed as ParsedArgs;
}

// ==================== Helpers ====================

function exec(cmd: string, opts: { cwd?: string; silent?: boolean } = {}): string {
  try {
    return (execSync(cmd, { cwd: opts.cwd, encoding: 'utf-8', stdio: opts.silent ? 'pipe' : 'inherit' }) || '').trim();
  } catch (e: any) {
    console.error(`Command failed: ${cmd}`);
    throw e;
  }
}

function toKebabCase(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function toTitleCase(str: string): string {
  return str.split(/[-_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ==================== Git Operations ====================

function createBranch(name: string, baseBranch: string): string {
  const branchName = `scan/${name}`;
  try {
    exec(`git rev-parse --verify ${branchName}`, { silent: true });
    console.error(`⚠️  Branch '${branchName}' already exists.`);
    console.error(`   To rescan: npx tsx scripts/launch.ts --domain ${name}`);
    process.exit(1);
  } catch { /* doesn't exist — good */ }

  console.log(`Creating branch: ${branchName} from ${baseBranch}`);
  exec(`git branch ${branchName} ${baseBranch}`);
  return branchName;
}

function createWorktree(branchName: string, repoRoot: string): string {
  const name = branchName.replace('scan/', '');
  const repoParent = path.dirname(repoRoot);
  const repoName = path.basename(repoRoot).replace(/_/g, '-');
  const worktreePath = path.join(repoParent, `${repoName}-${name}`);

  if (fs.existsSync(worktreePath)) {
    console.error(`❌ Worktree path already exists: ${worktreePath}`);
    exec(`git branch -D ${branchName}`);
    process.exit(1);
  }

  console.log(`Creating worktree: ${worktreePath}`);
  exec(`git worktree add ${worktreePath} ${branchName}`);
  return worktreePath;
}

// ==================== Template Seeding ====================

function seedTemplates(worktreePath: string, pluginRoot: string): void {
  console.log('Seeding template files...');

  const templateDir = path.join(pluginRoot, 'templates', 'offering-template');
  if (fs.existsSync(templateDir)) {
    for (const file of fs.readdirSync(templateDir)) {
      fs.copyFileSync(path.join(templateDir, file), path.join(worktreePath, file));
      console.log(`  ✓ Seeded ${file}`);
    }
  }

  // Create raw/ directory
  fs.mkdirSync(path.join(worktreePath, 'raw'), { recursive: true });
  console.log('✓ Template files seeded');
}

// ==================== Charter Generation ====================

function generateCharter(agentName: string, role: string, domainName: string, domainId: string): string {
  const config = ROLE_CONFIGS[role] || ROLE_CONFIGS['research-analyst'];
  const title = toTitleCase(domainName);

  return `# ${agentName} — ${role.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}

## Domain
- **Domain:** ${title}
- **Domain ID:** ${domainId}
- **Type:** Permanent domain expert (federated squad model)

## Expertise
${config.expertise}

## Ownership
${config.ownership.map(o => `- ${o}`).join('\n')}

## Work Style
${config.workStyle}

## Boundaries
${config.boundaries}

## Signal Protocol
- Read .squad/signals/inbox/ before each major step
- Write progress to .squad/signals/status.json
- Report blockers/findings to .squad/signals/outbox/
- See .squad/skills/inter-squad-signals/ for details
`;
}

// ==================== Main ====================

async function main(): Promise<void> {
  const REPO_ROOT = process.cwd();
  const PLUGIN_ROOT = path.resolve(__dirname, '..');
  const args = parseArgs(process.argv.slice(2));
  const domainTitle = toTitleCase(args.name);

  console.log(`\n🏗️  Onboarding domain: ${domainTitle}`);
  console.log(`   Domain ID: ${args.domainId}`);
  console.log(`   Team size: ${args.teamSize}`);
  console.log(`   Roles: ${args.roles.join(', ')}`);
  console.log(`   Agents: ${args.agents.join(', ')}\n`);

  // Step 1: Create branch
  const branch = createBranch(args.name, args.baseBranch);

  // Step 2: Create worktree
  const worktreePath = createWorktree(branch, REPO_ROOT);

  // Step 3: Seed templates
  seedTemplates(worktreePath, PLUGIN_ROOT);

  // Step 4: Generate squad structure
  console.log('Generating squad structure...');
  const squadDir = path.join(worktreePath, '.squad');
  const agentsDir = path.join(squadDir, 'agents');
  const signalsDir = path.join(squadDir, 'signals');
  fs.mkdirSync(path.join(signalsDir, 'inbox'), { recursive: true });
  fs.mkdirSync(path.join(signalsDir, 'outbox'), { recursive: true });
  fs.mkdirSync(path.join(squadDir, 'learnings'), { recursive: true });

  // Generate team.md
  const teamMd = `# ${domainTitle} — Domain Expert Squad

## Project Context
Permanent domain expert squad for **${domainTitle}**.

### Domain ID
${args.domainId}

## Members

| Agent | Role | Status |
|-------|------|--------|
${args.agents.map((a, i) => `| ${a} | ${args.roles[i]} | Active |`).join('\n')}
| Scribe | memory | Active |
`;

  fs.writeFileSync(path.join(squadDir, 'team.md'), teamMd);

  // Generate agent charters and histories
  for (let i = 0; i < args.agents.length; i++) {
    const agentDir = path.join(agentsDir, toKebabCase(args.agents[i]));
    fs.mkdirSync(agentDir, { recursive: true });

    const charter = generateCharter(args.agents[i], args.roles[i], args.name, args.domainId);
    fs.writeFileSync(path.join(agentDir, 'charter.md'), charter);

    const history = `# ${args.agents[i]} — History

## Session 0: Onboarding (${new Date().toISOString().split('T')[0]})

Onboarded as ${args.roles[i]} for **${domainTitle}** (Domain ID: ${args.domainId}).
Team: ${args.agents.join(', ')}.
`;
    fs.writeFileSync(path.join(agentDir, 'history.md'), history);
  }

  // Generate ceremonies.md
  fs.writeFileSync(path.join(squadDir, 'ceremonies.md'), generateCeremoniesMarkdown());

  // Generate telemetry.json
  const telemetryConfig = {
    enabled: true,
    endpoint: 'http://localhost:4318',
    serviceName: `squad-${args.name}`,
    sampleRate: 1.0,
    resourceAttributes: {
      'squad.domain': args.name,
      'squad.domain_id': args.domainId,
      'squad.type': 'domain-squad',
    },
  };
  fs.writeFileSync(path.join(squadDir, 'telemetry.json'), JSON.stringify(telemetryConfig, null, 2));

  // Step 5: Clean up meta-squad files from domain branch
  console.log('Cleaning up meta-squad files...');
  const metaSquadFiles = ['.squad/backlog.md', '.squad/identity'];
  for (const f of metaSquadFiles) {
    const fp = path.join(worktreePath, f);
    if (fs.existsSync(fp)) {
      fs.statSync(fp).isDirectory() ? fs.rmSync(fp, { recursive: true }) : fs.unlinkSync(fp);
    }
  }

  // Step 6: Initial commit
  console.log('Committing initial state...');
  exec(`git add -A && git commit -m "onboard: ${domainTitle} domain squad

Team: ${args.agents.join(', ')}
Roles: ${args.roles.join(', ')}
Domain ID: ${args.domainId}"`, { cwd: worktreePath });

  console.log(`\n✅ Domain squad onboarded: ${domainTitle}`);
  console.log(`   Worktree: ${worktreePath}`);
  console.log(`   Branch: ${branch}`);
  console.log(`   Team: ${args.agents.join(', ')}`);
  console.log(`\nNext: npx tsx scripts/launch.ts --domain ${args.name}`);
}

main().catch(err => {
  console.error('❌ Onboarding failed:', err.message);
  process.exit(1);
});
