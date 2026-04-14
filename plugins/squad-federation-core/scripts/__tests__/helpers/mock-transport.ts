/**
 * Mock placement + communication for tests without filesystem operations.
 */

import type {
  ScanStatus,
  SignalMessage,
  LearningEntry,
  TeamPlacement,
  TeamCommunication,
} from '../../../sdk/types.js';

export class MockPlacement implements TeamPlacement {
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
    if (!teamFiles) return false;
    if (teamFiles.has(filePath)) return true;

    const normalized = filePath.replace(/\/$/, '');
    if (teamFiles.has(`${normalized}/`)) return true;

    return Array.from(teamFiles.keys()).some((key) => key.startsWith(`${normalized}/`));
  }

  async stat(
    teamId: string,
    filePath: string
  ): Promise<{ isDirectory: boolean; size: number } | null> {
    const teamFiles = this.files.get(teamId);
    if (!teamFiles) return null;

    const content = teamFiles.get(filePath);
    if (content !== undefined) {
      return { isDirectory: false, size: content.length };
    }

    const normalized = filePath.replace(/\/$/, '');
    const hasChildren = Array.from(teamFiles.keys()).some((key) => key.startsWith(`${normalized}/`));
    if (hasChildren) {
      return { isDirectory: true, size: 0 };
    }

    return null;
  }

  async workspaceExists(teamId: string): Promise<boolean> {
    return this.files.has(teamId);
  }

  async getLocation(teamId: string): Promise<string> {
    return `/mock/workspace/${teamId}`;
  }

  async listFiles(teamId: string, directory?: string): Promise<string[]> {
    const teamFiles = this.files.get(teamId);
    if (!teamFiles) return [];

    const prefix = directory ? `${directory.replace(/\/$/, '')}/` : '';
    const files: string[] = [];

    for (const key of teamFiles.keys()) {
      if (!directory || key.startsWith(prefix)) {
        files.push(key);
      }
    }

    return files;
  }

  async bootstrap(teamId: string, archetypeId: string, config: Record<string, unknown>): Promise<void> {
    const now = new Date().toISOString();
    const status: ScanStatus = {
      domain: teamId,
      domain_id: teamId,
      state: 'idle',
      step: 'init',
      started_at: now,
      updated_at: now,
      archetype_id: archetypeId,
    };

    await this.writeFile(teamId, '.squad/config.json', JSON.stringify(config, null, 2));
    await this.writeFile(teamId, '.squad/status.json', JSON.stringify(status, null, 2));
    await this.writeFile(teamId, '.squad/learnings/log.jsonl', '');
    await this.writeFile(teamId, '.squad/signals/inbox/', '');
    await this.writeFile(teamId, '.squad/signals/outbox/', '');
  }

  seedTeam(teamId: string, files: Record<string, string>): void {
    const map = new Map<string, string>();
    for (const [filePath, content] of Object.entries(files)) {
      map.set(filePath, content);
    }
    this.files.set(teamId, map);
  }

  clear(): void {
    this.files.clear();
  }

  getTeams(): string[] {
    return Array.from(this.files.keys());
  }
}

export class MockCommunication implements TeamCommunication {
  constructor(private placement: MockPlacement) {}

  async readStatus(teamId: string): Promise<ScanStatus | null> {
    const content = await this.placement.readFile(teamId, '.squad/status.json');
    return content ? JSON.parse(content) : null;
  }

  async readInboxSignals(teamId: string): Promise<SignalMessage[]> {
    return this.readSignals(teamId, 'inbox');
  }

  async writeInboxSignal(teamId: string, signal: SignalMessage): Promise<void> {
    const fileName = `.squad/signals/inbox/${signal.id}.json`;
    await this.placement.writeFile(teamId, fileName, JSON.stringify(signal, null, 2));
  }

  async readOutboxSignals(teamId: string): Promise<SignalMessage[]> {
    return this.readSignals(teamId, 'outbox');
  }

  async writeOutboxSignal(teamId: string, signal: SignalMessage): Promise<void> {
    const fileName = `.squad/signals/outbox/${signal.id}.json`;
    await this.placement.writeFile(teamId, fileName, JSON.stringify(signal, null, 2));
  }

  async readLearningLog(teamId: string): Promise<LearningEntry[]> {
    const content = await this.placement.readFile(teamId, '.squad/learnings/log.jsonl');
    if (!content) return [];

    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  }

  async appendLearning(teamId: string, entry: LearningEntry): Promise<void> {
    const existing = await this.placement.readFile(teamId, '.squad/learnings/log.jsonl') || '';
    const trimmed = existing.trimEnd();
    const newContent = trimmed ? `${trimmed}\n${JSON.stringify(entry)}` : JSON.stringify(entry);
    await this.placement.writeFile(teamId, '.squad/learnings/log.jsonl', `${newContent}\n`);
  }

  async listSignals(
    teamId: string,
    direction: 'inbox' | 'outbox',
    filter?: { type?: string; since?: string; from?: string }
  ): Promise<SignalMessage[]> {
    const signals = await this.readSignals(teamId, direction);

    if (!filter) return signals;

    return signals.filter(signal => {
      if (filter.type && signal.type !== filter.type) return false;
      if (filter.from && signal.from !== filter.from) return false;
      if (filter.since && signal.timestamp < filter.since) return false;
      return true;
    });
  }

  private async readSignals(teamId: string, direction: 'inbox' | 'outbox'): Promise<SignalMessage[]> {
    const prefix = `.squad/signals/${direction}/`;
    const files = await this.placement.listFiles(teamId, prefix);
    const signals: SignalMessage[] = [];

    for (const filePath of files) {
      if (!filePath.startsWith(prefix) || !filePath.endsWith('.json')) continue;
      const content = await this.placement.readFile(teamId, filePath);
      if (content) {
        signals.push(JSON.parse(content));
      }
    }

    return signals;
  }
}
