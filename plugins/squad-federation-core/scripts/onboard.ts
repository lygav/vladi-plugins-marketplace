#!/usr/bin/env tsx
/**
 * Onboard — Create a new federated domain squad
 *
 * Implements the "start empty, add what's needed" model:
 * - Creates team workspace via transport abstraction (worktree or directory)
 * - Seeds ONLY team/ directory from archetype (not entire archetype)
 * - Registers team in TeamRegistry (replaces git worktree list discovery)
 * - Initializes minimal .squad/ state (signals, learnings, status)
 * - Runs `squad init` in the workspace to cast the team
 *
 * Team composition (roles, agents, charters) is handled by Squad's
 * native casting mechanism — this script does NOT prescribe roles.
 *
 * Usage:
 *   # Worktree inside repo (default):
 *   npx tsx scripts/onboard.ts --name "my-product" --domain-id "abc-123" --archetype "squad-archetype-deliverable"
 *   
 *   # Worktree in sibling directory:
 *   npx tsx scripts/onboard.ts --name "my-product" --domain-id "abc-123" --archetype "squad-archetype-deliverable" --worktree-dir ../
 *   
 *   # Directory transport:
 *   npx tsx scripts/onboard.ts --name "my-product" --domain-id "abc-123" --archetype "squad-archetype-deliverable" --transport directory --path /custom/path
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { generateCeremoniesMarkdown } from './lib/ceremonies.js';
import { loadAndValidateConfig, type FederateConfig } from './lib/config.js';
import { WorktreePlacement } from './lib/worktree-placement.js';
import { DirectoryPlacement } from './lib/directory-placement.js';
import { TeamRegistry } from './lib/team-registry.js';
import type { TeamEntry } from '../sdk/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== Config ====================
// Config loading now uses validated config from lib/config.ts

// Branch prefix for team worktrees (transport-level concern, not federation config)
const BRANCH_PREFIX = 'squad/';

// ==================== Types ====================

interface ParsedArgs {
  name: string;
  domainId: string;
  baseBranch: string;
  description?: string;
  archetype: string;
  transport: 'worktree' | 'directory';
  path?: string;
  worktreeDir?: string; // Base directory for worktree placement (defaults to .worktrees)
}

// ==================== Argument Parsing ====================

function parseArgs(args: string[]): ParsedArgs {
  const parsed: Partial<ParsedArgs> = {
    baseBranch: execSync('git branch --show-current', { encoding: 'utf-8' }).trim(),
    transport: 'worktree', // default transport
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];
    switch (arg) {
      case '--name': parsed.name = value; i++; break;
      case '--domain-id': parsed.domainId = value; i++; break;
      case '--base-branch': parsed.baseBranch = value; i++; break;
      case '--description': parsed.description = value; i++; break;
      case '--archetype': parsed.archetype = value; i++; break;
      case '--transport': 
        if (value !== 'worktree' && value !== 'directory') {
          console.error('Error: --transport must be "worktree" or "directory"');
          console.error(`  Received: "${value}"`);
          console.error('\nRecovery:');
          console.error('  1. Use "worktree" for git-based teams (recommended):');
          console.error('     npx tsx scripts/onboard.ts --name my-domain --domain-id abc-123 \\');
          console.error('       --archetype squad-archetype-deliverable --transport worktree');
          console.error('  2. Use "directory" for standalone teams without git:');
          console.error('     npx tsx scripts/onboard.ts --name my-domain --domain-id abc-123 \\');
          console.error('       --archetype squad-archetype-deliverable --transport directory --path /path/to/dir');
          process.exit(1);
        }
        parsed.transport = value as 'worktree' | 'directory';
        i++; 
        break;
      case '--path': parsed.path = value; i++; break;
      case '--worktree-dir': parsed.worktreeDir = value; i++; break;
    }
  }

  if (!parsed.name || !parsed.domainId || !parsed.archetype) {
    console.error('Usage:');
    console.error('  npx tsx scripts/onboard.ts \\');
    console.error('    --name "my-product" \\');
    console.error('    --domain-id "abc-123" \\');
    console.error('    --archetype "squad-archetype-deliverable" \\');
    console.error('    [--description "What this domain covers"] \\');
    console.error('    [--transport worktree|directory] \\');
    console.error('    [--worktree-dir .worktrees] \\');
    console.error('    [--path /custom/path] \\');
    console.error('    [--base-branch main]');
    process.exit(1);
  }

  // Validate transport-specific requirements
  if (parsed.transport === 'directory' && !parsed.path) {
    console.error('Error: --path is required when --transport is "directory"');
    console.error('\nRecovery:');
    console.error('  1. Add --path to specify the directory location:');
    console.error('     npx tsx scripts/onboard.ts --name my-domain --domain-id abc-123 \\');
    console.error('       --archetype squad-archetype-deliverable --transport directory --path /path/to/base');
    console.error('  2. Or switch to worktree transport (no --path needed):');
    console.error('     npx tsx scripts/onboard.ts --name my-domain --domain-id abc-123 \\');
    console.error('       --archetype squad-archetype-deliverable --transport worktree');
    process.exit(1);
  }

  // Validate archetype name format to prevent path traversal
  const ARCHETYPE_NAME_REGEX = /^[a-z0-9][a-z0-9-]*$/;
  if (!ARCHETYPE_NAME_REGEX.test(parsed.archetype)) {
    console.error('Error: Invalid archetype name. Use lowercase alphanumeric with hyphens only.');
    console.error(`  Received: "${parsed.archetype}"`);
    console.error('\nRecovery:');
    console.error('  1. Check available archetypes: copilot plugin list | grep archetype');
    console.error('  2. Use valid format (lowercase, hyphens, no special chars):');
    console.error('     - Valid: squad-archetype-deliverable');
    console.error('     - Valid: my-custom-archetype-v2');
    console.error('     - Invalid: MyArchetype (uppercase not allowed)');
    console.error('     - Invalid: archetype_name (underscores not allowed)');
    console.error('  3. Retry with correct archetype name:');
    console.error(`     npx tsx scripts/onboard.ts --name ${parsed.name} --domain-id ${parsed.domainId} \\`);
    console.error('       --archetype squad-archetype-deliverable');
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

/**
 * Recursively copy directory contents from source to destination.
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
  await fsp.mkdir(dest, { recursive: true });
  
  const entries = await fsp.readdir(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fsp.copyFile(srcPath, destPath);
    }
  }
}

// ==================== Transport Creation ====================

/**
 * Create transport for team workspace based on transport type.
 */
