/**
 * Mock Transport for testing without filesystem operations.
 * Implements the TeamTransport interface from DESIGN.md spec.
 */

// Temporary types until SDK is created in #27
export interface ScanStatus {
  domain: string;
  state: 'idle' | 'scanning' | 'waiting' | 'blocked' | 'done';
  updated_at: string;
  message?: string;
}

export interface SignalMessage {
  id: string;
  from: string;
  to: string;
  type: 'directive' | 'ack' | 'report' | 'query';
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface LearningEntry {
  id: string;
  timestamp: string;
  domain: string;
  category: string;
  content: string;
  tags?: string[];
}

/**
 * TeamTransport interface from DESIGN.md Section 2.3.1
 * Mock implementation using in-memory storage
 */
export interface TeamTransport {
  readFile(teamId: string, filePath: string): Promise<string | null>;
  writeFile(teamId: string, filePath: string, content: string): Promise<void>;
  exists(teamId: string, filePath: string): Promise<boolean>;
  stat?(teamId: string, filePath: string): Promise<{ isDirectory: boolean; size: number } | null>;
  readStatus(teamId: string): Promise<ScanStatus | null>;
  readInboxSignals(teamId: string): Promise<SignalMessage[]>;
  writeInboxSignal(teamId: string, signal: SignalMessage): Promise<void>;
  readOutboxSignals(teamId: string): Promise<SignalMessage[]>;
  readLearningLog(teamId: string): Promise<LearningEntry[]>;
  appendLearning(teamId: string, entry: LearningEntry): Promise<void>;
  listSignals(
    teamId: string,
    direction: 'inbox' | 'outbox',
    filter?: { type?: string; from?: string; to?: string }
  ): Promise<SignalMessage[]>;
}

/**
 * MockTransport — In-memory transport for testing without filesystem.
 * 
 * Usage:
 * ```typescript
 * const transport = new MockTransport();
 * transport.seedTeam('team-alpha', {
 *   '.squad/status.json': JSON.stringify({ domain: 'team-alpha', state: 'scanning', ... })
 * });
 * ```
 */
export class MockTransport implements TeamTransport {
  private files: Map<string, Map<string, string>> = new Map();
  
  async readFile(teamId: string, filePath: string): Promise<string | null> {
    const teamFiles = this.files.get(teamId);
    return teamFiles?.get(filePath) || null;
  }
  
  async writeFile(teamId: string, filePath: string, content: string): Promise<void> {
    if (!this.files.has(teamId)) {
      this.files.set(teamId, new Map());
    }
    this.files.get(teamId)!.set(filePath, content);
  }
  
  async exists(teamId: string, filePath: string): Promise<boolean> {
    const teamFiles = this.files.get(teamId);
    return teamFiles?.has(filePath) || false;
  }
  
  async stat(teamId: string, filePath: string): Promise<{ isDirectory: boolean; size: number } | null> {
    const content = await this.readFile(teamId, filePath);
    if (content === null) return null;
    
    // Simple heuristic: directories end with '/'
    const isDirectory = filePath.endsWith('/');
    const size = isDirectory ? 0 : content.length;
    
    return { isDirectory, size };
  }
  
  async readStatus(teamId: string): Promise<ScanStatus | null> {
    const content = await this.readFile(teamId, '.squad/status.json');
    return content ? JSON.parse(content) : null;
  }
  
  async readInboxSignals(teamId: string): Promise<SignalMessage[]> {
    return this.readSignals(teamId, 'inbox');
  }
  
  async writeInboxSignal(teamId: string, signal: SignalMessage): Promise<void> {
    const fileName = `.squad/inbox/${signal.id}.json`;
    await this.writeFile(teamId, fileName, JSON.stringify(signal, null, 2));
  }
  
  async readOutboxSignals(teamId: string): Promise<SignalMessage[]> {
    return this.readSignals(teamId, 'outbox');
  }
  
  async readLearningLog(teamId: string): Promise<LearningEntry[]> {
    const content = await this.readFile(teamId, '.squad/learning.jsonl');
    if (!content) return [];
    
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  }
  
  async appendLearning(teamId: string, entry: LearningEntry): Promise<void> {
    const existing = await this.readFile(teamId, '.squad/learning.jsonl') || '';
    const newContent = existing + JSON.stringify(entry) + '\n';
    await this.writeFile(teamId, '.squad/learning.jsonl', newContent);
  }
  
  async listSignals(
    teamId: string,
    direction: 'inbox' | 'outbox',
    filter?: { type?: string; from?: string; to?: string }
  ): Promise<SignalMessage[]> {
    const signals = await this.readSignals(teamId, direction);
    
    if (!filter) return signals;
    
    return signals.filter(signal => {
      if (filter.type && signal.type !== filter.type) return false;
      if (filter.from && signal.from !== filter.from) return false;
      if (filter.to && signal.to !== filter.to) return false;
      return true;
    });
  }
  
  /**
   * Test helper: seed a team with files.
   * 
   * @param teamId - Team identifier
   * @param files - Map of file paths to contents
   */
  seedTeam(teamId: string, files: Record<string, string>): void {
    this.files.set(teamId, new Map(Object.entries(files)));
  }
  
  /**
   * Test helper: clear all data.
   */
  clear(): void {
    this.files.clear();
  }
  
  /**
   * Test helper: get all teams.
   */
  getTeams(): string[] {
    return Array.from(this.files.keys());
  }
  
  // Private helper to read signals from inbox or outbox
  private async readSignals(teamId: string, direction: 'inbox' | 'outbox'): Promise<SignalMessage[]> {
    const teamFiles = this.files.get(teamId);
    if (!teamFiles) return [];
    
    const signals: SignalMessage[] = [];
    const prefix = `.squad/${direction}/`;
    
    for (const [path, content] of teamFiles.entries()) {
      if (path.startsWith(prefix) && path.endsWith('.json')) {
        try {
          signals.push(JSON.parse(content));
        } catch (error) {
          // Skip invalid JSON
          console.warn(`Failed to parse signal at ${path}:`, error);
        }
      }
    }
    
    return signals;
  }
}
