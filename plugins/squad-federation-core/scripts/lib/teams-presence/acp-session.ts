/**
 * AcpSession — Persistent Copilot CLI session via Agent Client Protocol.
 *
 * Spawns `copilot --acp --yolo` and communicates via JSON-RPC over stdio.
 * Provides session management and prompt execution with streaming response collection.
 */

import { spawn, type ChildProcess } from 'child_process';

export class AcpSession {
  private child: ChildProcess;
  private buffer = '';
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (reason: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private nextId = 1;
  private sessionId: string | null = null;
  private notifications: Array<{ method: string; params: any }> = [];
  private dead = false;

  constructor(private cwd: string, private log: (msg: string) => void, private timeoutMs = 120_000) {
    this.child = spawn('copilot', ['--acp', '--yolo', '--no-custom-instructions'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
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
            clearTimeout(req.timer);
            this.pendingRequests.delete(msg.id);
            if (msg.error) req.reject(new Error(msg.error.message));
            else req.resolve(msg.result);
          } else if (msg.method) {
            this.notifications.push({ method: msg.method, params: msg.params });
          }
        } catch { /* ignore parse errors */ }
      }
    });

    this.child.stderr!.on('data', () => {});

    this.child.on('exit', (code) => {
      this.dead = true;
      this.log(`⚠️  ACP process exited with code ${code}`);
      for (const [, req] of this.pendingRequests) {
        clearTimeout(req.timer);
        req.reject(new Error(`ACP process exited (code ${code})`));
      }
      this.pendingRequests.clear();
    });
  }

  get isAlive(): boolean { return !this.dead; }

  private send(method: string, params: any): Promise<any> {
    if (this.dead) return Promise.reject(new Error('ACP process is dead'));
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`ACP request ${method} timed out`));
        }
      }, 30_000);
      this.pendingRequests.set(id, { resolve, reject, timer });
      try {
        this.child.stdin!.write(
          JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'
        );
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        this.dead = true;
        reject(new Error(`ACP stdin write failed: ${(err as Error).message}`));
      }
    });
  }

  async initialize(): Promise<void> {
    await this.send('initialize', {
      protocolVersion: 1,
      capabilities: {},
      clientInfo: { name: 'teams-presence', version: '1.0' },
    });
    this.child.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method: 'initialized' }) + '\n');
    this.log('✅ ACP session initialized');
  }

  async loadSession(): Promise<string> {
    const result = await this.send('session/list', {});
    const sessions = result?.sessions || [];
    const existing = sessions.find((s: any) => s.cwd === this.cwd);

    if (existing) {
      this.sessionId = existing.sessionId;
      this.log(`📎 Reusing existing session: ${this.sessionId}`);
      await this.send('session/load', {
        sessionId: this.sessionId,
        cwd: this.cwd,
        mcpServers: [],
      });
      return this.sessionId!;
    }

    throw new Error(
      'No existing Copilot session found for this project. ' +
      'Start a Copilot session first (e.g., copilot -i "hello") then retry.'
    );
  }

  async prompt(text: string): Promise<string> {
    if (!this.sessionId) throw new Error('No ACP session loaded');
    if (this.dead) throw new Error('ACP process is dead — restart required');

    this.notifications = [];

    await this.send('session/prompt', {
      sessionId: this.sessionId,
      prompt: [{ type: 'text', text }],
    });

    const chunks: string[] = [];
    const start = Date.now();

    while (Date.now() - start < this.timeoutMs) {
      if (this.dead) throw new Error('ACP process died during execution');
      await new Promise(r => setTimeout(r, 500));

      while (this.notifications.length > 0) {
        const notif = this.notifications.shift()!;
        if (notif.method === 'session/update') {
          const update = notif.params?.update;
          if (update?.sessionUpdate === 'agent_message_chunk' && update?.content?.text) {
            chunks.push(update.content.text);
          }
          if (update?.sessionUpdate === 'tool_call' && update?.title === 'task_complete') {
            return chunks.join('');
          }
        }
      }
    }

    return chunks.join('') || '(timed out waiting for agent response)';
  }

  kill(): void {
    this.dead = true;
    try { this.child.kill(); } catch { /* ignore */ }
  }
}
