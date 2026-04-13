#!/usr/bin/env tsx
/**
 * Launch — Headless Squad Team Sessions
 *
 * Pure plumbing: resolves a prompt, then sends it to a team's worktree
 * session. Knows nothing about archetypes or deliverables.
 *
 * Prompt resolution order:
 *   1. --prompt "string"          (CLI flag)
 *   2. --prompt-file path         (CLI flag)
 *   3. .squad/launch-prompt.md    (team-level template in worktree)
 *   4. Generic fallback           (minimal built-in prompt)
 *
 * Usage:
 *   npx tsx scripts/launch.ts --team my-a-team
 *   npx tsx scripts/launch.ts --team my-a-team --reset
 *   npx tsx scripts/launch.ts --team my-a-team --step distillation
 *   npx tsx scripts/launch.ts --team my-a-team --prompt "Do the thing"
 *   npx tsx scripts/launch.ts --team my-a-team --prompt-file ./custom.md
 *   npx tsx scripts/launch.ts --teams team-a,team-b
 *   npx tsx scripts/launch.ts --all
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  discoverDomains,
  validateWorktree,
  initializeSignals,
  type DomainWorktree,
} from './lib/signals.js';
import { loadAndValidateConfig, type FederateConfig } from './lib/config.js';

// ==================== Configuration ====================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// REPO_ROOT must be the user's project, not the plugin install directory.
// Scripts run via `npx tsx` from the user's cwd.
const REPO_ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();

// ==================== Types ====================

function readDomainId(worktreePath: string, fallback: string): string {
  // Try DOMAIN_CONTEXT.md first
  const contextPath = path.join(worktreePath, 'DOMAIN_CONTEXT.md');
  if (fs.existsSync(contextPath)) {
    const content = fs.readFileSync(contextPath, 'utf-8');
    const match = content.match(/^Domain ID:\s*(.+)$/m);
    if (match && match[1].trim()) return match[1].trim();
  }

  // Fall back to .squad/team.md
  const teamPath = path.join(worktreePath, '.squad', 'team.md');
  if (fs.existsSync(teamPath)) {
    const content = fs.readFileSync(teamPath, 'utf-8');
    const match = content.match(/^Domain ID:\s*(.+)$/m);
    if (match && match[1].trim()) return match[1].trim();
  }

  return fallback;
}

type RunType = 'first-run' | 'refresh' | 'reset';

// ==================== Config Loading ====================
// Config loading now uses validated config from lib/config.ts

// ==================== Helpers ====================

function detectRunType(worktreePath: string, isReset: boolean): RunType {
  const statusPath = path.join(worktreePath, '.squad', 'signals', 'status.json');
  if (!fs.existsSync(statusPath)) return 'first-run';
  return isReset ? 'reset' : 'refresh';
}

function resetTeam(worktreePath: string): void {
  console.log('🔄 Reset mode: clearing core state...');

  // Reset status.json
  const statusPath = path.join(worktreePath, '.squad', 'signals', 'status.json');
  if (fs.existsSync(statusPath)) {
    fs.unlinkSync(statusPath);
    console.log('  ✓ Removed status.json');
  }

  // Clear inbox acknowledgments (ack files, not the directives themselves)
  const inboxDir = path.join(worktreePath, '.squad', 'signals', 'inbox');
  if (fs.existsSync(inboxDir)) {
    for (const f of fs.readdirSync(inboxDir)) {
      if (f.endsWith('.ack')) {
        fs.unlinkSync(path.join(inboxDir, f));
      }
    }
    console.log('  ✓ Cleared inbox acknowledgments');
  }

  // Run cleanup hook if present
  const hooksToTry = [
    { file: '.squad/cleanup-hook.sh', runner: 'bash' },
    { file: '.squad/cleanup-hook.ts', runner: 'npx tsx' },
  ];
  for (const hook of hooksToTry) {
    const hookPath = path.join(worktreePath, hook.file);
    if (fs.existsSync(hookPath)) {
      console.log(`  ⚙ Running cleanup hook: ${hook.file}`);
      try {
        execSync(`${hook.runner} "${hookPath}"`, { cwd: worktreePath, stdio: 'pipe' });
        console.log(`  ✓ Cleanup hook completed`);
      } catch (err) {
        console.warn(`  ⚠ Cleanup hook failed: ${(err as Error).message}`);
      }
      break; // run only the first hook found
    }
  }

  // Commit cleanup
  try {
    execSync('git add -A && git commit -m "reset: clear core state for fresh run" --allow-empty', {
      cwd: worktreePath, stdio: 'pipe',
    });
  } catch { /* ignore */ }

  console.log('✓ Team reset complete.\n');
}

