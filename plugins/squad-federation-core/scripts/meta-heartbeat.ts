#!/usr/bin/env npx tsx
/**
 * Meta Heartbeat — Periodic unattended federation health checks.
 *
 * Spawns fresh copilot sessions on a timer to check team status,
 * read signals, and report summaries.
 *
 * Usage:
 *   npx tsx scripts/meta-heartbeat.ts                  # start (default 300s interval)
 *   npx tsx scripts/meta-heartbeat.ts --interval 60    # custom interval
 *   npx tsx scripts/meta-heartbeat.ts --once            # single run then exit
 *   npx tsx scripts/meta-heartbeat.ts --stop            # stop running heartbeat
 *   npx tsx scripts/meta-heartbeat.ts --status          # check if heartbeat is running
 *
 * The heartbeat discovers how copilot was launched (via COPILOT_LOADER_PID),
 * strips any --resume flag, and spawns fresh sessions with a status-check prompt.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn, type ChildProcess } from 'child_process';

// ==================== Constants ====================

const REPO_ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
const SQUAD_DIR = path.join(REPO_ROOT, '.squad');
const PID_FILE = path.join(SQUAD_DIR, 'heartbeat.pid');
const LOG_FILE = path.join(SQUAD_DIR, 'heartbeat.log');
const DEFAULT_INTERVAL_SECONDS = 300;
const SESSION_TIMEOUT_SECONDS = 120;

const HEARTBEAT_PROMPT = `You are the meta-squad heartbeat. This is an automated periodic check — be concise.

1. Check all team signal outboxes for updates.
2. Read team status files (.squad/signals/status.json in each worktree).
3. Summarize what each team is doing in 1-2 lines each.
4. If any team has alerts or errors, highlight them prominently.
5. If teamsConfig is set in federate.config.json, post the summary to the Teams channel.
6. If any teams have pending questions in their outbox, relay them.
7. Check for stuck teams (no status update in >10 minutes while not complete/failed).

Keep output brief — this runs every few minutes.`;

// ==================== Helpers ====================

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function log(message: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}`;
  console.log(line);

  try {
    ensureDir(path.dirname(LOG_FILE));
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch {
    // Best-effort log to file
  }
}

function parseArgs(): {
  interval: number;
  once: boolean;
  stop: boolean;
  status: boolean;
} {
  const args = process.argv.slice(2);
  let interval = DEFAULT_INTERVAL_SECONDS;
  let once = false;
  let stop = false;
  let status = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--interval':
        interval = parseInt(args[++i], 10);
        if (isNaN(interval) || interval < 10) {
          console.error('❌ --interval must be a number >= 10');
          process.exit(1);
        }
        break;
      case '--once':
        once = true;
        break;
      case '--stop':
        stop = true;
        break;
      case '--status':
        status = true;
        break;
    }
  }

  return { interval, once, stop, status };
}

// ==================== PID Management ====================

function readPid(): number | null {
  try {
    if (!fs.existsSync(PID_FILE)) return null;
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

function writePid(pid: number): void {
  ensureDir(path.dirname(PID_FILE));
  fs.writeFileSync(PID_FILE, String(pid));
}

function removePid(): void {
  try {
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
  } catch {
    // Best effort
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ==================== Copilot Command Discovery ====================

function discoverBaseCommand(): string[] {
  const loaderPid = process.env.COPILOT_LOADER_PID;
  if (!loaderPid) {
    log('⚠️  COPILOT_LOADER_PID not set — falling back to default "copilot"');
    return ['copilot'];
  }

  try {
    const fullCommand = execSync(`ps -ww -o command= -p ${loaderPid}`, {
      encoding: 'utf-8',
    }).trim();

    if (!fullCommand) {
      log('⚠️  Could not read command for COPILOT_LOADER_PID — falling back to "copilot"');
      return ['copilot'];
    }

    log(`📋 Discovered copilot command: ${fullCommand}`);

    // Parse the command into parts and strip --resume <session-id>
    const parts = fullCommand.split(/\s+/);
    const cleaned: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === '--resume') {
        i++; // Skip the session-id argument
        continue;
      }
      cleaned.push(parts[i]);
    }

    log(`📋 Base command (no --resume): ${cleaned.join(' ')}`);
    return cleaned;
  } catch (err) {
    log(`⚠️  Failed to discover copilot command: ${(err as Error).message}`);
    return ['copilot'];
  }
}

// ==================== Heartbeat Session ====================

function spawnHeartbeatSession(baseCommand: string[]): Promise<{
  exitCode: number | null;
  timedOut: boolean;
}> {
  return new Promise((resolve) => {
    const [cmd, ...baseArgs] = baseCommand;

    // Build args: base args + prompt flags
    const args = [
      ...baseArgs,
      '-p',
      HEARTBEAT_PROMPT,
      '--yolo',
      '--no-ask-user',
      '--autopilot',
    ];

    log(`🫀 Spawning heartbeat session: ${cmd} ${args.slice(0, 3).join(' ')} ...`);

    let timedOut = false;
    let child: ChildProcess;

    try {
      child = spawn(cmd, args, {
        cwd: REPO_ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });
    } catch (err) {
      log(`❌ Failed to spawn copilot session: ${(err as Error).message}`);
      resolve({ exitCode: 1, timedOut: false });
      return;
    }

    // Capture output for logging
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    // Timeout guard
    const timeout = setTimeout(() => {
      timedOut = true;
      log(`⏰ Session timed out after ${SESSION_TIMEOUT_SECONDS}s — killing`);
      try {
        if (child.pid) {
          process.kill(child.pid, 'SIGTERM');
          // Give it a moment, then force kill
          setTimeout(() => {
            try {
              if (child.pid) process.kill(child.pid, 'SIGKILL');
            } catch {
              // Already dead
            }
          }, 5000);
        }
      } catch {
        // Process already dead
      }
    }, SESSION_TIMEOUT_SECONDS * 1000);

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (stdout.trim()) {
        log(`📄 Session output:\n${stdout.trim().split('\n').map(l => `  │ ${l}`).join('\n')}`);
      }
      if (stderr.trim()) {
        log(`⚠️  Session stderr:\n${stderr.trim().split('\n').map(l => `  │ ${l}`).join('\n')}`);
      }

      resolve({ exitCode: code, timedOut });
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      log(`❌ Session spawn error: ${err.message}`);
      resolve({ exitCode: 1, timedOut: false });
    });
  });
}

// ==================== Commands ====================

function handleStop(): void {
  const pid = readPid();
  if (!pid) {
    console.log('ℹ️  No heartbeat PID file found — nothing to stop.');
    return;
  }

  if (!isProcessRunning(pid)) {
    console.log(`ℹ️  Heartbeat process ${pid} is not running (stale PID file). Cleaning up.`);
    removePid();
    return;
  }

  try {
    process.kill(pid, 'SIGTERM');
    console.log(`✅ Heartbeat stopped (PID: ${pid})`);
  } catch (err) {
    console.error(`❌ Failed to stop heartbeat (PID: ${pid}): ${(err as Error).message}`);
  }

  removePid();
}

function handleStatus(): void {
  const pid = readPid();
  if (!pid) {
    console.log('💤 Heartbeat is not running (no PID file).');
    return;
  }

  if (isProcessRunning(pid)) {
    console.log(`🫀 Heartbeat is running (PID: ${pid})`);
    console.log(`   PID file: ${PID_FILE}`);
    console.log(`   Log file: ${LOG_FILE}`);
  } else {
    console.log(`💤 Heartbeat is not running (stale PID: ${pid}). Cleaning up.`);
    removePid();
  }
}

// ==================== Main Loop ====================

async function runHeartbeat(interval: number, once: boolean): Promise<void> {
  // Check for already-running heartbeat
  const existingPid = readPid();
  if (existingPid && isProcessRunning(existingPid)) {
    console.error(`❌ Heartbeat is already running (PID: ${existingPid}).`);
    console.error('   Use --stop first, or --status to check.');
    process.exit(1);
  }

  // Write our PID
  writePid(process.pid);

  // Cleanup on exit
  const cleanup = () => {
    removePid();
    log('🛑 Heartbeat stopped.');
    process.exit(0);
  };
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);

  log(`🫀 Heartbeat started (PID: ${process.pid}, interval: ${interval}s${once ? ', single-run' : ''})`);

  // Discover copilot command once at startup
  const baseCommand = discoverBaseCommand();

  let cycleCount = 0;

  while (true) {
    cycleCount++;
    log(`\n── Heartbeat cycle #${cycleCount} ──`);

    const startTime = Date.now();
    const { exitCode, timedOut } = await spawnHeartbeatSession(baseCommand);
    const durationMs = Date.now() - startTime;

    if (timedOut) {
      log(`⚠️  Cycle #${cycleCount} timed out after ${SESSION_TIMEOUT_SECONDS}s`);
    } else if (exitCode === 0) {
      log(`✅ Cycle #${cycleCount} completed in ${(durationMs / 1000).toFixed(1)}s`);
    } else {
      log(`⚠️  Cycle #${cycleCount} exited with code ${exitCode} (${(durationMs / 1000).toFixed(1)}s)`);
    }

    if (once) {
      log('🏁 Single-run mode — exiting.');
      break;
    }

    log(`💤 Sleeping ${interval}s until next cycle...`);
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));
  }

  removePid();
}

// ==================== Entry Point ====================

async function main(): Promise<void> {
  const { interval, once, stop, status } = parseArgs();

  if (stop) {
    handleStop();
    return;
  }

  if (status) {
    handleStatus();
    return;
  }

  await runHeartbeat(interval, once);
}

main().catch((err) => {
  log(`💥 Fatal error: ${(err as Error).message}`);
  removePid();
  process.exit(1);
});
