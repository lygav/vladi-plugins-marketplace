#!/usr/bin/env tsx
/**
 * Launch — Headless Squad Team Tasks
 *
 * Launches Copilot sessions in team worktrees with headless mode.
 * Each session is detached and runs independently.
 * Supports multiple squad archetypes: deliverable, coding, research, task.
 *
 * Usage:
 *   npx tsx scripts/launch.ts --team my-a-team
 *   npx tsx scripts/launch.ts --team my-a-team --reset
 *   npx tsx scripts/launch.ts --team my-a-team --step distillation
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

// ==================== Configuration ====================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// ==================== Types ====================

type Archetype = 'deliverable' | 'coding' | 'research' | 'task';

interface FederateConfig {
  archetype: Archetype;
  deliverable: string;
  deliverableSchema?: string;
  mcpStack: string[];
  playbookSkill: string;
  steps: string[];
  branchPrefix: string;
  telemetry: { enabled: boolean };
}

type RunType = 'first-run' | 'refresh' | 'reset';

// ==================== Config Loading ====================

const DEFAULT_CONFIG: FederateConfig = {
  archetype: 'deliverable',
  deliverable: 'deliverable.json',
  mcpStack: [],
  playbookSkill: 'domain-playbook',
  steps: ['discovery', 'analysis', 'deep-dives', 'validation', 'documentation', 'distillation'],
  branchPrefix: 'squad/',
  telemetry: { enabled: true },
};

function loadConfig(): FederateConfig {
  const configPath = path.join(REPO_ROOT, 'federate.config.json');
  if (fs.existsSync(configPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...raw };
    } catch { /* fall through */ }
  }
  return { ...DEFAULT_CONFIG };
}

// ==================== Helpers ====================

function readDomainId(worktreePath: string): string {
  const teamMdPath = path.join(worktreePath, '.squad', 'team.md');
  if (!fs.existsSync(teamMdPath)) {
    throw new Error(`team.md not found in ${worktreePath}`);
  }
  const content = fs.readFileSync(teamMdPath, 'utf-8');
  const match = content.match(/Domain\s*ID[:\s]+([^\n]+)/i);
  return match ? match[1].trim() : 'unknown';
}

function checkSchemaFreshness(worktreePath: string, repoRoot: string, config: FederateConfig): boolean {
  if (!config.deliverableSchema) return false;

  const domainSchema = path.join(worktreePath, config.deliverableSchema);
  const mainSchema = path.join(repoRoot, config.deliverableSchema);

  if (!fs.existsSync(mainSchema)) return false;
  if (!fs.existsSync(domainSchema)) {
    fs.mkdirSync(path.dirname(domainSchema), { recursive: true });
    fs.copyFileSync(mainSchema, domainSchema);
    try {
      execSync(`git add "${config.deliverableSchema}" && git commit -m "sync: update schema from main"`, {
        cwd: worktreePath, stdio: 'pipe',
      });
    } catch { /* ignore */ }
    return true;
  }

  if (fs.readFileSync(domainSchema, 'utf-8') !== fs.readFileSync(mainSchema, 'utf-8')) {
    fs.copyFileSync(mainSchema, domainSchema);
    try {
      execSync(`git add "${config.deliverableSchema}" && git commit -m "sync: update schema from main"`, {
        cwd: worktreePath, stdio: 'pipe',
      });
    } catch { /* ignore */ }
    return true;
  }

  return false;
}

function detectRunType(worktreePath: string, isReset: boolean, config: FederateConfig): RunType {
  if (config.archetype === 'deliverable') {
    if (!fs.existsSync(path.join(worktreePath, config.deliverable))) return 'first-run';
  } else {
    // Non-deliverable archetypes: check status.json for prior runs
    const statusPath = path.join(worktreePath, '.squad', 'signals', 'status.json');
    if (!fs.existsSync(statusPath)) return 'first-run';
  }
  return isReset ? 'reset' : 'refresh';
}