async function createTeamTransport(
  args: ParsedArgs,
  config: FederateConfig,
  repoRoot: string
): Promise<{ transport: WorktreePlacement | DirectoryPlacement; location: string; branch?: string }> {
  if (args.transport === 'worktree') {
    // Worktree transport: create git branch + worktree
    const branchName = `${BRANCH_PREFIX}${args.name}`;
    
    // Check if branch already exists
    try {
      exec(`git rev-parse --verify ${branchName}`, { silent: true });
      console.error(`⚠️  Branch '${branchName}' already exists.`);
      console.error(`   Domain '${args.name}' appears to be already onboarded.`);
      console.error('\nRecovery:');
      console.error('  1. If team is already set up, launch it instead:');
      console.error(`     npx tsx scripts/launch.ts --team ${args.name}`);
      console.error('  2. If you want to re-onboard with a clean state:');
      console.error(`     a. Check if worktree exists: git worktree list | grep ${args.name}`);
      console.error(`     b. Remove worktree: git worktree remove .worktrees/${args.name} --force`);
      console.error(`     c. Prune stale references: git worktree prune`);
      console.error(`     d. Delete branch: git branch -D ${branchName}`);
      console.error(`     e. Retry onboarding: npx tsx scripts/onboard.ts --name ${args.name} ...`);
      console.error('  3. If you want to use a different name, pick a unique domain name.');
      process.exit(1);
    } catch { /* doesn't exist — good */ }
    
    console.log(`Creating worktree transport for branch: ${branchName}`);
    const transport = await WorktreePlacement.create(
      repoRoot, 
      args.name, 
      args.baseBranch,
      args.worktreeDir  // Optional worktree base directory
    );
    
    // Calculate actual location based on worktreeDir
    const baseDir = args.worktreeDir || '.worktrees';
    const location = path.isAbsolute(baseDir) || baseDir.startsWith('../')
      ? path.join(baseDir, args.name)
      : path.join(repoRoot, baseDir, args.name);
    
    return { transport, location, branch: branchName };
  } else {
    // Directory transport: create directory at specified path
    const location = path.resolve(repoRoot, args.path!, args.name);
    
    if (fs.existsSync(location)) {
      console.error(`❌ Directory already exists: ${location}`);
      console.error('\nRecovery:');
      console.error('  1. Remove existing directory (WARNING: data will be lost):');
      console.error(`     rm -rf "${location}"`);
      console.error('  2. Or choose a different path:');
      console.error(`     npx tsx scripts/onboard.ts --name ${args.name} --domain-id ${args.domainId} \\`);
      console.error(`       --archetype ${args.archetype} --transport directory --path /different/path`);
      console.error('  3. Or use worktree transport instead (creates .worktrees subdirectory):');
      console.error(`     npx tsx scripts/onboard.ts --name ${args.name} --domain-id ${args.domainId} \\`);
      console.error(`       --archetype ${args.archetype} --transport worktree`);
      process.exit(1);
    }
    
    console.log(`Creating directory transport at: ${location}`);
    await fsp.mkdir(location, { recursive: true });
    
    const basePathMap = new Map<string, string>();
    basePathMap.set(args.name, location);
    const transport = new DirectoryPlacement(basePathMap);
    
    return { transport, location };
  }
}

