/**
 * MockCommunication - in-memory TeamCommunication for testing
 * Provides fast, isolated communication implementation without delegation to placement
 */

import type { TeamCommunication, ScanStatus, SignalMessage, LearningEntry } from '../../../sdk/types.js';

interface TeamData {
  status: ScanStatus | null;
  inboxSignals: SignalMessage[];
  outboxSignals: SignalMessage[];
  learningLog: LearningEntry[];
}

/**
 * In-memory implementation of TeamCommunication for testing.
 * Uses Map storage to simulate signal/status/learning operations.
 */
export class MockCommunication implements TeamCommunication {
  private teams = new Map<string, TeamData>();

  private getOrCreateTeam(teamId: string): TeamData {
    if (!this.teams.has(teamId)) {
      this.teams.set(teamId, {
        status: null,
        inboxSignals: [],
        outboxSignals: [],
        learningLog: []
      });
    }
    return this.teams.get(teamId)!;
  }

  async readStatus(teamId: string): Promise<ScanStatus | null> {
    return this.getOrCreateTeam(teamId).status;
  }

  async readInboxSignals(teamId: string): Promise<SignalMessage[]> {
    return [...this.getOrCreateTeam(teamId).inboxSignals];
  }

  async writeInboxSignal(teamId: string, signal: SignalMessage): Promise<void> {
    this.getOrCreateTeam(teamId).inboxSignals.push(signal);
  }

  async readOutboxSignals(teamId: string): Promise<SignalMessage[]> {
    return [...this.getOrCreateTeam(teamId).outboxSignals];
  }

  async writeOutboxSignal(teamId: string, signal: SignalMessage): Promise<void> {
    this.getOrCreateTeam(teamId).outboxSignals.push(signal);
  }

  async listSignals(
    teamId: string,
    box: 'inbox' | 'outbox',
    filters: {
      type?: string;
      from?: string;
      to?: string;
      since?: string;
    } = {}
  ): Promise<SignalMessage[]> {
    const signals = box === 'inbox'
      ? this.getOrCreateTeam(teamId).inboxSignals
      : this.getOrCreateTeam(teamId).outboxSignals;

    let filtered = [...signals];

    if (filters.type) {
      filtered = filtered.filter(s => s.type === filters.type);
    }

    if (filters.from) {
      filtered = filtered.filter(s => s.from === filters.from);
    }

    if (filters.to) {
      filtered = filtered.filter(s => s.to === filters.to);
    }

    if (filters.since) {
      filtered = filtered.filter(s => s.timestamp >= filters.since!);
    }

    return filtered;
  }

  async readLearningLog(teamId: string): Promise<LearningEntry[]> {
    return [...this.getOrCreateTeam(teamId).learningLog];
  }

  async appendLearning(teamId: string, entry: LearningEntry): Promise<void> {
    this.getOrCreateTeam(teamId).learningLog.push(entry);
  }

  // Test helpers

  /**
   * Read a file-like representation for testing raw format.
   * Maps inbox signals to .squad/inbox.jsonl format.
   */
  async readFile(teamId: string, filePath: string): Promise<string | null> {
    const team = this.teams.get(teamId);
    if (!team) return null;

    if (filePath === '.squad/inbox.jsonl') {
      if (team.inboxSignals.length === 0) return null;
      return team.inboxSignals.map(s => JSON.stringify(s)).join('\n');
    }
    if (filePath === '.squad/outbox.jsonl') {
      if (team.outboxSignals.length === 0) return null;
      return team.outboxSignals.map(s => JSON.stringify(s)).join('\n');
    }
    if (filePath === '.squad/learning.jsonl') {
      if (team.learningLog.length === 0) return null;
      return team.learningLog.map(e => JSON.stringify(e)).join('\n');
    }
    return null;
  }

  /**
   * Seed status for a team
   */
  seedStatus(teamId: string, status: ScanStatus): void {
    this.getOrCreateTeam(teamId).status = status;
  }

  /**
   * Seed inbox signals for a team
   */
  seedInboxSignals(teamId: string, signals: SignalMessage[]): void {
    const team = this.getOrCreateTeam(teamId);
    team.inboxSignals.push(...signals);
  }

  /**
   * Seed outbox signals for a team
   */
  seedOutboxSignals(teamId: string, signals: SignalMessage[]): void {
    const team = this.getOrCreateTeam(teamId);
    team.outboxSignals.push(...signals);
  }

  /**
   * Seed learning log entries for a team
   */
  seedLearningLog(teamId: string, entries: LearningEntry[]): void {
    const team = this.getOrCreateTeam(teamId);
    team.learningLog.push(...entries);
  }

  /**
   * Clear all teams and data
   */
  clear(): void {
    this.teams.clear();
  }

  /**
   * Get list of all team IDs
   */
  getTeams(): string[] {
    return Array.from(this.teams.keys());
  }

  /**
   * Get all data for a team (for debugging)
   */
  getTeamData(teamId: string): TeamData | null {
    return this.teams.get(teamId) || null;
  }

  /**
   * Seed a team with complete communication data
   */
  seedCompleteTeam(
    teamId: string,
    data: {
      status?: ScanStatus;
      inboxSignals?: SignalMessage[];
      outboxSignals?: SignalMessage[];
      learningLog?: LearningEntry[];
    }
  ): void {
    const team = this.getOrCreateTeam(teamId);
    
    if (data.status) {
      team.status = data.status;
    }
    
    if (data.inboxSignals) {
      team.inboxSignals.push(...data.inboxSignals);
    }
    
    if (data.outboxSignals) {
      team.outboxSignals.push(...data.outboxSignals);
    }
    
    if (data.learningLog) {
      team.learningLog.push(...data.learningLog);
    }
  }

  /**
   * Count signals in inbox/outbox
   */
  countSignals(teamId: string, box: 'inbox' | 'outbox'): number {
    const team = this.teams.get(teamId);
    if (!team) return 0;
    
    return box === 'inbox'
      ? team.inboxSignals.length
      : team.outboxSignals.length;
  }

  /**
   * Count learning log entries
   */
  countLearningEntries(teamId: string): number {
    const team = this.teams.get(teamId);
    return team?.learningLog.length || 0;
  }

  /**
   * Clear only signals (keep status and learning log)
   */
  clearSignals(teamId: string): void {
    const team = this.teams.get(teamId);
    if (team) {
      team.inboxSignals = [];
      team.outboxSignals = [];
    }
  }

  /**
   * Clear only learning log (keep status and signals)
   */
  clearLearningLog(teamId: string): void {
    const team = this.teams.get(teamId);
    if (team) {
      team.learningLog = [];
    }
  }
}

/**
 * Create a MockCommunication instance for testing
 */
export function createMockCommunication(): MockCommunication {
  return new MockCommunication();
}
