#!/usr/bin/env node
/**
 * Monitor Script — Domain Squad Scan Dashboard
 *
 * Displays status of all running domain scans.
 * Watch mode polls and updates the dashboard every N seconds.
 * Can also send directives to domain squads.
 *
 * Usage:
 *   npx tsx scripts/monitor.ts
 *   npx tsx scripts/monitor.ts --watch --interval 30
 *   npx tsx scripts/monitor.ts --send my-product --directive "Skip repo legacy-utils"
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  discoverDomains,
  readStatus,
  readMessages,
  sendMessage,
  ScanStatus,
  SignalMessage,
  DomainWorktree,
} from './lib/signals.js';
import { loadAndValidateConfig } from './lib/config.js';

// ==================== Configuration ====================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// REPO_ROOT must be the user's project, not the plugin install directory.
const REPO_ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
const DEFAULT_INTERVAL = 30; // seconds

// ==================== Types ====================

interface DomainStatus {
  domain: string;
  worktreePath: string;
  status: ScanStatus | null;
  deliverableExists: boolean;
  logExists: boolean;
  recentLearnings: string[];
  lastUpdateMinutes?: number;
}

// ==================== Helpers ====================

function getStateEmoji(state: string | undefined): string {
  switch (state) {
    case 'complete': return '🟢';
    case 'scanning': return '🟡';
    case 'distilling': return '🔵';
    case 'failed': return '🔴';
    case 'paused': return '⏸️ ';
    case 'initializing': return '🟠';
    default: return '⚪';
  }
}

function getMinutesSince(isoTimestamp: string): number {
  const then = new Date(isoTimestamp);
  const now = new Date();
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60));
}

function readRecentLearnings(worktreePath: string, limit: number = 3): string[] {
  const logPath = path.join(worktreePath, '.squad', 'learnings', 'log.jsonl');

  if (!fs.existsSync(logPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l.trim());
    const entries = lines
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(e => e !== null)
      .slice(-limit);

    return entries.map((e: any) =>
      `[${e.agent || 'unknown'}] ${e.title?.substring(0, 60) || e.body?.substring(0, 60) || 'No content'}${(e.title || e.body || '').length > 60 ? '...' : ''}`
    );
  } catch {
    return [];
  }
}

function getDeliverableFilename(): string {
  // Use validated config
  const config = loadAndValidateConfig(path.join(REPO_ROOT, 'federate.config.json'));
  return config.deliverable || process.env.FEDERATE_DELIVERABLE || 'deliverable.json';
}

function gatherStatus(): DomainStatus[] {
  const worktrees = discoverDomains(REPO_ROOT);
  const deliverableFile = getDeliverableFilename();

  return worktrees.map(wt => {
    const status = readStatus(wt.path);
    const deliverablePath = path.join(wt.path, deliverableFile);
    const logPath = path.join(wt.path, 'run-output.log');

    let lastUpdateMinutes: number | undefined;
    if (status && status.updated_at) {
      lastUpdateMinutes = getMinutesSince(status.updated_at);
    }

    return {
      domain: wt.domain,
      worktreePath: wt.path,
      status,
      deliverableExists: fs.existsSync(deliverablePath),
      logExists: fs.existsSync(logPath),
      recentLearnings: readRecentLearnings(wt.path, 3),
      lastUpdateMinutes,
    };
  });
}

function displayDashboard(statuses: DomainStatus[]): void {
  console.clear();
  console.log('📊 Domain Scan Status');
  console.log('━'.repeat(70));
  console.log('');

  if (statuses.length === 0) {
    console.log('No domain worktrees found.');
    return;
  }

  const stateOrder: Record<string, number> = {
    'failed': 0,
    'initializing': 1,
    'scanning': 2,
    'distilling': 3,
    'paused': 4,
    'complete': 5,
  };

  const sorted = [...statuses].sort((a, b) => {
    const aState = a.status?.state || 'unknown';
    const bState = b.status?.state || 'unknown';
    const aOrder = stateOrder[aState] ?? 99;
    const bOrder = stateOrder[bState] ?? 99;

    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.domain.localeCompare(b.domain);
  });

  const deliverableFile = getDeliverableFilename();

  for (const ds of sorted) {
    const emoji = getStateEmoji(ds.status?.state);
    const state = ds.status?.state || 'not started';
    const step = ds.status?.step || 'N/A';
    const deliverable = ds.deliverableExists ? '✓' : '✗';
    const progress = ds.status?.progress_pct !== undefined ? `${ds.status.progress_pct}%` : '';

    console.log(`${emoji} ${ds.domain.padEnd(35)} ${state.padEnd(12)} ${step}`);

    if (ds.status?.agent_active) {
      console.log(`   Agent: ${ds.status.agent_active}`);
    }

    if (progress) {
      console.log(`   Progress: ${progress}`);
    }

    if (ds.status?.error) {
      console.log(`   ⚠️  Error: ${ds.status.error}`);
    }

    if (ds.lastUpdateMinutes !== undefined) {
      const timeStr = ds.lastUpdateMinutes === 0 ? 'just now' : `${ds.lastUpdateMinutes}m ago`;
      console.log(`   Last update: ${timeStr}`);

      if (ds.lastUpdateMinutes > 10 && ds.status?.state !== 'complete' && ds.status?.state !== 'failed') {
        console.log(`   ⚠️  Stuck? No update in ${ds.lastUpdateMinutes} minutes`);
      }
    }

    console.log(`   ${deliverableFile}: ${deliverable}   log: ${ds.logExists ? '✓' : '✗'}`);
    console.log('');
  }

  // Recent learnings
  console.log('━'.repeat(70));
  console.log('📝 Recent Learnings:\n');

  let learningsShown = 0;
  for (const ds of sorted) {
    if (ds.recentLearnings.length > 0 && learningsShown < 5) {
      for (const learning of ds.recentLearnings.slice(0, 2)) {
        console.log(`  [${ds.domain}] ${learning}`);
        learningsShown++;
        if (learningsShown >= 5) break;
      }
    }
  }

  if (learningsShown === 0) {
    console.log('  (No learnings yet)');
  }

  console.log('');
  console.log('━'.repeat(70));
  console.log(`Last updated: ${new Date().toLocaleTimeString()}`);
  console.log('');
}

function watchMode(intervalSeconds: number): void {
  console.log(`👀 Watch mode: updating every ${intervalSeconds}s (Ctrl+C to exit)\n`);

  const statuses = gatherStatus();
  displayDashboard(statuses);

  setInterval(() => {
    const statuses = gatherStatus();
    displayDashboard(statuses);
  }, intervalSeconds * 1000);
}

function sendDirective(domain: string, directiveText: string): void {
  console.log(`📤 Sending directive to ${domain}...\n`);

  const worktrees = discoverDomains(REPO_ROOT);
  const target = worktrees.find(wt => wt.domain === domain);

  if (!target) {
    console.error(`❌ Domain not found: ${domain}`);
    console.log('\nAvailable domains:');
    worktrees.forEach(wt => console.log(`  - ${wt.domain}`));
    process.exit(1);
  }

  const signalId = sendMessage(target.path, {
    from: 'meta-squad',
    type: 'directive',
    subject: 'Directive from meta-squad',
    body: directiveText,
  });

  console.log(`✅ Directive sent (ID: ${signalId})`);
  console.log(`   Location: ${target.path}/.squad/signals/inbox/`);
  console.log(`   Message: "${directiveText}"\n`);
}

// ==================== CLI Entry Point ====================

function main() {
  const args = process.argv.slice(2);

  const watchIndex = args.indexOf('--watch');
  const intervalIndex = args.indexOf('--interval');
  const sendIndex = args.indexOf('--send');
  const directiveIndex = args.indexOf('--directive');

  if (sendIndex >= 0 && args[sendIndex + 1] && directiveIndex >= 0 && args[directiveIndex + 1]) {
    const domain = args[sendIndex + 1];
    const directive = args[directiveIndex + 1];
    sendDirective(domain, directive);
  } else if (watchIndex >= 0) {
    let interval = DEFAULT_INTERVAL;
    if (intervalIndex >= 0 && args[intervalIndex + 1]) {
      interval = parseInt(args[intervalIndex + 1], 10) || DEFAULT_INTERVAL;
    }
    watchMode(interval);
  } else {
    const statuses = gatherStatus();
    displayDashboard(statuses);
  }
}

main();
