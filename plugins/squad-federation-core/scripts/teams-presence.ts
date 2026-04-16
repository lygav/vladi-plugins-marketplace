#!/usr/bin/env npx tsx
/**
 * Teams Presence — Persistent bridge between Teams and the federation.
 *
 * Polls a Teams channel via Microsoft Graph API for messages addressing
 * the federation persona (@<federationName>), pipes instructions to a
 * persistent Copilot ACP session for execution, and posts results back.
 *
 * Architecture:
 *   Graph API  = eyes & mouth (poll messages, post replies) — fast, mechanical
 *   ACP session = brain (execute instructions) — persistent, no startup cost
 *
 * Usage:
 *   npx tsx scripts/teams-presence.ts                  # start (default 30s interval)
 *   npx tsx scripts/teams-presence.ts --interval 15    # custom interval in seconds
 *   npx tsx scripts/teams-presence.ts --once            # single poll then exit
 *   npx tsx scripts/teams-presence.ts --stop            # stop running presence
 *   npx tsx scripts/teams-presence.ts --status          # check if running
 *
 * Requires:
 *   - federate.config.json with teamsConfig and federationName
 *   - `az` CLI logged in (for Graph API tokens)
 *   - `copilot` CLI available (for ACP session)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn, type ChildProcess } from 'child_process';

// ==================== Constants ====================

const REPO_ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
const SQUAD_DIR = path.join(REPO_ROOT, '.squad');
const PID_FILE = path.join(SQUAD_DIR, 'presence.pid');
const LOG_FILE = path.join(SQUAD_DIR, 'presence.log');
const WATERMARK_FILE = path.join(SQUAD_DIR, 'teams-watermark.json');
const DEFAULT_INTERVAL_SECONDS = 30;
const COPILOT_TIMEOUT_MS = 120_000;
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

// ==================== Types ====================

interface TeamsConfig {
  teamId: string;
  channelId: string;
}

interface FederationConfig {
  federationName: string;
  teamsConfig: TeamsConfig;
}

interface TeamsMessage {
  id: string;
  createdDateTime: string;
  body: { content: string; contentType: string };
  from?: { user?: { displayName: string; id: string } };
}

interface Watermark {
  lastSeenTimestamp: string;
  lastSeenMessageId: string;
}

// ==================== Helpers ====================

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function log(message: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}`;
  console.log(line);
  try {
    ensureDir(path.dirname(LOG_FILE));
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch { /* best-effort */ }
}

// ==================== Config ====================

function loadConfig(): FederationConfig {
  const configPath = path.join(REPO_ROOT, 'federate.config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('federate.config.json not found — run federation setup first');
  }
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  if (!raw.teamsConfig?.teamId || !raw.teamsConfig?.channelId) {
    throw new Error('teamsConfig (teamId, channelId) required in federate.config.json');
  }
  if (!raw.federationName) {
    throw new Error('federationName required in federate.config.json');
  }
  return {
    federationName: raw.federationName,
    teamsConfig: raw.teamsConfig,
  };
}

// ==================== Graph API ====================

function getGraphToken(): string {
  try {
    return execSync(
      'az account get-access-token --resource https://graph.microsoft.com --query accessToken -o tsv',
      { encoding: 'utf-8', timeout: 10_000 }
    ).trim();
  } catch (err) {
    throw new Error(`Failed to get Graph token — is 'az' logged in? ${(err as Error).message}`);
  }
}