function clearArtifacts(worktreePath: string, config: FederateConfig): void {
  console.log('🔄 Reset mode: clearing artifacts...');

  // Always clear status.json
  const statusPath = path.join(worktreePath, '.squad', 'signals', 'status.json');
  if (fs.existsSync(statusPath)) { fs.unlinkSync(statusPath); console.log('  ✓ Deleted status.json'); }

  // Always clear raw/ directory contents
  const rawDir = path.join(worktreePath, 'raw');
  if (fs.existsSync(rawDir)) {
    for (const f of fs.readdirSync(rawDir)) {
      const fp = path.join(rawDir, f);
      fs.statSync(fp).isDirectory() ? fs.rmSync(fp, { recursive: true }) : fs.unlinkSync(fp);
    }
    console.log('  ✓ Cleared raw/ directory');
  }

  // Deliverable archetype also clears the deliverable file and summary
  if (config.archetype === 'deliverable') {
    for (const f of [config.deliverable, 'SCAN_SUMMARY.md']) {
      const fp = path.join(worktreePath, f);
      if (fs.existsSync(fp)) { fs.unlinkSync(fp); console.log(`  ✓ Deleted ${f}`); }
    }
  }

  // Commit cleanup
  try {
    execSync('git add -A && git commit -m "reset: clear artifacts for fresh run" --allow-empty', {
      cwd: worktreePath, stdio: 'pipe',
    });
  } catch { /* ignore */ }

  console.log('✓ Artifacts cleared.\n');
}

// ==================== Prompt Building ====================

const SIGNAL_BLOCK = `
SIGNAL PROTOCOL:
- Write progress to .squad/signals/status.json after each major step
- Check .squad/signals/inbox/ for directives from meta-squad before each step
- Write findings/blockers to .squad/signals/outbox/ when needed
- See .squad/skills/inter-squad-signals/SKILL.md for full protocol details

IMPORTANT: You are running in HEADLESS mode. Do NOT ask the user questions.
Make reasonable assumptions and proceed autonomously.`;

// --- Deliverable archetype prompts ---

function deliverablePrompt(team: string, domainId: string, runType: RunType, config: FederateConfig): string {
  if (runType === 'first-run') {
    return `Team, this is your FIRST RUN. Welcome to ${team}.

Your team: ${team}
Domain ID: ${domainId}

FIRST RUN INSTRUCTIONS:
1. Run pre-task-triage ceremony (check inbox for meta-squad directives)
2. Execute the FULL ${config.playbookSkill} — all steps
3. Go DEEP. You are permanent domain experts. Prioritize completeness over speed.
4. Write learnings to the learning log as you discover them
5. Produce ${config.deliverable} and SCAN_SUMMARY.md
6. Run task-retro ceremony after completing

This is your team now. Everything you learn stays with you forever.
${SIGNAL_BLOCK}`;
  }

  if (runType === 'refresh') {
    return `Team, this is a RESCAN of your domain. You have prior knowledge.

Your team: ${team}
Domain ID: ${domainId}

RESCAN INSTRUCTIONS:
1. Run the knowledge-check ceremony first (read your learning log, review last ${config.deliverable})
2. Focus on WHAT CHANGED since your last run
3. Update ${config.deliverable} and SCAN_SUMMARY.md with current state
4. Append new learnings to the learning log
5. Run task-retro ceremony after completing

Your prior ${config.deliverable} is your baseline. Update it, don't rebuild from scratch.
${SIGNAL_BLOCK}`;
  }

  // reset
  return `Team, this is a FRESH RUN. Prior artifacts have been cleared.

Your team: ${team}
Domain ID: ${domainId}

FRESH RUN INSTRUCTIONS:
1. Run pre-task-triage ceremony (check inbox for meta-squad directives)
2. Execute the FULL ${config.playbookSkill} — all steps
3. Your agent histories and learning log are intact — use your domain knowledge
4. Produce new ${config.deliverable} and SCAN_SUMMARY.md from scratch
5. Run task-retro ceremony after completing
${SIGNAL_BLOCK}`;
}

// --- Coding archetype prompts ---