// ==================== Team Directory Seeding ====================

/**
 * Seed team/ directory from archetype plugin.
 * Copies: skills/, templates/, archetype.json (and anything else in team/)
 */
async function seedTeamDirectory(
  archetypeName: string,
  teamLocation: string,
  repoRoot: string
): Promise<void> {
  // Locate archetype plugin
  const archetypePluginPath = path.join(repoRoot, 'plugins', archetypeName);
  const archetypeTeamPath = path.join(archetypePluginPath, 'team');
  
  if (!fs.existsSync(archetypeTeamPath)) {
    console.warn(`⚠️  Archetype team/ directory not found: ${archetypeTeamPath}`);
    console.warn(`   Skipping team/ seeding (archetype may not be restructured yet)`);
    return;
  }
  
  console.log(`Seeding team/ directory from archetype: ${archetypeName}`);
  await copyDirectory(archetypeTeamPath, teamLocation);
  console.log('✓ Team directory seeded');
}

// ==================== Federation Scaffolding ====================

function scaffoldFederation(teamLocation: string, repoRoot: string, args: ParsedArgs, config: FederateConfig, archetypeName: string): void {
  console.log('Scaffolding federation state...');

  const squadDir = path.join(teamLocation, '.squad');
  const signalsDir = path.join(squadDir, 'signals');

  // Signal protocol directories
  fs.mkdirSync(path.join(signalsDir, 'inbox'), { recursive: true });
  fs.mkdirSync(path.join(signalsDir, 'outbox'), { recursive: true });
  fs.mkdirSync(path.join(squadDir, 'learnings'), { recursive: true });

  // Try to read version from archetype's plugin.json
  const pluginJsonPath = path.join(repoRoot, 'plugins', archetypeName, 'plugin.json');
  let version = '0.1.0'; // fallback
  try {
    const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'));
    version = pluginJson.version || '0.1.0';
  } catch { /* use fallback */ }

  // Write archetype.json
  const archetypeJson = {
    name: archetypeName,
    version,
    source: 'vladi-plugins-marketplace',
    installedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(squadDir, 'archetype.json'), JSON.stringify(archetypeJson, null, 2));
  console.log('  ✓ Wrote .squad/archetype.json');

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
**Archetype:** ${args.archetype}

## Signal Protocol
This squad uses the inter-squad signal protocol:
- Read .squad/signals/inbox/ before each major step
- Write progress to .squad/signals/status.json
- Report blockers/findings to .squad/signals/outbox/
`;
  fs.writeFileSync(path.join(worktreePath, 'DOMAIN_CONTEXT.md'), contextMd);

  console.log('✓ Federation state scaffolded');

  // Scaffold archetype (always required for federated teams)
  scaffoldArchetype(worktreePath, repoRoot, args.archetype);
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
  const config = loadAndValidateConfig(path.join(REPO_ROOT, 'federate.config.json'));
  const args = parseArgs(process.argv.slice(2));
  const domainTitle = toTitleCase(args.name);

  console.log(`\n🏗️  Onboarding domain: ${domainTitle}`);
  console.log(`   Domain ID: ${args.domainId}`);
  console.log(`   Transport: ${args.transport}`);
  if (args.description) console.log(`   Description: ${args.description}`);
  console.log('');

  // Step 1: Create team transport (worktree or directory)
  const { transport, location, branch } = await createTeamTransport(args, config, REPO_ROOT);
  console.log(`✓ Team workspace created: ${location}`);

  // Step 2: Seed team/ directory from archetype (skills, templates, archetype.json)
  await seedTeamDirectory(args.archetype, location, REPO_ROOT);

  // Step 3: Scaffold federation state (signals, learnings, ceremonies, telemetry, archetype.json)
  scaffoldFederation(location, REPO_ROOT, args, config, args.archetype);

  // Step 4: Write DOMAIN_CONTEXT.md
  const contextMd = `# ${domainTitle} Domain

**Domain ID:** ${args.domainId}
${args.description ? `**Description:** ${args.description}\n` : ''}
**Archetype:** ${args.archetype}
**Created:** ${new Date().toISOString()}

## Purpose

${args.description || 'This domain squad is responsible for...'}

## Responsibilities

- TODO: Define domain boundaries
- TODO: List key responsibilities
- TODO: Document interfaces with other domains

## Dependencies

- TODO: List domains this one depends on
- TODO: List domains that depend on this one
`;
  fs.writeFileSync(path.join(location, 'DOMAIN_CONTEXT.md'), contextMd);

  // Step 5: Clean up meta-squad files for worktree teams
  if (args.transport === 'worktree') {
    cleanMetaSquadFiles(location);
  }

  // Step 6: Let Squad handle team casting
  console.log('Initializing squad (team casting handled by Squad)...');
  try {
    exec('squad init', { cwd: location });
    console.log('✓ Squad initialized — team will be cast on first session');
  } catch {
    console.log('  ⚠️  squad init not available — team will be cast on first session');
  }

  // Step 7: Register team in TeamRegistry
  console.log('Registering team in registry...');
  const registry = new TeamRegistry(REPO_ROOT);
  
  const teamEntry: TeamEntry = {
    domain: args.name,
    domainId: args.domainId,
    transport: args.transport,
    location: location,
    createdAt: new Date().toISOString(),
  };
  
  await registry.register(teamEntry);
  console.log('✓ Team registered');

  // Step 8: Commit for worktree transport
  if (args.transport === 'worktree') {
    console.log('Creating initial commit...');
    exec('git add -A', { cwd: location });
    exec(`git commit -m "feat: onboard ${args.name} domain

Domain: ${domainTitle}
Archetype: ${args.archetype}
Description: ${args.description || 'N/A'}

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"`, { cwd: location });
    console.log('✓ Initial commit created');
  }

  console.log(`\n✅ Domain onboarded successfully!`);
  console.log(`   Location: ${location}`);
  if (branch) console.log(`   Branch: ${branch}`);
  console.log(`\n📚 Next steps:`);
  console.log(`   1. Launch the team: npx tsx scripts/launch.ts --team ${args.name}`);
  console.log(`   2. Monitor progress: npx tsx scripts/monitor.ts`);
  console.log(`   3. Send directives: npx tsx scripts/directive.ts --team ${args.name} --message "..."`);
}

main().catch((err) => {
  console.error(`\n❌ Onboarding failed: ${err.message}`);
  console.error('\nRecovery:');
  console.error('  1. Check if git repository is initialized:');
  console.error('     git status');
  console.error('  2. Verify federation is configured:');
  console.error('     cat federate.config.json');
  console.error('  3. Ensure working directory is clean:');
  console.error('     git status --short');
  console.error('  4. Check available archetypes:');
  console.error('     copilot plugin list | grep archetype');
  console.error('  5. Review full error above for specific failure details');
  console.error('  6. If archetype installation failed, install manually:');
  console.error('     copilot plugin install <archetype-name>@vladi-plugins-marketplace');
  console.error('  7. Check disk space and file permissions');
  process.exit(1);
});
