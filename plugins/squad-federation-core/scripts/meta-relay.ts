#!/usr/bin/env npx tsx
/**
 * Meta relay loop — reads team signals and relays curated summaries to user.
 * 
 * Usage: npx tsx scripts/meta-relay.ts [--interval 2000] [--once]
 * 
 * Reads from team signal outboxes, formats summaries, delivers to console.
 * Teams notification integration happens at the skill layer (federation-orchestration),
 * not in this script. teamsConfig in federate.config.json is used by the meta-squad
 * skill to post summaries and poll for #directive messages.
 * 
 * --once: run one cycle and exit (useful for testing)
 * --interval: poll interval in ms (default: 2000)
 */

import { OTelEmitter } from '../sdk/otel-emitter.js';
import { TeamRegistry } from './lib/registry/team-registry.js';
import { readFileSync, readdirSync, renameSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { resolve, join, dirname, basename } from 'path';

// ==================== Types ====================

interface SignalMessage {
  id: string;
  timestamp: string;
  from: string;
  to: string;
  type: 'directive' | 'question' | 'report' | 'alert';
  subject: string;
  body: string;
  protocol: string;
  acknowledged?: boolean;
  acknowledged_at?: string;
}

interface ScanStatus {
  domain: string;
  domain_id: string;
  state: 'initializing' | 'scanning' | 'distilling' | 'complete' | 'failed' | 'paused';
  step: string;
  started_at: string;
  updated_at: string;
  completed_at?: string;
  progress_pct?: number;
  error?: string;
  agent_active?: string;
  archetype_id: string;
}

interface FederationConfig {
  description: string;
  telemetry?: {
    enabled: boolean;
    endpoint?: string;
  };
  /** Teams channel for meta-squad notifications (used by skill layer, not this script) */
  teamsConfig?: {
    teamId: string;
    channelId: string;
  };
}

// ==================== Helpers ====================

function parseArgs(): { interval: number; once: boolean } {
  const args = process.argv.slice(2);
  let interval = 2000;
  let once = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--interval' && args[i + 1]) {
      interval = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--once') {
      once = true;
    }
  }

  return { interval, once };
}

function formatTimestamp(): string {
  const now = new Date();
  return `[${now.toLocaleTimeString('en-US', { hour12: false })}]`;
}

function getStateEmoji(state: string): string {
  switch (state) {
    case 'complete': return '✅';
    case 'failed': return '❌';
    case 'paused': return '⏸️';
    case 'scanning': return '🔍';
    case 'distilling': return '🧪';
    case 'initializing': return '🚀';
    default: return '🔧';
  }
}

function getSignalEmoji(type: string): string {
  switch (type) {
    case 'alert': return '⚠️';
    case 'report': return '📊';
    case 'question': return '❓';
    case 'directive': return '📌';
    default: return '💬';
  }
}

function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

// ==================== Signal Reading ====================

async function readTeamSignals(
  teamLocation: string,
  teamDomain: string,
  emitter: OTelEmitter
): Promise<{ signals: SignalMessage[]; status: ScanStatus | null }> {
  const outboxPath = join(teamLocation, '.squad', 'signals', 'outbox');
  const statusPath = join(teamLocation, '.squad', 'signals', 'status.json');

  let signals: SignalMessage[] = [];
  let status: ScanStatus | null = null;

  // Read status if available
  try {
    if (existsSync(statusPath)) {
      const statusContent = readFileSync(statusPath, 'utf-8');
      status = JSON.parse(statusContent);
    }
  } catch (err) {
    await emitter.log('warn', `Failed to read status for ${teamDomain}`, {
      'squad.domain': teamDomain,
      'error.message': err instanceof Error ? err.message : String(err)
    });
  }

  // Read signals from outbox
  try {
    if (!existsSync(outboxPath)) {
      return { signals, status };
    }

    const files = readdirSync(outboxPath)
      .filter(f => f.endsWith('.json'))
      .sort();

    for (const file of files) {
      try {
        const signalPath = join(outboxPath, file);
        const content = readFileSync(signalPath, 'utf-8');
        const signal: SignalMessage = JSON.parse(content);
        signals.push(signal);
      } catch (err) {
        await emitter.log('warn', `Failed to parse signal file ${file} for ${teamDomain}`, {
          'squad.domain': teamDomain,
          'signal.file': file,
          'error.message': err instanceof Error ? err.message : String(err)
        });
      }
    }

    await emitter.metric('signals.read', signals.length, {
      'squad.domain': teamDomain
    });
  } catch (err) {
    await emitter.log('warn', `Failed to read outbox for ${teamDomain}`, {
      'squad.domain': teamDomain,
      'error.message': err instanceof Error ? err.message : String(err)
    });
  }

  return { signals, status };
}

function archiveSignal(teamLocation: string, signalPath: string, emitter: OTelEmitter): void {
  try {
    const archivePath = join(teamLocation, '.squad', 'signals', 'archive');
    ensureDir(archivePath);

    const filename = basename(signalPath);
    const destPath = join(archivePath, filename);

    renameSync(signalPath, destPath);
  } catch (err) {
    // Best-effort archive, don't crash if it fails
  }
}

// ==================== Curated Summary ====================

interface TeamSummary {
  domain: string;
  status: ScanStatus | null;
  signals: SignalMessage[];
  lastUpdate: string;
}

