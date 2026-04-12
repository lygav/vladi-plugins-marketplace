#!/usr/bin/env tsx
/**
 * Launch — Headless Domain Squad Tasks
 *
 * Launches Copilot sessions in domain worktrees with headless mode.
 * Each session is detached and runs independently.
 * Configurable MCP stack and prompt templates via federate config.
 *
 * Usage:
 *   npx tsx scripts/launch.ts --domain my-product
 *   npx tsx scripts/launch.ts --domain my-product --reset
 *   npx tsx scripts/launch.ts --domain my-product --step distillation
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

// ==================== Config Loading ====================

interface FederateConfig {
  deliverable: string;
  deliverableSchema?: string;
  mcpStack: string[];
  playbookSkill: string;
  steps: string[];
  branchPrefix: string;
  telemetry: { enabled: boolean };
}

const DEFAULT_CONFIG: FederateConfig = {
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
  return DEFAULT_CONFIG;
}

// ==================== Helpers ====================

function readDomainId(worktreePath: string): string {
  const teamMdPath = path.join(worktreePath, '.squad', 'team.md');
  if (!fs.existsSync(teamMdPath)) {
    throw new Error(`team.md not found in ${worktreePath}`);
  }
  const content = fs.readFileSync(teamMdPath, 'utf-8');
  // Look for domain ID in team.md (format: "Domain ID: <uuid-or-string>")
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

type RunType = 'first-run' | 'refresh' | 'reset';

function detectRunType(worktreePath: string, isReset: boolean, deliverable: string): RunType {
  if (!fs.existsSync(path.join(worktreePath, deliverable))) return 'first-run';
  return isReset ? 'reset' : 'refresh';
}

function clearScanArtifacts(worktreePath: string, domain: string, config: FederateConfig): void {
  console.log('🔄 Reset mode: clearing artifacts...');

  // Clear deliverable and summary
  for (const f of [config.deliverable, 'SCAN_SUMMARY.md']) {
    const fp = path.join(worktreePath, f);
    if (fs.existsSync(fp)) { fs.unlinkSync(fp); console.log(`  ✓ Deleted ${f}`); }
  }

  // Clear raw/ directory contents
  const rawDir = path.join(worktreePath, 'raw');
  if (fs.existsSync(rawDir)) {
    for (const f of fs.readdirSync(rawDir)) {
      const fp = path.join(rawDir, f);
      fs.statSync(fp).isDirectory() ? fs.rmSync(fp, { recursive: true }) : fs.unlinkSync(fp);
    }
    console.log('  ✓ Cleared raw/ directory');
  }

  // Commit cleanup
  try {
    execSync('git add -A && git commit -m "reset: clear artifacts for fresh run" --allow-empty', {
      cwd: worktreePath, stdio: 'pipe',
    });
  } catch { /* ignore */ }

  console.log('✓ Scan artifacts cleared.\n');
}

// ==================== Prompt Building ====================

function buildPrompt(domain: string, domainId: string, runType: RunType, config: FederateConfig): string {
  const signalBlock = `
SIGNAL PROTOCOL:
- Write progress to .squad/signals/status.json after each major step
- Check .squad/signals/inbox/ for directives from meta-squad before each step
- Write findings/blockers to .squad/signals/outbox/ when needed
- See .squad/skills/inter-squad-signals/SKILL.md for full protocol details

IMPORTANT: You are running in HEADLESS mode. Do NOT ask the user questions.
Make reasonable assumptions and proceed autonomously.`;

  if (runType === 'first-run') {
    return `Team, this is your FIRST RUN. Welcome to ${domain}.

Your domain: ${domain}
Domain ID: ${domainId}

FIRST RUN INSTRUCTIONS:
1. Run pre-task-triage ceremony (check inbox for meta-squad directives)
2. Execute the FULL ${config.playbookSkill} — all steps
3. Go DEEP. You are permanent domain experts. Prioritize completeness over speed.
4. Write learnings to the learning log as you discover them
5. Produce ${config.deliverable} and SCAN_SUMMARY.md
6. Run task-retro ceremony after completing

This is your domain now. Everything you learn stays with you forever.
${signalBlock}`;
  }

  if (runType === 'refresh') {
    return `Team, this is a RESCAN of your domain. You have prior knowledge.

Your domain: ${domain}
Domain ID: ${domainId}

RESCAN INSTRUCTIONS:
1. Run the knowledge-check ceremony first (read your learning log, review last ${config.deliverable})
2. Focus on WHAT CHANGED since your last run
3. Update ${config.deliverable} and SCAN_SUMMARY.md with current state
4. Append new learnings to the learning log
5. Run task-retro ceremony after completing

Your prior ${config.deliverable} is your baseline. Update it, don't rebuild from scratch.
${signalBlock}`;
  }

  // reset
  return `Team, this is a FRESH RUN. Prior artifacts have been cleared.

Your domain: ${domain}
Domain ID: ${domainId}

FRESH RUN INSTRUCTIONS:
1. Run pre-task-triage ceremony (check inbox for meta-squad directives)
2. Execute the FULL ${config.playbookSkill} — all steps
3. Your agent histories and learning log are intact — use your domain knowledge
4. Produce new ${config.deliverable} and SCAN_SUMMARY.md from scratch
5. Run task-retro ceremony after completing
${signalBlock}`;
}

