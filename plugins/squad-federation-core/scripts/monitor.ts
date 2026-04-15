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
 *   npx tsx scripts/monitor.ts --non-interactive --output-format json
 *   npx tsx scripts/monitor.ts --send my-product --directive "msg" --non-interactive --output-format json
 */

import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import {
  createTeamContext,
  TeamRegistry,
  loadAndValidateConfig
} from './lib/index.js';
import type {
  ScanStatus,
  SignalMessage,
  TeamCommunication
} from '../sdk/types.js';


// ==================== Configuration ====================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// REPO_ROOT must be the user's project, not the plugin install directory.
const REPO_ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
const DEFAULT_INTERVAL = 30; // seconds
const FEDERATION_CONFIG = loadAndValidateConfig(path.join(REPO_ROOT, 'federate.config.json'));

// ==================== Types ====================

type OutputFormat = 'text' | 'json';

interface DomainStatus {
  domain: string;
  domainId: string;
  location: string;
  status: ScanStatus | null;
  deliverableExists: boolean;
  logExists: boolean;
  recentLearnings: string[];
  lastUpdateMinutes?: number;
}

export interface MonitorResult {
  success: boolean;
  teams: Array<{
    domain: string;
    domainId: string;
    location: string;
    state: string | null;
    step: string | null;
    progressPct: number | null;
    error: string | null;
    agentActive: string | null;
    lastUpdateMinutes: number | null;
    deliverableExists: boolean;
    logExists: boolean;
    recentLearnings: string[];
  }>;
  timestamp: string;
}

export interface DirectiveResult {
  success: boolean;
  signalId: string;
  team: string;
  directive: string;
  timestamp: string;
  error?: string;
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
  communication: TeamCommunication,
  teamId: string,
  limit: number = 3
): Promise<string[]> {
  try {
    const entries = await communication.readLearningLog(teamId);
    if (entries.length === 0) {
      return [];
    }

    const recent = entries.slice(-limit);
    return recent.map(entry => {
      const snippet = entry.content?.substring(0, 60) || 'No content';
      const suffix = entry.content && entry.content.length > 60 ? '...' : '';
      return `[${entry.type}] ${snippet}${suffix}`;
    });
  } catch {
    return [];
  }
}

function getDeliverableFilename(): string {
  return FEDERATION_CONFIG.deliverable || process.env.FEDERATE_DELIVERABLE || 'deliverable.json';
}

