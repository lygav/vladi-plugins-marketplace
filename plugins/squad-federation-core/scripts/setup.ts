#!/usr/bin/env tsx
/**
 * Setup — Initialize a new federation from scratch
 *
 * Implements the "script-drives-skill" model (ADR-001):
 * - Validates prerequisites (git repo, Squad installed, Node 20+)
 * - Writes federate.config.json with provided options
 * - Initializes .squad/ directory if it doesn't exist
 * - Creates team registry file
 * - Emits OTel events for observability
 * - Returns structured JSON summary
 *
 * The federation-setup skill is a thin conversational wrapper that
 * collects user preferences and delegates to this script.
 *
 * Usage:
 *   # Minimal setup:
 *   npx tsx scripts/setup.ts --description "My federation" --non-interactive
 *
 *   # Full setup:
 *   npx tsx scripts/setup.ts \
 *     --description "Coordinate security audits" \
 *     --telemetry --telemetry-endpoint http://localhost:4318 \
 *     --teams-notification --teams-team-id xxx --teams-channel-id 19:xxx@thread.tacv2 \
 *     --heartbeat --heartbeat-interval 300 \
 *     --non-interactive --output-format json
 *
 *   # Dry run:
 *   npx tsx scripts/setup.ts --description "test" --dry-run --output-format json
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { OTelEmitter } from '../sdk/otel-emitter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cross-platform stop script dropped into the user's project root
const STOP_PRESENCE_SCRIPT = `#!/usr/bin/env node
// stop-presence.js — Cross-platform presence/heartbeat killer
// Usage: node stop-presence.js
const fs = require('fs');
const path = require('path');
const names = ['presence.pid', 'heartbeat.pid'];
let found = false;
for (const name of names) {
  const pidFile = path.join(__dirname, '.squad', name);
  if (!fs.existsSync(pidFile)) continue;
  const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
  if (isNaN(pid)) { fs.unlinkSync(pidFile); continue; }
  try { process.kill(pid, 0); } catch { console.log(name + ': not running (stale). Cleaned up.'); fs.unlinkSync(pidFile); continue; }
  try { process.kill(pid); fs.unlinkSync(pidFile); console.log('Stopped ' + name.replace('.pid','') + ' (pid ' + pid + ').'); found = true; } catch (e) { console.error('Failed:', e.message); }
}
if (!found) console.log('No presence or heartbeat running.');
`;

// ==================== Types ====================

export interface ParsedSetupArgs {
  description: string;
  federationName?: string;
  copilotCommand?: string;
  telemetry: boolean;
  telemetryEndpoint?: string;
  teamsNotification: boolean;
  teamsTeamId?: string;
  teamsChannelId?: string;
  heartbeat: boolean;
  heartbeatInterval?: number;
  nonInteractive: boolean;
  outputFormat: 'text' | 'json';
  dryRun: boolean;
}

export interface PrerequisiteResult {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  version?: string;
  message?: string;
}

export interface SetupResult {
  success: boolean;
  configPath: string;
  config: Record<string, unknown>;
  squadDir: string;
  registryPath: string;
  prerequisites: PrerequisiteResult[];
  dryRun: boolean;
  errors?: string[];
  warnings?: string[];
  heartbeatPid?: number;
}

// ==================== Argument Parsing ====================

export function parseSetupArgs(args: string[]): ParsedSetupArgs {
  const parsed: Partial<ParsedSetupArgs> & {
    nonInteractive: boolean;
    outputFormat: 'text' | 'json';
    dryRun: boolean;
    telemetry: boolean;
    teamsNotification: boolean;
    heartbeat: boolean;
  } = {
    telemetry: true,       // default: enabled
    teamsNotification: false,
    heartbeat: false,
    nonInteractive: false,
    outputFormat: 'text',
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];
    switch (arg) {
      case '--description': parsed.description = value; i++; break;
      case '--federation-name': parsed.federationName = value; i++; break;
      case '--copilot-command': parsed.copilotCommand = value; i++; break;
      case '--telemetry': parsed.telemetry = true; break;
      case '--no-telemetry': parsed.telemetry = false; break;
      case '--telemetry-endpoint': parsed.telemetryEndpoint = value; i++; break;
      case '--teams-notification': parsed.teamsNotification = true; break;
      case '--teams-team-id': parsed.teamsTeamId = value; i++; break;
      case '--teams-channel-id': parsed.teamsChannelId = value; i++; break;
      case '--heartbeat': parsed.heartbeat = true; break;
      case '--no-heartbeat': parsed.heartbeat = false; break;
      case '--heartbeat-interval':
        const interval = parseInt(value, 10);
        if (isNaN(interval) || interval < 10) {
          console.error('Error: --heartbeat-interval must be an integer >= 10');
          process.exit(1);
        }
        parsed.heartbeatInterval = interval;
        i++;
        break;
      case '--non-interactive': parsed.nonInteractive = true; break;
      case '--output-format':
        if (value !== 'text' && value !== 'json') {
          console.error('Error: --output-format must be "text" or "json"');
          process.exit(1);
        }
        parsed.outputFormat = value as 'text' | 'json';
        i++;
        break;
      case '--dry-run': parsed.dryRun = true; break;
    }
  }

  if (!parsed.description) {
    console.error('Error: --description is required');
    console.error('\nUsage:');
    console.error('  npx tsx scripts/setup.ts --description "My federation" [options]');
    console.error('\nOptions:');
    console.error('  --telemetry / --no-telemetry      Enable/disable telemetry (default: enabled)');
    console.error('  --federation-name <name>           Meta-squad persona name (e.g., "artemis")');
    console.error('  --telemetry-endpoint <url>         OTel endpoint URL');
    console.error('  --teams-notification               Enable Teams notifications');
    console.error('  --teams-team-id <id>               Teams workspace ID');
    console.error('  --teams-channel-id <id>            Teams channel ID');
    console.error('  --heartbeat / --no-heartbeat       Enable/disable heartbeat');
    console.error('  --heartbeat-interval <seconds>     Heartbeat interval (default: 300)');
    console.error('  --non-interactive                  No stdin prompts');
    console.error('  --output-format <text|json>        Output format');
    console.error('  --dry-run                          Validate only, don\'t write files');
    process.exit(1);
  }

  // Validate Teams config completeness
  if (parsed.teamsNotification) {
    if (!parsed.teamsTeamId || !parsed.teamsChannelId) {
      console.error('Error: --teams-notification requires --teams-team-id and --teams-channel-id');
      process.exit(1);
    }
  }

  return parsed as ParsedSetupArgs;
}

// ==================== Helpers ====================

function exec(cmd: string, opts: { cwd?: string; silent?: boolean } = {}): string {
  try {
    return (execSync(cmd, { cwd: opts.cwd, encoding: 'utf-8', stdio: opts.silent ? 'pipe' : 'inherit' }) || '').trim();
  } catch (e: any) {
    throw e;
  }
}

function outputJson(result: SetupResult): void {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

function log(args: ParsedSetupArgs, ...messages: string[]): void {
  if (args.outputFormat !== 'json') {
    console.log(...messages);
  }
}

// ==================== Prerequisites ====================

export function checkPrerequisites(repoRoot: string): PrerequisiteResult[] {
  const results: PrerequisiteResult[] = [];

  // Check git
  try {
    const gitVersion = execSync('git --version', { encoding: 'utf-8', stdio: 'pipe' }).trim();
    const match = gitVersion.match(/(\d+)\.(\d+)/);
    if (match) {
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      if (major > 2 || (major === 2 && minor >= 20)) {
        results.push({ name: 'git', status: 'ok', version: gitVersion.replace('git version ', '') });
      } else {
        results.push({ name: 'git', status: 'fail', version: gitVersion, message: 'Git 2.20+ required' });
      }
    } else {
      results.push({ name: 'git', status: 'fail', message: 'Could not parse git version' });
    }
  } catch {
    results.push({ name: 'git', status: 'fail', message: 'git not found — install from https://git-scm.com' });
  }

  // Check git repo
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: repoRoot, encoding: 'utf-8', stdio: 'pipe' });
    results.push({ name: 'git-repo', status: 'ok' });
  } catch {
    results.push({ name: 'git-repo', status: 'fail', message: 'Not inside a git repository — run git init first' });
  }

  // Check uncommitted changes
  try {
    const status = execSync('git status --porcelain', { cwd: repoRoot, encoding: 'utf-8', stdio: 'pipe' }).trim();
    if (status) {
      const count = status.split('\n').length;
      results.push({ name: 'git-clean', status: 'warn', message: `${count} uncommitted change(s) — recommend committing first` });
    } else {
      results.push({ name: 'git-clean', status: 'ok' });
    }
  } catch {
    results.push({ name: 'git-clean', status: 'warn', message: 'Could not check git status' });
  }

  // Check Node.js 20+
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf-8', stdio: 'pipe' }).trim();
    const nodeMatch = nodeVersion.match(/v(\d+)\./);
    if (nodeMatch && parseInt(nodeMatch[1], 10) >= 20) {
      results.push({ name: 'node', status: 'ok', version: nodeVersion });
    } else {
      results.push({ name: 'node', status: 'fail', version: nodeVersion, message: 'Node.js 20+ required — run nvm install 20' });
    }
  } catch {
    results.push({ name: 'node', status: 'fail', message: 'Node.js not found' });
  }

  // Check Squad
  try {
    const squadVersion = execSync('squad --version', { encoding: 'utf-8', stdio: 'pipe' }).trim();
    results.push({ name: 'squad', status: 'ok', version: squadVersion });
  } catch {
    results.push({ name: 'squad', status: 'warn', message: 'Squad CLI not found — install from https://github.com/bradygaster/squad' });
  }

  // Check Docker (optional)
  try {
    const dockerVersion = execSync('docker --version', { encoding: 'utf-8', stdio: 'pipe' }).trim();
    results.push({ name: 'docker', status: 'ok', version: dockerVersion.replace('Docker version ', '') });
  } catch {
    results.push({ name: 'docker', status: 'warn', message: 'Docker not found — OTel dashboard unavailable' });
  }

  return results;
}

// ==================== Config Generation ====================

export function buildConfig(args: ParsedSetupArgs): Record<string, unknown> {
  const config: Record<string, unknown> = {
    description: args.description,
    ...(args.federationName ? { federationName: args.federationName } : {}),
    ...(args.copilotCommand ? { copilotCommand: args.copilotCommand } : {}),
    telemetry: {
      enabled: args.telemetry,
      ...(args.telemetryEndpoint ? { endpoint: args.telemetryEndpoint } : {}),
    },
  };

  if (args.teamsNotification && args.teamsTeamId && args.teamsChannelId) {
    config.teamsConfig = {
      teamId: args.teamsTeamId,
      channelId: args.teamsChannelId,
    };
  }

  if (args.heartbeat) {
    config.heartbeat = {
      enabled: true,
      ...(args.heartbeatInterval ? { intervalSeconds: args.heartbeatInterval } : {}),
    };
  }

  return config;
}

// ==================== Dry Run Validation ====================

export function validateDryRun(args: ParsedSetupArgs, repoRoot: string): SetupResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const configPath = path.join(repoRoot, 'federate.config.json');
  const squadDir = path.join(repoRoot, '.squad');
  const registryPath = path.join(squadDir, 'teams.json');

  // Check prerequisites
  const prerequisites = checkPrerequisites(repoRoot);
  const hasFatalPrereq = prerequisites.some(p => p.status === 'fail');
  if (hasFatalPrereq) {
    for (const p of prerequisites.filter(r => r.status === 'fail')) {
      errors.push(`Prerequisite failed: ${p.name} — ${p.message}`);
    }
  }
  for (const p of prerequisites.filter(r => r.status === 'warn')) {
    warnings.push(`${p.name}: ${p.message}`);
  }

  // Check if config already exists
  if (fs.existsSync(configPath)) {
    warnings.push('federate.config.json already exists — will be overwritten');
  }

  const config = buildConfig(args);

  return {
    success: errors.length === 0,
    configPath,
    config,
    squadDir,
    registryPath,
    prerequisites,
    dryRun: true,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// ==================== Main ====================

async function main(): Promise<void> {
  const args = parseSetupArgs(process.argv.slice(2));
  // Pass endpoint directly — config file doesn't exist yet during setup
  const emitter = new OTelEmitter(args.telemetry ? args.telemetryEndpoint : undefined);

  await emitter.span('setup.script', async () => {
    const REPO_ROOT = process.cwd();

    // Dry run: validate and return without side effects
    if (args.dryRun) {
      const result = validateDryRun(args, REPO_ROOT);
      if (args.outputFormat === 'json') {
        outputJson(result);
      } else if (result.success) {
        log(args, '✅ Dry run passed — federation setup would succeed');
        if (result.warnings?.length) {
          for (const w of result.warnings) log(args, `  ⚠️  ${w}`);
        }
      } else {
        console.error('❌ Dry run failed:');
        for (const err of result.errors!) console.error(`  ${err}`);
      }
      process.exit(result.success ? 0 : 1);
    }

    // Step 1: Check prerequisites
    log(args, '\n🔍 Checking prerequisites...');
    const prerequisites = checkPrerequisites(REPO_ROOT);
    const hasFatalPrereq = prerequisites.some(p => p.status === 'fail');

    for (const p of prerequisites) {
      const icon = p.status === 'ok' ? '✅' : p.status === 'warn' ? '⚠️ ' : '❌';
      log(args, `  ${icon} ${p.name}${p.version ? ` ${p.version}` : ''}${p.message ? ` — ${p.message}` : ''}`);
    }

    if (hasFatalPrereq) {
      const errors = prerequisites.filter(p => p.status === 'fail').map(p => `${p.name}: ${p.message}`);
      if (args.outputFormat === 'json') {
        outputJson({
          success: false,
          configPath: path.join(REPO_ROOT, 'federate.config.json'),
          config: {},
          squadDir: path.join(REPO_ROOT, '.squad'),
          registryPath: path.join(REPO_ROOT, '.squad', 'teams.json'),
          prerequisites,
          dryRun: false,
          errors,
        });
      } else {
        console.error('\n❌ Prerequisites failed. Fix the issues above and retry.');
      }
      process.exit(1);
    }

    await emitter.event('prerequisites.validated', {
      git: prerequisites.find(p => p.name === 'git')?.status === 'ok' ? 'true' : 'false',
      node: prerequisites.find(p => p.name === 'node')?.status === 'ok' ? 'true' : 'false',
      squad: prerequisites.find(p => p.name === 'squad')?.status === 'ok' ? 'true' : 'false',
    });

    // Step 2: Build config
    const config = buildConfig(args);

    // Step 3: Write federate.config.json
    const configPath = path.join(REPO_ROOT, 'federate.config.json');
    log(args, '\n📝 Writing federate.config.json...');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    log(args, '  ✓ Config written');
    await emitter.event('config.written', { path: configPath });

    // Step 4: Initialize .squad/ directory
    const squadDir = path.join(REPO_ROOT, '.squad');
    log(args, '\n📁 Initializing .squad/ directory...');

    if (!fs.existsSync(squadDir)) {
      fs.mkdirSync(squadDir, { recursive: true });
      log(args, '  ✓ Created .squad/');
    } else {
      log(args, '  ⚠️  .squad/ already exists — preserving');
    }

    // Initialize squad if not already done
    const teamMdPath = path.join(squadDir, 'team.md');
    if (!fs.existsSync(teamMdPath)) {
      try {
        exec('squad init', { cwd: REPO_ROOT, silent: true });
        log(args, '  ✓ Squad initialized');
      } catch {
        log(args, '  ⚠️  squad init not available — initialize manually later');
      }
    } else {
      log(args, '  ✓ Squad already initialized');
    }

    // Step 5: Create team registry
    const registryPath = path.join(squadDir, 'teams.json');
    if (!fs.existsSync(registryPath)) {
      fs.writeFileSync(registryPath, JSON.stringify({ version: '1.0', teams: [] }, null, 2) + '\n');
      log(args, '  ✓ Team registry created');
    } else {
      log(args, '  ✓ Team registry already exists');
    }
    await emitter.event('registry.initialized', { path: registryPath });

    // Collect warnings
    const warnings: string[] = [];
    for (const p of prerequisites.filter(r => r.status === 'warn')) {
      warnings.push(`${p.name}: ${p.message}`);
    }

    // Step 6: Start presence/heartbeat if enabled
    let heartbeatPid: number | undefined;
    if (args.heartbeat) {
      // If Teams is configured, start teams-presence (persistent bridge)
      // Otherwise fall back to heartbeat (periodic copilot sessions)
      const usePresence = args.teamsNotification && args.teamsTeamId && args.teamsChannelId;
      const scriptName = usePresence ? 'teams-presence.ts' : 'meta-heartbeat.ts';
      const script = path.join(__dirname, scriptName);

      if (fs.existsSync(script)) {
        try {
          const intervalArgs = args.heartbeatInterval
            ? ['--interval', String(args.heartbeatInterval)]
            : [];
          const child = spawn('npx', ['tsx', script, ...intervalArgs], {
            cwd: REPO_ROOT,
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
          heartbeatPid = child.pid;
          if (usePresence) {
            log(args, `\n🌐 Teams presence started (pid ${heartbeatPid}, interval ${args.heartbeatInterval ?? 30}s)`);
          } else {
            log(args, `\n💓 Heartbeat started (pid ${heartbeatPid}, interval ${args.heartbeatInterval ?? 300}s)`);
          }
          await emitter.event('presence.started', { pid: heartbeatPid ?? 0, mode: usePresence ? 'teams-presence' : 'heartbeat' });
        } catch (err: any) {
          warnings.push(`${usePresence ? 'Presence' : 'Heartbeat'} failed to start: ${err.message}`);
          log(args, `\n⚠️  Failed to start: ${err.message}`);
        }
      } else {
        warnings.push(`${scriptName} not found`);
      }

      // Write cross-platform stop script to project root
      const stopScriptPath = path.join(REPO_ROOT, 'stop-presence.js');
      if (!fs.existsSync(stopScriptPath)) {
        fs.writeFileSync(stopScriptPath, STOP_PRESENCE_SCRIPT, 'utf-8');
        log(args, `   Stop with: node stop-presence.js`);
      }
    }

    await emitter.event('setup.complete');
    await emitter.log('info', 'Federation setup complete — ready to onboard teams');

    // Output result
    const result: SetupResult = {
      success: true,
      configPath,
      config,
      squadDir,
      registryPath,
      prerequisites,
      dryRun: false,
      warnings: warnings.length > 0 ? warnings : undefined,
      heartbeatPid,
    };

    if (args.outputFormat === 'json') {
      outputJson(result);
    } else {
      log(args, '\n✅ Federation setup complete!');
      log(args, `   Config: ${configPath}`);
      log(args, `   Squad dir: ${squadDir}`);
      log(args, `   Registry: ${registryPath}`);
      log(args, '\n📚 Next steps:');
      log(args, '   1. Cast your meta-squad: "Cast a leadership team for this federation"');
      log(args, '   2. Onboard your first team: "Spin up a team for X"');
    }
  });
}

// Only run main() when executed directly (not when imported by tests)
const isDirectExecution = process.argv[1]?.endsWith('setup.ts') || process.argv[1]?.endsWith('setup.js');
if (isDirectExecution) {
  main().catch((err) => {
    const isJsonOutput = process.argv.includes('--output-format') &&
      process.argv[process.argv.indexOf('--output-format') + 1] === 'json';
    if (isJsonOutput) {
      outputJson({
        success: false,
        configPath: 'federate.config.json',
        config: {},
        squadDir: '.squad',
        registryPath: '.squad/teams.json',
        prerequisites: [],
        dryRun: false,
        errors: [err.message],
      });
    } else {
      console.error(`\n❌ Setup failed: ${err.message}`);
    }
    process.exit(1);
  });
}