// ==================== Prompt Resolution ====================

// Signal protocol instructions — ALWAYS appended to every prompt regardless of source.
// Without these, headless sessions won't update status.json or check directives.
function signalInstructions(team: string): string {
  return `
---
## Signal Protocol (required)
- Check .squad/signals/inbox/ for directives before starting work.
- Report progress to .squad/signals/status.json — update "state" and "step" fields.
  States: initializing → scanning → distilling → complete (or failed).
- You are running in HEADLESS mode — do not ask questions, do not wait for input.
`;
}

function genericFallback(team: string, runType: RunType, config: FederateConfig): string {
  const runLabel =
    runType === 'first-run' ? 'This is your FIRST RUN.' :
    runType === 'refresh'   ? 'This is a RE-RUN (prior state exists).' :
                              'This is a FRESH START (artifacts cleared).';

  return `You are team ${team}. Read DOMAIN_CONTEXT.md for your mission.
Follow your ${config.playbookSkill} skill.

${runLabel}`;
}

interface PromptSource {
  cliPrompt: string | null;
  cliPromptFile: string | null;
}

function resolvePrompt(
  team: string,
  worktreePath: string,
  runType: RunType,
  config: FederateConfig,
  source: PromptSource,
): string {
  let base: string;

  // 1. --prompt CLI flag
  if (source.cliPrompt) {
    base = source.cliPrompt;
  }
  // 2. --prompt-file CLI flag
  else if (source.cliPromptFile) {
    const resolved = path.resolve(source.cliPromptFile);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Prompt file not found: ${resolved}`);
    }
    base = fs.readFileSync(resolved, 'utf-8');
  }
  // 3. Team-level template
  else if (fs.existsSync(path.join(worktreePath, '.squad', 'launch-prompt.md'))) {
    const templatePath = path.join(worktreePath, '.squad', 'launch-prompt.md');
    let tmpl = fs.readFileSync(templatePath, 'utf-8');
    tmpl = tmpl.replace(/\{team\}/g, team);
    tmpl = tmpl.replace(/\{runType\}/g, runType);
    tmpl = tmpl.replace(/\{playbookSkill\}/g, config.playbookSkill);
    base = tmpl;
  }
  // 4. Generic fallback
  else {
    base = genericFallback(team, runType, config);
  }

  // Always append signal protocol instructions
  return base + signalInstructions(team);
}

function buildStepPrompt(
  team: string,
  step: string,
  worktreePath: string,
  config: FederateConfig,
  source: PromptSource,
): string {
  let base: string;

  if (source.cliPrompt || source.cliPromptFile) {
    const raw = source.cliPrompt ?? fs.readFileSync(path.resolve(source.cliPromptFile!), 'utf-8');
    base = `${raw}\n\nRun ONLY the "${step}" step.`;
  } else {
    base = `Team ${team}, run ONLY step "${step}" from your ${config.playbookSkill} skill.

After completion:
- Update .squad/signals/status.json (state: complete, step: "${step}")`;
  }

  // Always append signal protocol instructions
  return base + signalInstructions(team);
}

// ==================== Launch ====================

function launchTeam(
  worktree: DomainWorktree,
  config: FederateConfig,
  isReset: boolean,
  targetStep: string | null,
  promptSource: PromptSource,
): void {
  if (targetStep && isReset) {
    console.error('   ❌ Cannot use --step with --reset.');
    return;
  }

  const validation = validateWorktree(worktree.path);
  if (!validation.valid) {
    console.error(`   ❌ Invalid worktree: ${validation.issues.join(', ')}`);
    return;
  }

  const runType = detectRunType(worktree.path, isReset);

  // Status header
  const emoji = runType === 'first-run' ? '🆕' : runType === 'reset' ? '🔄' : '🚀';
  const mode = targetStep ? `STEP: ${targetStep}` : runType;
  console.log(`\n${emoji} Launching ${mode} for team ${worktree.domain}`);
  console.log(`   Worktree: ${worktree.path}`);

  if (isReset && runType === 'reset') {
    resetTeam(worktree.path);
  }

  const domainId = readDomainId(worktree.path, worktree.domain);
  initializeSignals(worktree.path, worktree.domain, domainId);
  console.log('   📡 Signals initialized');

  // Resolve prompt
  const prompt = targetStep
    ? buildStepPrompt(worktree.domain, targetStep, worktree.path, config, promptSource)
    : resolvePrompt(worktree.domain, worktree.path, runType, config, promptSource);

  // Prepare log file
  const logFile = path.join(worktree.path, 'run-output.log');
  const logStream = fs.openSync(logFile, 'w');

  // Build MCP args from config
  const mcpArgs: string[] = [];
  for (const mcp of config.mcpStack) {
    mcpArgs.push('--mcp', mcp);
  }

  // OTel MCP config (if telemetry enabled)
  // Write .mcp.json into the worktree so the headless session auto-discovers it.
  // This is more reliable than --additional-mcp-config which depends on npx/tsx resolution.
  if (config.telemetry.enabled) {
    const otelServerPath = path.resolve(__dirname, 'mcp-otel-server.ts');
    if (!fs.existsSync(otelServerPath)) {
      console.warn(`   ⚠️  OTel MCP server not found at ${otelServerPath}, skipping telemetry`);
    } else {
      const worktreeMcpConfig = {
        mcpServers: {
          'squad-otel': {
            command: 'npx',
            args: ['tsx', otelServerPath],
            env: {
              OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
              OTEL_SERVICE_NAME: `squad-${worktree.domain}`,
              SQUAD_DOMAIN: worktree.domain,
            },
          },
        },
      };
      const mcpJsonPath = path.join(worktree.path, '.mcp.json');
      fs.writeFileSync(mcpJsonPath, JSON.stringify(worktreeMcpConfig, null, 2));
      console.log(`   🔭 OTel MCP config written to ${mcpJsonPath}`);
    }
  }

  // Launch via copilot (or agency copilot)
  const launcher = process.env.SQUAD_LAUNCHER || 'copilot';
  const launcherArgs = launcher === 'agency'
    ? ['copilot', '--agent', 'squad', '-p', prompt, '--yolo', '--no-ask-user', '--autopilot', ...mcpArgs]
    : ['-p', prompt, '--yolo', '--no-ask-user', '--autopilot', ...mcpArgs];

  const proc = spawn(launcher, launcherArgs, {
    cwd: worktree.path,
    stdio: ['ignore', logStream, logStream],
    detached: true,
    env: process.env,
  });

  proc.unref();

  console.log(`   ✅ Launched — PID: ${proc.pid}`);
  console.log(`   📄 Log: ${logFile}`);
  console.log(`   📊 Status: .squad/signals/status.json`);
}

// ==================== CLI ====================

function main(): void {
  const args = process.argv.slice(2);
  let teamName: string | null = null;
  let allMode = false;
  let isReset = false;
  let targetStep: string | null = null;
  let teamList: string[] = [];
  let cliPrompt: string | null = null;
  let cliPromptFile: string | null = null;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--team': case '--domain': case '--offering': teamName = args[++i]; break;
      case '--teams': case '--domains': case '--offerings': teamList = args[++i].split(','); break;
      case '--all': allMode = true; break;
      case '--reset': isReset = true; break;
      case '--step': targetStep = args[++i]; break;
      case '--prompt': cliPrompt = args[++i]; break;
      case '--prompt-file': cliPromptFile = args[++i]; break;
    }
  }

  if (!teamName && !allMode && teamList.length === 0) {
    console.error('Usage:');
    console.error('  npx tsx scripts/launch.ts --team <name>');
    console.error('  npx tsx scripts/launch.ts --team <name> --reset');
    console.error('  npx tsx scripts/launch.ts --team <name> --step <step>');
    console.error('  npx tsx scripts/launch.ts --team <name> --prompt "do X"');
    console.error('  npx tsx scripts/launch.ts --team <name> --prompt-file ./task.md');
    console.error('  npx tsx scripts/launch.ts --teams team-a,team-b');
    console.error('  npx tsx scripts/launch.ts --all');
    process.exit(1);
  }

  const config = loadAndValidateConfig(path.join(REPO_ROOT, 'federate.config.json'));
  const worktrees = discoverDomains(REPO_ROOT);
  const promptSource: PromptSource = { cliPrompt, cliPromptFile };

  if (allMode) {
    if (worktrees.length === 0) { console.log('No team worktrees found.'); return; }
    console.log(`Found ${worktrees.length} team(s):`);
    worktrees.forEach((wt, i) => console.log(`  ${i + 1}. ${wt.domain} (${wt.branch})`));
    worktrees.forEach(wt => launchTeam(wt, config, isReset, targetStep, promptSource));
    console.log(`\n✅ Launched ${worktrees.length} team(s). Monitor with: npx tsx scripts/monitor.ts --watch`);
  } else {
    const targets = teamName ? [teamName] : teamList;
    const matched = worktrees.filter(wt => targets.includes(wt.domain));
    if (matched.length === 0) {
      console.error(`Team(s) not found: ${targets.join(', ')}`);
      console.log('Available:', worktrees.map(w => w.domain).join(', ') || '(none)');
      process.exit(1);
    }
    matched.forEach(wt => launchTeam(wt, config, isReset, targetStep, promptSource));
  }
}

main();