async function gatherStatus(): Promise<DomainStatus[]> {
  const registry = new TeamRegistry(REPO_ROOT);
  const teams = (await registry.list()).filter(team => team.federation?.role !== 'meta');
  const deliverableFile = getDeliverableFilename();

  if (teams.length === 0) {
    return [];
  }

  const statuses = await Promise.all(teams.map(async team => {
    try {
      const context = createTeamContext(team, FEDERATION_CONFIG, REPO_ROOT);
      const status = await context.communication.readStatus(team.domainId);

      let lastUpdateMinutes: number | undefined;
      if (status?.updated_at) {
        lastUpdateMinutes = getMinutesSince(status.updated_at);
      }

      const deliverableExists = await context.placement.exists(team.domainId, deliverableFile);
      const logExists = await context.placement.exists(team.domainId, 'run-output.log');
      const recentLearnings = await readRecentLearnings(context.communication, team.domainId, 3);

      return {
        domain: team.domain,
        domainId: team.domainId,
        location: team.location,
        status,
        deliverableExists,
        logExists,
        recentLearnings,
        ...(lastUpdateMinutes !== undefined && { lastUpdateMinutes }),
      } satisfies DomainStatus;
    } catch (error) {
      console.error(`Error collecting status for ${team.domain}:`, error);
      return null;
    }
  }));

  return statuses.filter((status): status is DomainStatus => status !== null);
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

async function watchMode(intervalSeconds: number): Promise<void> {
  console.log(`👀 Watch mode: updating every ${intervalSeconds}s (Ctrl+C to exit)\n`);

  const statuses = await gatherStatus();
  displayDashboard(statuses);

  setInterval(() => {
    void gatherStatus()
      .then(displayDashboard)
      .catch(error => console.error('Error updating dashboard:', error));
  }, intervalSeconds * 1000);
}

async function sendDirective(domain: string, directiveText: string, outputFormat: OutputFormat = 'text'): Promise<DirectiveResult> {
  if (outputFormat === 'text') {
    console.log(`📤 Sending directive to ${domain}...\n`);
  }
  const registry = new TeamRegistry(REPO_ROOT);
  const teams = await registry.list();
  const target = teams.find(team => team.domain === domain);

  if (!target) {
    const result: DirectiveResult = {
      success: false, signalId: '', team: domain, directive: directiveText,
      timestamp: new Date().toISOString(), error: `Domain not found: ${domain}`,
    };
    if (outputFormat === 'json') { console.log(JSON.stringify(result, null, 2)); }
    else { console.error(`❌ Domain not found: ${domain}`); }
    process.exit(1);
  }

  const context = createTeamContext(target, FEDERATION_CONFIG, REPO_ROOT);
  const signal: SignalMessage = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    from: 'meta-squad',
    to: target.domain,
    type: 'directive',
    subject: 'Directive from meta-squad',
    body: directiveText,
    protocol: 'v1',
  };
  await context.communication.writeInboxSignal(target.domainId, signal);

  const result: DirectiveResult = {
    success: true, signalId: signal.id, team: domain,
    directive: directiveText, timestamp: signal.timestamp,
  };
  if (outputFormat === 'json') { console.log(JSON.stringify(result, null, 2)); }
  else {
    console.log(`✅ Directive sent (ID: ${signal.id})`);
    console.log(`   Location: ${target.location}/.squad/signals/inbox/`);
    console.log(`   Message: "${directiveText}"\n`);
  }
  return result;
}

function statusesToJson(statuses: DomainStatus[]): MonitorResult {
  return {
    success: true,
    teams: statuses.map(ds => ({
      domain: ds.domain, domainId: ds.domainId, location: ds.location,
      state: ds.status?.state ?? null, step: ds.status?.step ?? null,
      progressPct: ds.status?.progress_pct ?? null, error: ds.status?.error ?? null,
      agentActive: ds.status?.agent_active ?? null,
      lastUpdateMinutes: ds.lastUpdateMinutes ?? null,
      deliverableExists: ds.deliverableExists, logExists: ds.logExists,
      recentLearnings: ds.recentLearnings,
    })),
    timestamp: new Date().toISOString(),
  };
}

// ==================== CLI Entry Point ====================

async function main() {
  const args = process.argv.slice(2);

  const watchIndex = args.indexOf('--watch');
  const intervalIndex = args.indexOf('--interval');
  const sendIndex = args.indexOf('--send');
  const directiveIndex = args.indexOf('--directive');
  const outputFormatIndex = args.indexOf('--output-format');
  const outputFormat: OutputFormat =
    (outputFormatIndex >= 0 && args[outputFormatIndex + 1] === 'json') ? 'json' : 'text';

  if (sendIndex >= 0 && args[sendIndex + 1] && directiveIndex >= 0 && args[directiveIndex + 1]) {
    const domain = args[sendIndex + 1];
    const directive = args[directiveIndex + 1];
    await sendDirective(domain, directive, outputFormat);
  } else if (watchIndex >= 0) {
    if (outputFormat === 'json') {
      console.error('--watch is not compatible with --output-format json');
      process.exit(1);
    }
    let interval = DEFAULT_INTERVAL;
    if (intervalIndex >= 0 && args[intervalIndex + 1]) {
      interval = parseInt(args[intervalIndex + 1], 10) || DEFAULT_INTERVAL;
    }
    await watchMode(interval);
  } else {
    const statuses = await gatherStatus();
    if (outputFormat === 'json') {
      console.log(JSON.stringify(statusesToJson(statuses), null, 2));
    } else {
      displayDashboard(statuses);
    }
  }
}

main().catch(error => {
  console.error('Monitor failed:', error);
  process.exit(1);
});
