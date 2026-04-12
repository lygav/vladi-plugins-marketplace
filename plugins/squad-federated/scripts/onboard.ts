#!/usr/bin/env tsx
/**
 * Onboard — Create a new federated domain squad
 *
 * Handles the git mechanics for federation:
 * - Creates domain branch ({prefix}{name})
 * - Sets up persistent git worktree
 * - Seeds template files and signal protocol directories
 * - Runs `squad init` in the worktree to cast the team
 * - Cleans up meta-squad files from domain branch
 * - Makes initial commit
 *
 * Team composition (roles, agents, charters) is handled by Squad's
 * native casting mechanism — this script does NOT prescribe roles.
 *
 * Usage:
 *   npx tsx scripts/onboard.ts --name "my-product" --domain-id "abc-123"
 *   npx tsx scripts/onboard.ts --name "my-product" --domain-id "abc-123" --base-branch main
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { generateCeremoniesMarkdown } from './lib/ceremonies.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== Config ====================

interface FederateConfig {
  branchPrefix: string;
  telemetry: { enabled: boolean };
}

const DEFAULT_CONFIG: FederateConfig = {
  branchPrefix: 'squad/',
  telemetry: { enabled: true },
};

function loadConfig(): FederateConfig {
  const configPath = path.join(process.cwd(), 'federate.config.json');
  if (fs.existsSync(configPath)) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(configPath, 'utf-8')) };
    } catch { /* fall through */ }
  }
  return DEFAULT_CONFIG;
}

// ==================== Types ====================