function buildStepPrompt(domain: string, domainId: string, step: string, config: FederateConfig): string {
  return `Team, run ONLY the ${step} step for your domain.
Check .squad/signals/inbox/ for directives from meta-squad first.

Your domain: ${domain}
Domain ID: ${domainId}

Run the "${step}" step from the ${config.playbookSkill} skill.
Follow the skill instructions exactly. Write results to raw/ directory.

After completion:
- Update .squad/signals/status.json (state: complete, step: "${step}")
- Append learnings to the learning log

IMPORTANT: You are running in HEADLESS mode. Do NOT ask the user questions.`;
}

// ==================== Launch ====================

function launchDomain(worktree: DomainWorktree, isReset = false, targetStep: string | null = null): void {
  const config = loadConfig();

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
  checkSchemaFreshness(worktree.path, REPO_ROOT, config);

  const runType = detectScanType(worktree.path, isReset, config.deliverable);

  // Status header
  const emoji = runType === 'first-run' ? '🆕' : runType === 'reset' ? '🔄' : '🚀';
  const mode = targetStep ? `STEP: ${targetStep}` : runType;
  console.log(`\n${emoji} Launching ${mode} for ${worktree.domain}`);
  console.log(`   Worktree: ${worktree.path}`);

  if (isReset && runType === 'reset') {
    clearScanArtifacts(worktree.path, worktree.domain, config);
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
  let domainName: string | null = null;
  let allMode = false;
  let isReset = false;
  let targetStep: string | null = null;
  let domainList: string[] = [];

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--domain': case '--offering': domainName = args[++i]; break;
      case '--domains': case '--offerings': domainList = args[++i].split(','); break;
      case '--all': allMode = true; break;
      case '--reset': isReset = true; break;
      case '--step': targetStep = args[++i]; break;
    }
  }

  if (!domainName && !allMode && domainList.length === 0) {
    console.error('Usage:');
    console.error('  npx tsx scripts/launch.ts --domain <name>');
    console.error('  npx tsx scripts/launch.ts --domain <name> --reset');
    console.error('  npx tsx scripts/launch.ts --domain <name> --step <step>');
    console.error('  npx tsx scripts/launch.ts --all');
    process.exit(1);
  }

  const worktrees = discoverDomains(REPO_ROOT);

  if (allMode) {
    if (worktrees.length === 0) { console.log('No domain worktrees found.'); return; }
    console.log(`Found ${worktrees.length} domain(s):`);
    worktrees.forEach((wt, i) => console.log(`  ${i + 1}. ${wt.domain} (${wt.branch})`));
    worktrees.forEach(wt => launchDomain(wt, isReset, targetStep));
    console.log(`\n✅ Launched ${worktrees.length} domain(s). Monitor with: npx tsx scripts/monitor.ts --watch`);
  } else {
    const targets = domainName ? [domainName] : domainList;
    const matched = worktrees.filter(wt => targets.includes(wt.domain));
    if (matched.length === 0) {
      console.error(`Domain(s) not found: ${targets.join(', ')}`);
      console.log('Available:', worktrees.map(w => w.domain).join(', ') || '(none)');
      process.exit(1);
    }
    matched.forEach(wt => launchDomain(wt, isReset, targetStep));
  }
}

main();