function codingPrompt(team: string, _domainId: string, runType: RunType): string {
  if (runType === 'first-run') {
    return `You're a coding team for ${team}. Read DOMAIN_CONTEXT.md and .squad/signals/inbox/ for your task. Design, implement, write tests, open PR.
${SIGNAL_BLOCK}`;
  }
  if (runType === 'refresh') {
    return `Check for new tasks in inbox. Continue implementation. Open PRs for completed work.

Your team: ${team}
${SIGNAL_BLOCK}`;
  }
  return `Start fresh. Read task from inbox, implement from scratch.

Your team: ${team}
${SIGNAL_BLOCK}`;
}

// --- Research archetype prompts ---

function researchPrompt(team: string, _domainId: string, runType: RunType): string {
  if (runType === 'first-run') {
    return `You're a research team for ${team}. Investigate the topic in DOMAIN_CONTEXT.md. Explore, analyze, draft your findings as a document.
${SIGNAL_BLOCK}`;
  }
  if (runType === 'refresh') {
    return `Review and refine your existing research. Check inbox for new questions or feedback.

Your team: ${team}
${SIGNAL_BLOCK}`;
  }
  return `Fresh research. Re-investigate from scratch.

Your team: ${team}
${SIGNAL_BLOCK}`;
}

// --- Task archetype prompts ---

function taskPrompt(team: string, _domainId: string, runType: RunType): string {
  if (runType === 'first-run') {
    return `You're a task team for ${team}. Read your task from DOMAIN_CONTEXT.md and inbox. Plan, execute, verify completion.
${SIGNAL_BLOCK}`;
  }
  if (runType === 'refresh') {
    return `Check for new tasks or follow-ups in inbox. Continue work.

Your team: ${team}
${SIGNAL_BLOCK}`;
  }
  return `Start the task over from scratch.

Your team: ${team}
${SIGNAL_BLOCK}`;
}

// --- Prompt dispatch ---

function buildPrompt(team: string, domainId: string, runType: RunType, config: FederateConfig): string {
  switch (config.archetype) {
    case 'coding':   return codingPrompt(team, domainId, runType);
    case 'research': return researchPrompt(team, domainId, runType);
    case 'task':     return taskPrompt(team, domainId, runType);
    default:         return deliverablePrompt(team, domainId, runType, config);
  }
}

// --- Step prompts ---

function buildStepPrompt(team: string, domainId: string, step: string, config: FederateConfig): string {
  if (config.archetype === 'deliverable') {
    return `Team, run ONLY the ${step} step for your team.
Check .squad/signals/inbox/ for directives from meta-squad first.

Your team: ${team}
Domain ID: ${domainId}

Run the "${step}" step from the ${config.playbookSkill} skill.
Follow the skill instructions exactly. Write results to raw/ directory.

After completion:
- Update .squad/signals/status.json (state: complete, step: "${step}")
- Append learnings to the learning log

IMPORTANT: You are running in HEADLESS mode. Do NOT ask the user questions.`;
  }

  // Non-deliverable archetypes: generic step from config.steps
  return `Team, run ONLY step '${step}' from your playbook.
Check .squad/signals/inbox/ for directives from meta-squad first.

Your team: ${team}
Domain ID: ${domainId}

Run step '${step}' from your playbook. Write results as appropriate.

After completion:
- Update .squad/signals/status.json (state: complete, step: "${step}")

IMPORTANT: You are running in HEADLESS mode. Do NOT ask the user questions.`;
}

// ==================== Launch ====================