function curateTeamSummary(
  domain: string,
  status: ScanStatus | null,
  signals: SignalMessage[]
): { message: string; importance: 'low' | 'medium' | 'high' } {
  // Determine importance and craft message
  let importance: 'low' | 'medium' | 'high' = 'low';
  let message = '';

  // Check for completion
  if (status?.state === 'complete') {
    importance = 'high';
    const findings = signals.filter(s => s.type === 'report').length;
    const alerts = signals.filter(s => s.type === 'alert').length;
    
    if (findings > 0 || alerts > 0) {
      message = `${domain} completed — ${alerts} alert${alerts !== 1 ? 's' : ''}, ${findings} report${findings !== 1 ? 's' : ''}`;
    } else {
      message = `${domain} completed — ${status.step}`;
    }
  }
  // Check for failures
  else if (status?.state === 'failed') {
    importance = 'high';
    message = `${domain} failed — ${status.error || 'unknown error'}`;
  }
  // Check for alerts
  else if (signals.some(s => s.type === 'alert')) {
    importance = 'medium';
    const alertCount = signals.filter(s => s.type === 'alert').length;
    message = `${domain} — ${alertCount} alert${alertCount !== 1 ? 's' : ''}`;
  }
  // Progress updates
  else if (status && status.progress_pct !== undefined) {
    importance = 'low';
    message = `${domain} — ${status.step} (${status.progress_pct}%)`;
  }
  // General status
  else if (status) {
    importance = 'low';
    message = `${domain} — ${status.step}`;
  }

  return { message, importance };
}

// ==================== Output Delivery ====================

async function deliverToConsole(
  teamDomain: string,
  status: ScanStatus | null,
  signals: SignalMessage[],
  emitter: OTelEmitter
): Promise<void> {
  const timestamp = formatTimestamp();

  // Print individual signals
  for (const signal of signals) {
    const emoji = getSignalEmoji(signal.type);
    console.log(`${timestamp} ${emoji} ${teamDomain} | ${signal.subject}`);
    
    if (signal.type === 'alert' || signal.type === 'report') {
      // Show body for important signals
      const preview = signal.body.length > 100 
        ? signal.body.slice(0, 100) + '...' 
        : signal.body;
      console.log(`  └─ ${preview}`);
    }
  }

  // Print status updates
  if (status) {
    const emoji = getStateEmoji(status.state);
    console.log(`${timestamp} ${emoji} ${teamDomain} | ${status.step}${status.progress_pct !== undefined ? ` (${status.progress_pct}%)` : ''}`);
  }

  // Print curated summary if significant
  const { message, importance } = curateTeamSummary(teamDomain, status, signals);
  if (importance !== 'low' && message) {
    console.log(`${timestamp} 📊 Meta Summary | ${message}`);
  }

  await emitter.event('relay.delivered.console', {
    'squad.domain': teamDomain,
    'signal.count': signals.length,
    'delivery.type': 'console'
  });
}

// ==================== Main Loop ====================

async function relayLoop(
  repoRoot: string,
  config: FederationConfig,
  emitter: OTelEmitter,
  once: boolean = false,
  interval: number = 2000
): Promise<void> {
  const registry = new TeamRegistry(repoRoot, emitter);

  await emitter.span('relay.loop', async () => {
    while (true) {
      try {
        // Discover teams
        const teams = await registry.list();

        if (teams.length === 0) {
          if (once) break;
          await new Promise(resolve => setTimeout(resolve, interval));
          continue;
        }

        // Read signals from each team
        for (const team of teams) {
          await emitter.span('relay.team', async () => {
            const { signals, status } = await readTeamSignals(
              team.location,
              team.domain,
              emitter
            );

            if (signals.length === 0 && !status) {
              return; // Nothing to report for this team
            }

            // Always deliver to console — Teams integration happens at skill layer
            await deliverToConsole(team.domain, status, signals, emitter);

            // Archive processed signals
            const outboxPath = join(team.location, '.squad', 'signals', 'outbox');
            for (const signal of signals) {
              const signalFile = readdirSync(outboxPath)
                .find(f => f.includes(signal.id));
              
              if (signalFile) {
                archiveSignal(team.location, join(outboxPath, signalFile), emitter);
              }
            }

            await emitter.metric('signals.archived', signals.length, {
              'squad.domain': team.domain
            });
          }, {
            'squad.domain': team.domain
          });
        }
      } catch (err) {
        await emitter.log('error', 'Relay loop error', {
          'error.message': err instanceof Error ? err.message : String(err)
        });
      }

      if (once) break;
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  });
}

// ==================== Entry Point ====================

async function main() {
  const { interval, once } = parseArgs();
  const repoRoot = process.cwd();
  const emitter = new OTelEmitter();

  // Read federation config
  const configPath = join(repoRoot, 'federate.config.json');
  let config: FederationConfig;

  try {
    const configContent = readFileSync(configPath, 'utf-8');
    config = JSON.parse(configContent);
  } catch (err) {
    console.error('❌ Failed to read federate.config.json');
    console.error('   Ensure federation is set up first: npx tsx scripts/setup.ts');
    process.exit(1);
  }

  // Emit startup event
  await emitter.event('relay.started', {
    'relay.interval': interval,
    'relay.mode': once ? 'once' : 'loop'
  });

  console.log(`🚀 Meta relay started (file-signal mode, interval: ${interval}ms)`);
  console.log('   Watching team signals...\n');

  // Run relay loop
  await relayLoop(repoRoot, config, emitter, once, interval);

  await emitter.event('relay.stopped', {});
  console.log('\n✅ Meta relay stopped');
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