async function graphGet(token: string, path: string): Promise<any> {
  const resp = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Graph GET ${path} failed (${resp.status}): ${body.slice(0, 200)}`);
  }
  return resp.json();
}

async function graphPost(token: string, path: string, body: unknown): Promise<any> {
  const resp = await fetch(`${GRAPH_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Graph POST ${path} failed (${resp.status}): ${text.slice(0, 200)}`);
  }
  return resp.json();
}

async function fetchMessages(
  token: string,
  config: TeamsConfig,
  afterTimestamp?: string
): Promise<TeamsMessage[]> {
  const { teamId, channelId } = config;
  let url = `/teams/${teamId}/channels/${channelId}/messages?$top=20&$orderby=createdDateTime desc`;

  const data = await graphGet(token, url);
  let messages: TeamsMessage[] = data.value || [];

  // Filter to messages after watermark
  if (afterTimestamp) {
    const watermarkTime = new Date(afterTimestamp).getTime();
    messages = messages.filter(m => new Date(m.createdDateTime).getTime() > watermarkTime);
  }

  return messages;
}

async function replyToMessage(
  token: string,
  config: TeamsConfig,
  messageId: string,
  content: string
): Promise<void> {
  const { teamId, channelId } = config;
  await graphPost(
    token,
    `/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`,
    { body: { content, contentType: 'text' } }
  );
}

// ==================== Watermark ====================

function loadWatermark(): Watermark | null {
  try {
    if (!fs.existsSync(WATERMARK_FILE)) return null;
    return JSON.parse(fs.readFileSync(WATERMARK_FILE, 'utf-8'));
  } catch { return null; }
}

function saveWatermark(watermark: Watermark): void {
  ensureDir(path.dirname(WATERMARK_FILE));
  fs.writeFileSync(WATERMARK_FILE, JSON.stringify(watermark, null, 2), 'utf-8');
}

// ==================== ACP Session ====================

class AcpSession {
  private child: ChildProcess;
  private buffer = '';
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (reason: Error) => void;
  }>();
  private nextId = 1;
  private sessionId: string | null = null;
  private notifications: Array<{ method: string; params: any }> = [];

  constructor() {
    this.child = spawn('copilot', ['--acp', '--yolo', '--no-custom-instructions'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: REPO_ROOT,
    });

    this.child.stdout!.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
            const req = this.pendingRequests.get(msg.id)!;
            this.pendingRequests.delete(msg.id);
            if (msg.error) req.reject(new Error(msg.error.message));
            else req.resolve(msg.result);
          } else if (msg.method) {
            this.notifications.push({ method: msg.method, params: msg.params });
          }
        } catch { /* ignore parse errors */ }
      }
    });

    this.child.stderr!.on('data', (data: Buffer) => {
      // Suppress stderr noise from copilot
    });

    this.child.on('exit', (code) => {
      log(`⚠️  ACP process exited with code ${code}`);
    });
  }

  private send(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pendingRequests.set(id, { resolve, reject });
      const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });
      this.child.stdin!.write(msg + '\n');

      // Timeout after 30s for RPC calls
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`ACP request ${method} timed out`));
        }
      }, 30_000);
    });
  }

  async initialize(): Promise<void> {
    await this.send('initialize', {
      protocolVersion: 1,
      capabilities: {},
      clientInfo: { name: 'teams-presence', version: '1.0' },
    });
    // Send initialized notification
    this.child.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method: 'initialized' }) + '\n');
    log('✅ ACP session initialized');
  }

  async loadSession(): Promise<string> {
    // List existing sessions for this cwd, or load a new one
    const result = await this.send('session/list', {});
    const sessions = result?.sessions || [];

    // Find a session in our cwd, or use the first available
    const existing = sessions.find((s: any) => s.cwd === REPO_ROOT);
    if (existing) {
      this.sessionId = existing.sessionId;
      log(`📎 Reusing existing session: ${this.sessionId}`);
    }

    if (this.sessionId) {
      await this.send('session/load', {
        sessionId: this.sessionId,
        cwd: REPO_ROOT,
        mcpServers: [],
      });
    }

    return this.sessionId || 'none';
  }

  async prompt(text: string): Promise<string> {
    if (!this.sessionId) {
      throw new Error('No ACP session loaded');
    }

    // Clear notification buffer
    this.notifications = [];

    // Send prompt — this returns quickly, results stream as notifications
    try {
      await this.send('session/prompt', {
        sessionId: this.sessionId,
        prompt: [{ type: 'text', text }],
      });
    } catch {
      // session/prompt may error if session isn't loaded yet — 
      // the load itself triggers processing, so notifications still come
    }

    // Collect agent response from notifications (wait for completion)
    const responseChunks: string[] = [];
    const startTime = Date.now();

    while (Date.now() - startTime < COPILOT_TIMEOUT_MS) {
      await new Promise(r => setTimeout(r, 500));

      // Drain notifications
      while (this.notifications.length > 0) {
        const notif = this.notifications.shift()!;
        if (notif.method === 'session/update') {
          const update = notif.params?.update;
          if (update?.sessionUpdate === 'agent_message_chunk' && update?.content?.text) {
            responseChunks.push(update.content.text);
          }
          if (update?.sessionUpdate === 'tool_call' && update?.title === 'task_complete') {
            return responseChunks.join('');
          }
        }
      }
    }

    return responseChunks.join('') || '(timed out waiting for agent response)';
  }

  kill(): void {
    try { this.child.kill(); } catch { /* ignore */ }
  }
}

// ==================== PID Management ====================

function readPid(): number | null {
  try {
    if (!fs.existsSync(PID_FILE)) return null;
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch { return null; }
}

function writePid(pid: number): void {
  ensureDir(path.dirname(PID_FILE));
  fs.writeFileSync(PID_FILE, String(pid));
}

function removePid(): void {
  try { if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE); } catch { /* best-effort */ }
}

function isProcessRunning(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

// ==================== CLI ====================

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
        if (isNaN(interval) || interval < 5) {
          console.error('❌ --interval must be >= 5 seconds');
          process.exit(1);
        }
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
  if (!pid) { console.log('No presence process running.'); return; }
  if (!isProcessRunning(pid)) {
    console.log('Presence process not running (stale PID). Cleaning up.');
    removePid();
    return;
  }
  try {
    process.kill(pid, 'SIGTERM');
    removePid();
    console.log(`✅ Presence stopped (pid ${pid}).`);
  } catch (err) {
    console.error(`Failed to stop: ${(err as Error).message}`);
  }
}

function handleStatus(): void {
  const pid = readPid();
  if (!pid) { console.log('❌ Not running'); return; }
  if (isProcessRunning(pid)) {
    console.log(`✅ Running (pid ${pid})`);
    const wm = loadWatermark();
    if (wm) console.log(`   Last polled: ${wm.lastSeenTimestamp}`);
  } else {
    console.log('❌ Not running (stale PID)');
    removePid();
  }
}

// ==================== Main Loop ====================

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

async function pollCycle(
  config: FederationConfig,
  acp: AcpSession
): Promise<number> {
  const token = getGraphToken();
  const watermark = loadWatermark();
  const afterTimestamp = watermark?.lastSeenTimestamp || new Date().toISOString();

  // On first run, set watermark to now (don't replay history)
  if (!watermark) {
    saveWatermark({ lastSeenTimestamp: new Date().toISOString(), lastSeenMessageId: '' });
    log('📌 Watermark initialized to now');
    return 0;
  }

  const messages = await fetchMessages(token, config.teamsConfig, afterTimestamp);
  if (messages.length === 0) return 0;

  // Filter for messages addressing the federation persona
  const handle = `@${config.federationName}`.toLowerCase();
  const relevant = messages.filter(m => {
    const text = stripHtml(m.body?.content || '').toLowerCase();
    return text.includes(handle);
  });

  if (relevant.length === 0) {
    // Advance watermark to newest message even if none were relevant
    const newest = messages[0];
    saveWatermark({
      lastSeenTimestamp: newest.createdDateTime,
      lastSeenMessageId: newest.id,
    });
    return 0;
  }

  log(`📬 Found ${relevant.length} message(s) addressing @${config.federationName}`);

  // Process oldest first
  for (const msg of relevant.reverse()) {
    const rawText = stripHtml(msg.body.content);
    const instruction = rawText.replace(new RegExp(`@${config.federationName}`, 'gi'), '').trim();
    const sender = msg.from?.user?.displayName || 'someone';

    log(`💬 ${sender}: ${instruction.slice(0, 100)}`);

    // Acknowledge
    try {
      await replyToMessage(
        token, config.teamsConfig, msg.id,
        `👋 Got it, ${sender}. Working on: "${instruction.slice(0, 100)}"...`
      );
    } catch (err) {
      log(`⚠️  Failed to acknowledge: ${(err as Error).message}`);
    }

    // Execute via ACP
    try {
      const response = await acp.prompt(
        `The user "${sender}" sent this instruction via Teams: "${instruction}"\n\n` +
        `Execute it. Be concise in your response — it will be posted back to Teams.`
      );

      // Post result back
      const reply = response.slice(0, 4000) || '✅ Done (no output)';
      await replyToMessage(token, config.teamsConfig, msg.id, reply);
      log(`✅ Replied to ${sender}`);
    } catch (err) {
      const errMsg = `❌ Failed: ${(err as Error).message}`;
      log(errMsg);
      try {
        await replyToMessage(token, config.teamsConfig, msg.id, errMsg);
      } catch { /* best-effort */ }
    }

    // Advance watermark after each processed message
    saveWatermark({
      lastSeenTimestamp: msg.createdDateTime,
      lastSeenMessageId: msg.id,
    });
  }

  return relevant.length;
}

async function runPresence(interval: number, once: boolean): Promise<void> {
  // Check for existing instance
  const existingPid = readPid();
  if (existingPid && isProcessRunning(existingPid)) {
    console.error(`❌ Presence already running (pid ${existingPid}). Use --stop first.`);
    process.exit(1);
  }

  const config = loadConfig();
  log(`🌐 Teams presence starting for @${config.federationName}`);
  log(`   Team: ${config.teamsConfig.teamId}`);
  log(`   Channel: ${config.teamsConfig.channelId}`);
  log(`   Interval: ${interval}s`);

  // Verify Graph token works
  getGraphToken();
  log('✅ Graph API token OK');

  // Start ACP session
  log('🚀 Starting persistent Copilot ACP session...');
  const acp = new AcpSession();
  await acp.initialize();
  await acp.loadSession();

  // Write PID
  writePid(process.pid);
  log(`📝 PID ${process.pid} written to ${PID_FILE}`);

  // Graceful shutdown
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

  // Main loop
  if (once) {
    try {
      const count = await pollCycle(config, acp);
      log(`Single poll complete — ${count} message(s) processed`);
    } catch (err) {
      log(`❌ Poll failed: ${(err as Error).message}`);
    }
    acp.kill();
    removePid();
    return;
  }

  log('🔄 Entering poll loop...');
  while (running) {
    try {
      const count = await pollCycle(config, acp);
      if (count > 0) log(`✅ Cycle complete — ${count} message(s) processed`);
    } catch (err) {
      log(`⚠️  Poll error: ${(err as Error).message}`);
    }
    // Wait for next cycle
    await new Promise(r => setTimeout(r, interval * 1000));
  }
}

// ==================== Entry Point ====================

async function main(): Promise<void> {
  const { interval, once, stop, status } = parseArgs();

  if (stop) { handleStop(); return; }
  if (status) { handleStatus(); return; }

  await runPresence(interval, once);
}

main().catch((err) => {
  log(`💥 Fatal: ${(err as Error).message}`);
  removePid();
  process.exit(1);
});
