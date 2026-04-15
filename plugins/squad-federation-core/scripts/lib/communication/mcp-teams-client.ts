/**
 * McpTeamsClient — Concrete TeamsClient implementation via MCP protocol.
 *
 * Connects to a local `agency mcp teams` HTTP server using @modelcontextprotocol/sdk.
 * Auto-starts the agency server on first use if not already running.
 *
 * @since v0.5.0
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { spawn, type ChildProcess } from 'child_process';
import type { TeamsClient, TeamsMessage } from './teams-channel-communication.js';

const DEFAULT_PORT = 3978;
const SERVER_STARTUP_TIMEOUT_MS = 15_000;
const HEALTH_CHECK_INTERVAL_MS = 500;

export interface McpTeamsClientOptions {
  /** Port for the agency MCP server (default: 3978) */
  port?: number;
  /** Skip auto-starting the agency server (assume it's already running) */
  externalServer?: boolean;
}

/**
 * Map MCP tool results to TeamsMessage shape.
 * The MCP server returns results as content arrays; extract the text JSON.
 */
function extractJsonFromResult(result: { content: Array<{ type: string; text?: string }> }): unknown {
  const textContent = result.content.find(c => c.type === 'text');
  if (!textContent?.text) {
    throw new Error('MCP tool returned no text content');
  }
  return JSON.parse(textContent.text);
}

/**
 * Normalize a raw Graph API message object into our TeamsMessage shape.
 */
function toTeamsMessage(raw: Record<string, unknown>): TeamsMessage {
  const from = (raw.from as Record<string, unknown>) || {};
  const user = (from.user as Record<string, unknown>) || {};
  const body = (raw.body as Record<string, unknown>) || {};
  return {
    id: String(raw.id || ''),
    createdDateTime: String(raw.createdDateTime || new Date().toISOString()),
    from: {
      user: {
        displayName: user.displayName != null ? String(user.displayName) : undefined,
        id: user.id != null ? String(user.id) : undefined,
      },
    },
    body: {
      contentType: (body.contentType === 'html' ? 'html' : 'text') as 'text' | 'html',
      content: String(body.content || ''),
    },
  };
}

export class McpTeamsClient implements TeamsClient {
  private client: Client | null = null;
  private serverProcess: ChildProcess | null = null;
  private readonly port: number;
  private readonly externalServer: boolean;
  private connectPromise: Promise<void> | null = null;

  constructor(options: McpTeamsClientOptions = {}) {
    this.port = options.port ?? DEFAULT_PORT;
    this.externalServer = options.externalServer ?? false;
  }

  /**
   * Ensure the MCP client is connected, starting the server if needed.
   * Uses a shared promise to prevent concurrent connection attempts.
   */
  private async ensureConnected(): Promise<Client> {
    if (this.client) return this.client;

    if (!this.connectPromise) {
      this.connectPromise = this.initializeConnection();
    }
    await this.connectPromise;
    return this.client!;
  }

  private async initializeConnection(): Promise<void> {
    if (!this.externalServer) {
      await this.startServer();
    }
    await this.waitForServer();
    await this.connectMcpClient();
  }

  /**
   * Start the agency MCP teams server as a child process.
   */
  private async startServer(): Promise<void> {
    // Check if agency CLI exists
    const agencyPath = await this.findAgencyBinary();
    if (!agencyPath) {
      throw new McpTeamsClientError(
        'agency CLI not found. Install it or set externalServer: true if running separately.\n' +
        'See: https://github.com/anthropics/agency'
      );
    }

    this.serverProcess = spawn(
      agencyPath,
      ['mcp', 'teams', '--transport', 'http', '--port', String(this.port)],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      }
    );

    this.serverProcess.on('error', (err) => {
      console.error(`[McpTeamsClient] Server process error: ${err.message}`);
    });

    this.serverProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`[McpTeamsClient] Server exited with code ${code}`);
      }
      this.serverProcess = null;
      this.client = null;
      this.connectPromise = null;
    });
  }

  /**
   * Find the agency binary on PATH.
   */
  private async findAgencyBinary(): Promise<string | null> {
    const { execSync } = await import('child_process');
    try {
      return execSync('which agency', { encoding: 'utf-8' }).trim();
    } catch {
      return null;
    }
  }

  /**
   * Wait for the HTTP server to become healthy.
   */
  private async waitForServer(): Promise<void> {
    const deadline = Date.now() + SERVER_STARTUP_TIMEOUT_MS;
    const url = `http://localhost:${this.port}/mcp`;

    while (Date.now() < deadline) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 0, params: {} }),
          signal: AbortSignal.timeout(2000),
        });
        if (resp.ok || resp.status === 400) {
          // Server is responding (400 = bad request is fine, means it's alive)
          return;
        }
      } catch {
        // Not ready yet
      }
      await new Promise(r => setTimeout(r, HEALTH_CHECK_INTERVAL_MS));
    }

    throw new McpTeamsClientError(
      `Agency MCP server did not start within ${SERVER_STARTUP_TIMEOUT_MS / 1000}s on port ${this.port}`
    );
  }

  /**
   * Connect the MCP SDK client to the running server.
   */
  private async connectMcpClient(): Promise<void> {
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://localhost:${this.port}/mcp`)
    );

    this.client = new Client({
      name: 'squad-federation-teams',
      version: '0.5.0',
    });

    await this.client.connect(transport);
  }

  // ── TeamsClient interface ────────────────────────────────────

  async postMessage(
    teamId: string,
    channelId: string,
    content: string,
    contentType: 'text' | 'html' = 'text'
  ): Promise<TeamsMessage> {
    const client = await this.ensureConnected();
    const result = await client.callTool({
      name: 'PostChannelMessage',
      arguments: {
        teamId,
        channelId,
        content,
        contentType,
      },
    });
    const raw = extractJsonFromResult(result as any) as Record<string, unknown>;
    return toTeamsMessage(raw);
  }

  async listMessages(
    teamId: string,
    channelId: string,
    top: number = 20
  ): Promise<TeamsMessage[]> {
    const client = await this.ensureConnected();
    const result = await client.callTool({
      name: 'ListChannelMessages',
      arguments: {
        teamId,
        channelId,
        top,
      },
    });
    const raw = extractJsonFromResult(result as any);
    const messages = Array.isArray(raw) ? raw : (raw as any).value ?? [];
    return messages.map((m: Record<string, unknown>) => toTeamsMessage(m));
  }

  async searchMessages(query: string): Promise<TeamsMessage[]> {
    const client = await this.ensureConnected();
    const result = await client.callTool({
      name: 'SearchTeamMessagesQueryParameters',
      arguments: { queryString: query },
    });
    const raw = extractJsonFromResult(result as any);
    const hits = Array.isArray(raw) ? raw : (raw as any).value ?? [];
    return hits.map((m: Record<string, unknown>) => toTeamsMessage(m));
  }

  // ── Lifecycle ────────────────────────────────────────────────

  /**
   * Gracefully disconnect and stop the server if we started it.
   */
  async dispose(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        // Ignore close errors
      }
      this.client = null;
    }

    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      this.serverProcess = null;
    }

    this.connectPromise = null;
  }
}

/**
 * Typed error for McpTeamsClient failures.
 */
export class McpTeamsClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpTeamsClientError';
  }
}
