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
import { createTeamContext } from './lib/team-context.js';
import { TeamRegistry } from './lib/team-registry.js';
import { loadAndValidateConfig, type FederateConfig } from './lib/config.js';
import type { TeamEntry, TeamCommunication, TeamPlacement } from '../sdk/types.js';

// ==================== Configuration ====================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// REPO_ROOT must be the user's project, not the plugin install directory.
// Scripts run via `npx tsx` from the user's cwd.
const REPO_ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();

type RunType = 'first-run' | 'refresh' | 'reset';

// ==================== Config Loading ====================
// Config loading now uses validated config from lib/config.ts

// ==================== Helpers ====================

async function detectRunType(
  communication: TeamCommunication,
  teamId: string,
  isReset: boolean
): Promise<RunType> {
  const status = await communication.readStatus(teamId);
  if (!status) return 'first-run';
  return isReset ? 'reset' : 'refresh';
}

async function validatePlacement(
  placement: TeamPlacement,
  teamId: string
): Promise<{ valid: boolean; issues: string[]; location: string }> {
  const issues: string[] = [];
  const location = await placement.getLocation(teamId);

  if (!await placement.workspaceExists(teamId)) {
    issues.push('Workspace does not exist');
  }

  if (!await placement.exists(teamId, '.squad')) {
    issues.push('Missing .squad directory');
  }

  if (!await placement.exists(teamId, '.squad/signals/inbox')) {
    issues.push('Missing .squad/signals/inbox');
  }

  if (!await placement.exists(teamId, '.squad/signals/outbox')) {
    issues.push('Missing .squad/signals/outbox');
  }

  return { valid: issues.length === 0, issues, location };
}

