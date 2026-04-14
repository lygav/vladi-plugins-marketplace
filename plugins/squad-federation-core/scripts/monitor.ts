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

import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createTeamContext } from './lib/team-context.js';
import { TeamRegistry } from './lib/team-registry.js';
import { loadAndValidateConfig, type FederateConfig } from './lib/config.js';
import type { ScanStatus, SignalMessage, TeamPlacement } from '../sdk/types.js';

// ==================== Configuration ====================

const __filename = fileURLToPath(import.meta.url);
// REPO_ROOT must be the user's project, not the plugin install directory.
const REPO_ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
const DEFAULT_INTERVAL = 30; // seconds

// ==================== Types ====================

interface DomainStatus {
  domain: string;
  domainId: string;
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

async function readRecentLearnings(
  placement: TeamPlacement,
  teamId: string,
  limit: number = 3
): Promise<string[]> {
  try {
    const content = await placement.readFile(teamId, '.squad/learnings/log.jsonl');
    if (!content) {
      return [];
    }

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

    return entries.map((e: any) => {
      const content = e.title || e.body || e.content || 'No content';
      const truncated = String(content).substring(0, 60);
      const suffix = String(content).length > 60 ? '...' : '';
      return `[${e.agent || 'unknown'}] ${truncated}${suffix}`;
    });
  } catch {
    return [];
  }
}

function getDeliverableFilename(config: FederateConfig): string {
  return config.deliverable || process.env.FEDERATE_DELIVERABLE || 'deliverable.json';
}

async function gatherStatus(config: FederateConfig): Promise<DomainStatus[]> {
  const registry = new TeamRegistry(REPO_ROOT);
  let teams = await registry.list();
  if (teams.length === 0) {
    const migrated = await registry.migrateFromWorktreeDiscovery(REPO_ROOT);
    if (migrated > 0) {
      teams = await registry.list();
    }
  }
  const deliverableFile = getDeliverableFilename(config);

  const statuses: DomainStatus[] = [];
  for (const team of teams) {
    const context = createTeamContext(team, config, REPO_ROOT);
    const location = await context.placement.getLocation(team.domainId);
    const status = await context.communication.readStatus(team.domainId);
    const deliverableExists = await context.placement.exists(team.domainId, deliverableFile);
    const logExists = await context.placement.exists(team.domainId, 'run-output.log');
    const recentLearnings = await readRecentLearnings(context.placement, team.domainId, 3);

    let lastUpdateMinutes: number | undefined;
    if (status && status.updated_at) {
      lastUpdateMinutes = getMinutesSince(status.updated_at);
    }

    statuses.push({
      domain: team.domain,
      domainId: team.domainId,
      worktreePath: location,
      status,
      deliverableExists,
      logExists,
      recentLearnings,
      lastUpdateMinutes,
    });
  }

  return statuses;
}

function displayDashboard(statuses: DomainStatus[], deliverableFile: string): void {
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

async function watchMode(intervalSeconds: number, config: FederateConfig): Promise<void> {
  console.log(`👀 Watch mode: updating every ${intervalSeconds}s (Ctrl+C to exit)\n`);

  const deliverableFile = getDeliverableFilename(config);
  const statuses = await gatherStatus(config);
  displayDashboard(statuses, deliverableFile);

  setInterval(() => {
    gatherStatus(config)
      .then((next) => displayDashboard(next, deliverableFile))
      .catch((error) => console.error(`Monitor update failed: ${(error as Error).message}`));
  }, intervalSeconds * 1000);
}

async function sendDirective(domain: string, directiveText: string, config: FederateConfig): Promise<void> {
  console.log(`📤 Sending directive to ${domain}...\n`);

  const registry = new TeamRegistry(REPO_ROOT);
  let teams = await registry.list();
  if (teams.length === 0) {
    const migrated = await registry.migrateFromWorktreeDiscovery(REPO_ROOT);
    if (migrated > 0) {
      teams = await registry.list();
    }
  }
  const target = teams.find(team => team.domain === domain);

  if (!target) {
    console.error(`❌ Domain not found: ${domain}`);
    console.log('\nAvailable domains:');
    teams.forEach(team => console.log(`  - ${team.domain}`));
    console.error('\nRecovery:');
    console.error('  1. List all teams to see available domains:');
    console.error('     npx tsx scripts/monitor.ts');
    console.error('  2. Check team registry:');
    console.error('     cat .squad/teams.json');
    console.error('  3. Verify domain name spelling (case-sensitive)');
    console.error('  4. If domain should exist, check git worktrees:');
    console.error('     git worktree list');
    console.error('  5. If domain is missing, onboard it first:');
    console.error(`     npx tsx scripts/onboard.ts --name ${domain} --domain-id <id> --archetype <name>`);
    process.exit(1);
  }

  const context = createTeamContext(target, config, REPO_ROOT);
  const signalId = `signal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const signal: SignalMessage = {
    id: signalId,
    timestamp: new Date().toISOString(),
    from: 'meta-squad',
    to: target.domain,
    type: 'directive',
    subject: 'Directive from meta-squad',
    body: directiveText,
    protocol: 'v1',
  };
  await context.communication.writeInboxSignal(target.domainId, signal);

  console.log(`✅ Directive sent (ID: ${signalId})`);
  const location = await context.placement.getLocation(target.domainId);
  console.log(`   Location: ${location}/.squad/signals/inbox/`);
  console.log(`   Message: "${directiveText}"\n`);
}

// ==================== CLI Entry Point ====================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const watchIndex = args.indexOf('--watch');
  const intervalIndex = args.indexOf('--interval');
  const sendIndex = args.indexOf('--send');
  const directiveIndex = args.indexOf('--directive');

  const config = loadAndValidateConfig(path.join(REPO_ROOT, 'federate.config.json'));

  if (sendIndex >= 0 && args[sendIndex + 1] && directiveIndex >= 0 && args[directiveIndex + 1]) {
    const domain = args[sendIndex + 1];
    const directive = args[directiveIndex + 1];
    await sendDirective(domain, directive, config);
  } else if (watchIndex >= 0) {
    let interval = DEFAULT_INTERVAL;
    if (intervalIndex >= 0 && args[intervalIndex + 1]) {
      interval = parseInt(args[intervalIndex + 1], 10) || DEFAULT_INTERVAL;
    }
    await watchMode(interval, config);
  } else {
    const deliverableFile = getDeliverableFilename(config);
    const statuses = await gatherStatus(config);
    displayDashboard(statuses, deliverableFile);
  }
}

main().catch((error) => {
  console.error(`Monitor failed: ${(error as Error).message}`);
  process.exit(1);
});