function launchTeam(
  worktree: DomainWorktree,
  config: FederateConfig,
  isReset = false,
  targetStep: string | null = null,
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

  const domainId = readDomainId(worktree.path);

  // Schema freshness only matters for deliverable archetype
  if (config.archetype === 'deliverable') {
    checkSchemaFreshness(worktree.path, REPO_ROOT, config);
  }

  const runType = detectRunType(worktree.path, isReset, config);

  // Status header
  const emoji = runType === 'first-run' ? '🆕' : runType === 'reset' ? '🔄' : '🚀';
  const mode = targetStep ? `STEP: ${targetStep}` : runType;
  console.log(`\n${emoji} Launching ${mode} for team ${worktree.domain}`);
  console.log(`   Worktree: ${worktree.path}`);
  console.log(`   Archetype: ${config.archetype}`);

  if (isReset && runType === 'reset') {
    clearArtifacts(worktree.path, config);
  }

  initializeSignals(worktree.path, worktree.domain, domainId);
  console.log('   📡 Signals initialized');

  // Build prompt
  const prompt = targetStep
    ? buildStepPrompt(worktree.domain, domainId, targetStep, config)
    : buildPrompt(worktree.domain, domainId, runType, config);

  // Prepare log file
  const logFile = path.join(worktree.path, 'run-output.log');
  const logStream = fs.openSync(logFile, 'w');

  // Build MCP args from config
  const mcpArgs: string[] = [];
  for (const mcp of config.mcpStack) {
    mcpArgs.push('--mcp', mcp);
  }

  // OTel MCP config (if telemetry enabled)
  const otelArgs: string[] = [];
  if (config.telemetry.enabled) {
    const mcpConfig = {
      mcpServers: {
        otel: {
          command: 'npx',
          args: ['tsx', path.resolve(__dirname, 'mcp-otel-server.ts')],
          env: {
            OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
            OTEL_SERVICE_NAME: `squad-${worktree.domain}`,
            SQUAD_DOMAIN: worktree.domain,
          },
        },
      },
    };
    otelArgs.push('--additional-mcp-config', JSON.stringify(mcpConfig));
  }

  // Launch via copilot (or agency copilot)
  const launcher = process.env.SQUAD_LAUNCHER || 'copilot';
  const launcherArgs = launcher === 'agency'
    ? ['copilot', '--agent', 'squad', '-p', prompt, '--yolo', '--no-ask-user', '--autopilot', ...mcpArgs, ...otelArgs]
    : ['-p', prompt, '--yolo', '--no-ask-user', '--autopilot', ...mcpArgs, ...otelArgs];

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

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      // --team is primary; --domain kept as hidden backward-compat alias
      case '--team': case '--domain': case '--offering': teamName = args[++i]; break;
      case '--teams': case '--domains': case '--offerings': teamList = args[++i].split(','); break;
      case '--all': allMode = true; break;
      case '--reset': isReset = true; break;
      case '--step': targetStep = args[++i]; break;
    }
  }

  if (!teamName && !allMode && teamList.length === 0) {
    console.error('Usage:');
    console.error('  npx tsx scripts/launch.ts --team <name>');
    console.error('  npx tsx scripts/launch.ts --team <name> --reset');
    console.error('  npx tsx scripts/launch.ts --team <name> --step <step>');
    console.error('  npx tsx scripts/launch.ts --teams team-a,team-b');
    console.error('  npx tsx scripts/launch.ts --all');
    process.exit(1);
  }

  const config = loadConfig();
  const worktrees = discoverDomains(REPO_ROOT);

  if (allMode) {
    if (worktrees.length === 0) { console.log('No team worktrees found.'); return; }
    console.log(`Found ${worktrees.length} team(s):`);
    worktrees.forEach((wt, i) => console.log(`  ${i + 1}. ${wt.domain} (${wt.branch})`));
    worktrees.forEach(wt => launchTeam(wt, config, isReset, targetStep));
    console.log(`\n✅ Launched ${worktrees.length} team(s). Monitor with: npx tsx scripts/monitor.ts --watch`);
  } else {
    const targets = teamName ? [teamName] : teamList;
    const matched = worktrees.filter(wt => targets.includes(wt.domain));
    if (matched.length === 0) {
      console.error(`Team(s) not found: ${targets.join(', ')}`);
      console.log('Available:', worktrees.map(w => w.domain).join(', ') || '(none)');
      process.exit(1);
    }
    matched.forEach(wt => launchTeam(wt, config, isReset, targetStep));
  }
}

main();
