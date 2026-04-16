#!/usr/bin/env npx tsx
/**
 * Teams Presence — Persistent bridge between Teams and the federation.
 *
 * Polls a Teams channel via Microsoft Graph API for messages addressing
 * the federation persona (@<federationName>), pipes instructions to a
 * persistent Copilot ACP session, and posts results back.
 *
 * Usage:
 *   npx tsx scripts/teams-presence.ts                  # start (default 30s)
 *   npx tsx scripts/teams-presence.ts --interval 15    # custom interval
 *   npx tsx scripts/teams-presence.ts --once            # single poll then exit
 *   npx tsx scripts/teams-presence.ts --stop            # stop running presence
 *   npx tsx scripts/teams-presence.ts --status          # check if running
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { AcpSession } from './lib/teams-presence/acp-session.js';
import { getGraphToken } from './lib/teams-presence/graph-client.js';
import { WatermarkStore } from './lib/teams-presence/watermark.js';
import { pollCycle } from './lib/teams-presence/poll.js';

// ==================== Constants ====================

const REPO_ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
const SQUAD_DIR = path.join(REPO_ROOT, '.squad');
const PID_FILE = path.join(SQUAD_DIR, 'presence.pid');
const LOG_FILE = path.join(SQUAD_DIR, 'presence.log');
const DEFAULT_INTERVAL = 30;

// ==================== Helpers ====================

function ensureDir(p: string): void {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function log(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  try { ensureDir(path.dirname(LOG_FILE)); fs.appendFileSync(LOG_FILE, line + '\n'); } catch { /* best-effort */ }
}

// ==================== Config ====================

interface PresenceConfig {
  federationName: string;
  teamsConfig: { teamId: string; channelId: string };
}

function loadConfig(): PresenceConfig {
  const configPath = path.join(REPO_ROOT, 'federate.config.json');
  if (!fs.existsSync(configPath)) throw new Error('federate.config.json not found — run federation setup first');
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  if (!raw.teamsConfig?.teamId || !raw.teamsConfig?.channelId) throw new Error('teamsConfig required in federate.config.json');
  if (!raw.federationName) throw new Error('federationName required in federate.config.json');
  return { federationName: raw.federationName, teamsConfig: raw.teamsConfig };
}

// ==================== PID ====================

function readPid(): number | null {
  try {
    if (!fs.existsSync(PID_FILE)) return null;
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch { return null; }
}

function writePid(): void { ensureDir(SQUAD_DIR); fs.writeFileSync(PID_FILE, String(process.pid)); }
function removePid(): void { try { if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE); } catch {} }

function isRunning(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

// ==================== CLI ====================

function parseArgs() {
  const args = process.argv.slice(2);
  let interval = DEFAULT_INTERVAL;
  let once = false, stop = false, status = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--interval':
        interval = parseInt(args[++i], 10);
        if (isNaN(interval) || interval < 5) { console.error('❌ --interval must be >= 5'); process.exit(1); }
        break;
      case '--once': once = true; break;
      case '--stop': stop = true; break;
      case '--status': status = true; break;
    }
  }
  return { interval, once, stop, status };
}

function handleStop(): void {
  const pid = readPid();
  if (!pid) { console.log('Not running.'); return; }
  if (!isRunning(pid)) { console.log('Not running (stale PID). Cleaned up.'); removePid(); return; }
  try { process.kill(pid, 'SIGTERM'); removePid(); console.log(`✅ Stopped (pid ${pid}).`); }
  catch (e) { console.error(`Failed: ${(e as Error).message}`); }
}

function handleStatus(): void {
  const pid = readPid();
  if (!pid) { console.log('❌ Not running'); return; }
  if (isRunning(pid)) { console.log(`✅ Running (pid ${pid})`); }
  else { console.log('❌ Not running (stale PID)'); removePid(); }
}

// ==================== Main ====================

async function run(interval: number, once: boolean): Promise<void> {
  const existing = readPid();
  if (existing && isRunning(existing)) {
    console.error(`❌ Already running (pid ${existing}). Use --stop first.`);
    process.exit(1);
  }

  const config = loadConfig();
  log(`🌐 Teams presence starting for @${config.federationName}`);
  log(`   Interval: ${interval}s`);

  getGraphToken(); // verify auth
  log('✅ Graph API token OK');

  log('🚀 Starting persistent Copilot ACP session...');
  const acp = new AcpSession(REPO_ROOT, log);
  await acp.initialize();
  await acp.loadSession();

  writePid();
  log(`📝 PID ${process.pid}`);

  let running = true;
  const shutdown = () => {
    if (!running) return;
    running = false;
    log('👋 Shutting down...');
    acp.kill();
    removePid();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  const watermark = new WatermarkStore(SQUAD_DIR);
  const deps = { teamsConfig: config.teamsConfig, federationName: config.federationName, acp, watermark, log };

  log('🔄 Entering poll loop...');
  do {
    if (!acp.isAlive) { log('💀 ACP died — shutting down'); break; }
    try {
      const count = await pollCycle(deps);
      if (count > 0) log(`✅ ${count} message(s) processed`);
    } catch (err) {
      log(`⚠️  Poll error: ${(err as Error).message}`);
    }
    if (!once) await new Promise(r => setTimeout(r, interval * 1000));
  } while (running && !once);

  acp.kill();
  removePid();
}

// ==================== Entry ====================

async function main(): Promise<void> {
  const { interval, once, stop, status } = parseArgs();
  if (stop) { handleStop(); return; }
  if (status) { handleStatus(); return; }
  await run(interval, once);
}

const isDirectRun = process.argv[1]?.endsWith('teams-presence.ts') || process.argv[1]?.endsWith('teams-presence.js');
if (isDirectRun) {
  main().catch((err) => { log(`💥 Fatal: ${(err as Error).message}`); removePid(); process.exit(1); });
}