function resetTeam(worktreePath: string): void {
  console.log('🔄 Reset mode: clearing core state...');

  // Reset status.json
  const statusPath = path.join(worktreePath, '.squad', 'status.json');
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
- Report progress to .squad/status.json — update "state" and "step" fields.
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
      throw new Error(`Prompt file not found: ${resolved}

Recovery:
  1. Check if file path is correct:
     ls -la ${path.dirname(resolved)}
  2. Verify file exists:
     ls -la ${resolved}
  3. Use absolute path instead of relative:
     npx tsx scripts/launch.ts --team <name> --prompt-file /full/path/to/prompt.md
  4. Or use inline prompt instead:
     npx tsx scripts/launch.ts --team <name> --prompt "your task here"
  5. Or omit --prompt-file to use team's .squad/launch-prompt.md template`);
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
- Update .squad/status.json (state: complete, step: "${step}")`;
  }

  // Always append signal protocol instructions
  return base + signalInstructions(team);
}

// ==================== Launch ====================

async function launchTeam(
  team: TeamEntry,
  config: FederateConfig,
  isReset: boolean,
  targetStep: string | null,
  promptSource: PromptSource,
): Promise<void> {
  if (targetStep && isReset) {
    console.error('   ❌ Cannot use --step with --reset.');
    console.error('\nRecovery:');
    console.error('  1. To reset a team, use --reset alone:');
    console.error(`     npx tsx scripts/launch.ts --team ${team.domain} --reset`);
    console.error('  2. To launch with a specific step, use --step alone:');
    console.error(`     npx tsx scripts/launch.ts --team ${team.domain} --step "analyze codebase"`);
    console.error('  3. To reset AND run a step, do it in two commands:');
    console.error(`     npx tsx scripts/launch.ts --team ${team.domain} --reset`);
    console.error(`     npx tsx scripts/launch.ts --team ${team.domain} --step "your task"`);
    return;
  }

  const context = createTeamContext(team, config, REPO_ROOT);
  const validation = await validatePlacement(context.placement, team.domainId);
  if (!validation.valid) {
    console.error(`   ❌ Invalid workspace: ${validation.issues.join(', ')}`);
    console.error(`   Path: ${validation.location}`);
    console.error('\nRecovery:');
    console.error('  1. Check if worktree directory exists:');
    console.error(`     ls -la ${validation.location}`);
    console.error('  2. Verify .squad directory is initialized:');
    console.error(`     ls -la ${validation.location}/.squad`);
    console.error('  3. Re-initialize missing directories:');
    console.error(`     mkdir -p ${validation.location}/.squad/signals/{{inbox,outbox}}`);
    console.error(`     mkdir -p ${validation.location}/.squad/learnings`);
    console.error('  4. Or re-onboard the domain:');
    console.error(`     npx tsx scripts/onboard.ts --name ${team.domain} --domain-id <id> --archetype <name>`);
    console.error('  5. Check git worktree status:');
    console.error(`     git worktree list | grep ${team.domain}`);
    return;
  }

  const runType = await detectRunType(context.communication, team.domainId, isReset);
  const worktreePath = validation.location;

  // Status header
  const emoji = runType === 'first-run' ? '🆕' : runType === 'reset' ? '🔄' : '🚀';
  const mode = targetStep ? `STEP: ${targetStep}` : runType;
  console.log(`\n${emoji} Launching ${mode} for team ${team.domain}`);
  console.log(`   Worktree: ${worktreePath}`);

  if (isReset && runType === 'reset') {
    resetTeam(worktreePath);
  }

  // Resolve prompt
  const prompt = targetStep
    ? buildStepPrompt(team.domain, targetStep, worktreePath, config, promptSource)
    : resolvePrompt(team.domain, worktreePath, runType, config, promptSource);

  // Prepare log file
  const logFile = path.join(worktreePath, 'run-output.log');
  const logStream = fs.openSync(logFile, 'w');

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
              OTEL_SERVICE_NAME: `squad-${team.domain}`,
              SQUAD_DOMAIN: team.domain,
            },
          },
        },
      };
      const mcpJsonPath = path.join(worktreePath, '.mcp.json');
      fs.writeFileSync(mcpJsonPath, JSON.stringify(worktreeMcpConfig, null, 2));
      console.log(`   🔭 OTel MCP config written to ${mcpJsonPath}`);
    }
  }

  // Launch via copilot (or agency copilot)
  const launcher = process.env.SQUAD_LAUNCHER || 'copilot';
  const launcherArgs = launcher === 'agency'
    ? ['copilot', '--agent', 'squad', '-p', prompt, '--yolo', '--no-ask-user', '--autopilot']
    : ['-p', prompt, '--yolo', '--no-ask-user', '--autopilot'];

  const proc = spawn(launcher, launcherArgs, {
    cwd: worktreePath,
    stdio: ['ignore', logStream, logStream],
    detached: true,
    env: process.env,
  });

  proc.unref();

  console.log(`   ✅ Launched — PID: ${proc.pid}`);
  console.log(`   📄 Log: ${logFile}`);
  console.log(`   📊 Status: .squad/status.json`);
}

// ==================== CLI ====================

async function main(): Promise<void> {
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
  const registry = new TeamRegistry(REPO_ROOT);
  let teams = await registry.list();
  if (teams.length === 0) {
    const migrated = await registry.migrateFromWorktreeDiscovery(REPO_ROOT);
    if (migrated > 0) {
      teams = await registry.list();
    }
  }
  const promptSource: PromptSource = { cliPrompt, cliPromptFile };

  if (allMode) {
    if (teams.length === 0) { console.log('No registered teams found.'); return; }
    console.log(`Found ${teams.length} team(s):`);
    teams.forEach((team, i) => console.log(`  ${i + 1}. ${team.domain} (${team.archetypeId})`));
    for (const team of teams) {
      await launchTeam(team, config, isReset, targetStep, promptSource);
    }
    console.log(`\n✅ Launched ${teams.length} team(s). Monitor with: npx tsx scripts/monitor.ts --watch`);
  } else {
    const targets = teamName ? [teamName] : teamList;
    const matched = teams.filter(team => targets.includes(team.domain));
    if (matched.length === 0) {
      console.error(`Team(s) not found: ${targets.join(', ')}`);
      console.log('Available:', teams.map(t => t.domain).join(', ') || '(none)');
      console.error('\nRecovery:');
      console.error('  1. List all registered teams:');
      console.error('     npx tsx scripts/monitor.ts');
      console.error('  2. Check team registry:');
      console.error('     cat .squad/teams.json');
      console.error('  3. If team exists but not listed, check git worktrees:');
      console.error('     git worktree list');
      console.error('  4. If team doesn\'t exist, onboard it first:');
      console.error(`     npx tsx scripts/onboard.ts --name ${targets[0]} --domain-id <id> --archetype <name>`);
      console.error('  5. Verify correct team name (case-sensitive):');
      console.error(`     Available teams: ${teams.map(t => t.domain).join(', ')}`);
      process.exit(1);
    }
    for (const team of matched) {
      await launchTeam(team, config, isReset, targetStep, promptSource);
    }
  }
}

main().catch((error) => {
  console.error(`Launch failed: ${(error as Error).message}`);
  process.exit(1);
});