interface ParsedArgs {
  name: string;
  domainId: string;
  baseBranch: string;
  description?: string;
}

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
      case '--base-branch': parsed.baseBranch = value; i++; break;
      case '--description': parsed.description = value; i++; break;
    }
  }

  if (!parsed.name || !parsed.domainId) {
    console.error('Usage:');
    console.error('  npx tsx scripts/onboard.ts \\');
    console.error('    --name "my-product" \\');
    console.error('    --domain-id "abc-123" \\');
    console.error('    [--description "What this domain covers"] \\');
    console.error('    [--base-branch main]');
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

function toTitleCase(str: string): string {
  return str.split(/[-_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ==================== Git Operations ====================

function createBranch(name: string, baseBranch: string, prefix: string): string {
  const branchName = `${prefix}${name}`;
  try {
    exec(`git rev-parse --verify ${branchName}`, { silent: true });
    console.error(`⚠️  Branch '${branchName}' already exists.`);
    console.error(`   To re-launch: npx tsx scripts/launch.ts --team ${name}`);
    process.exit(1);
  } catch { /* doesn't exist — good */ }

  console.log(`Creating branch: ${branchName} from ${baseBranch}`);
  exec(`git branch ${branchName} ${baseBranch}`);
  return branchName;
}

function createWorktree(branchName: string, repoRoot: string, prefix: string): string {
  const name = branchName.replace(prefix, '');
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
      const src = path.join(templateDir, file);
      if (fs.statSync(src).isFile()) {
        fs.copyFileSync(src, path.join(worktreePath, file));
        console.log(`  ✓ Seeded ${file}`);
      }
    }
  }

  fs.mkdirSync(path.join(worktreePath, 'raw'), { recursive: true });
  console.log('✓ Template files seeded');
}

// ==================== Federation Scaffolding ====================

function scaffoldFederation(worktreePath: string, args: ParsedArgs, config: FederateConfig): void {
  console.log('Scaffolding federation state...');

  const squadDir = path.join(worktreePath, '.squad');
  const signalsDir = path.join(squadDir, 'signals');

  // Signal protocol directories
  fs.mkdirSync(path.join(signalsDir, 'inbox'), { recursive: true });
  fs.mkdirSync(path.join(signalsDir, 'outbox'), { recursive: true });
  fs.mkdirSync(path.join(squadDir, 'learnings'), { recursive: true });

  // Ceremonies
  fs.writeFileSync(path.join(squadDir, 'ceremonies.md'), generateCeremoniesMarkdown());

  // Telemetry config
  if (config.telemetry.enabled) {
    const telemetry = {
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
    fs.writeFileSync(path.join(squadDir, 'telemetry.json'), JSON.stringify(telemetry, null, 2));
  }

  // Domain context file — gives Squad init context for casting
  const contextMd = `# Domain Context

**Domain:** ${toTitleCase(args.name)}
**Domain ID:** ${args.domainId}
${args.description ? `**Description:** ${args.description}` : ''}
**Type:** Permanent domain expert squad (federated model)

## Signal Protocol
This squad uses the inter-squad signal protocol:
- Read .squad/signals/inbox/ before each major step
- Write progress to .squad/signals/status.json
- Report blockers/findings to .squad/signals/outbox/
`;
  fs.writeFileSync(path.join(worktreePath, 'DOMAIN_CONTEXT.md'), contextMd);

  console.log('✓ Federation state scaffolded');
}

function cleanMetaSquadFiles(worktreePath: string): void {
  console.log('Cleaning up meta-squad files...');
  const toRemove = ['.squad/backlog.md', '.squad/identity', '.squad/orchestration-log'];
  for (const f of toRemove) {
    const fp = path.join(worktreePath, f);
    if (fs.existsSync(fp)) {
      fs.statSync(fp).isDirectory() ? fs.rmSync(fp, { recursive: true }) : fs.unlinkSync(fp);
    }
  }
}

// ==================== Main ====================

async function main(): Promise<void> {
  const REPO_ROOT = process.cwd();
  const PLUGIN_ROOT = path.resolve(__dirname, '..');
  const config = loadConfig();
  const args = parseArgs(process.argv.slice(2));
  const domainTitle = toTitleCase(args.name);

  console.log(`\n🏗️  Onboarding domain: ${domainTitle}`);
  console.log(`   Domain ID: ${args.domainId}`);
  if (args.description) console.log(`   Description: ${args.description}`);
  console.log('');

  // Step 1: Create branch
  const branch = createBranch(args.name, args.baseBranch, config.branchPrefix);

  // Step 2: Create worktree
  const worktreePath = createWorktree(branch, REPO_ROOT, config.branchPrefix);

  // Step 3: Seed templates
  seedTemplates(worktreePath, PLUGIN_ROOT);

  // Step 4: Scaffold federation state (signals, learnings, ceremonies, telemetry)
  scaffoldFederation(worktreePath, args, config);

  // Step 5: Let Squad handle team casting
  // Run `squad init` in the worktree — Squad's casting mechanism handles
  // team composition, agent names, roles, charters, and histories.
  console.log('Initializing squad (team casting handled by Squad)...');
  try {
    exec('squad init', { cwd: worktreePath });
    console.log('✓ Squad initialized — team will be cast on first session');
  } catch {
    console.log('  ⚠️  squad init not available — team will be cast on first session');
  }

  // Step 6: Clean up meta-squad files from domain branch
  cleanMetaSquadFiles(worktreePath);

  // Step 7: Initial commit
  console.log('Committing initial state...');
  exec(`git add -A && git commit -m "onboard: ${domainTitle} domain squad

Domain ID: ${args.domainId}
${args.description ? `Description: ${args.description}\n` : ''}Federation scaffolding: signals, learnings, ceremonies, telemetry.
Team casting deferred to Squad init on first session."`, { cwd: worktreePath });

  console.log(`\n✅ Domain onboarded: ${domainTitle}`);
  console.log(`   Worktree: ${worktreePath}`);
  console.log(`   Branch: ${branch}`);
  console.log(`\nNext: npx tsx scripts/launch.ts --team ${args.name}`);
  console.log(`The squad will be cast by Squad on the first session.`);
}

main().catch(err => {
  console.error('❌ Onboarding failed:', err.message);
  process.exit(1);
});
