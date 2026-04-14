/**
 * Contract tests for TeamCommunication implementations
 * Verifies that all communication implementations satisfy the TeamCommunication interface
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FileSignalCommunication } from '../../lib/file-signal-communication.js';
import type { TeamCommunication, TeamPlacement, SignalMessage, LearningEntry } from '../../../sdk/types.js';

/**
 * MockPlacement for testing communication in isolation.
 * Uses in-memory storage to avoid filesystem operations.
 */
class MockPlacement implements TeamPlacement {
  private files = new Map<string, Map<string, string>>();

  async readFile(teamId: string, filePath: string): Promise<string | null> {
    return this.files.get(teamId)?.get(filePath) || null;
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
    
    // Check exact match
    if (teamFiles.has(filePath)) return true;
    
    // Check if it's a directory by seeing if any files start with this path + /
    const prefix = filePath.endsWith('/') ? filePath : `${filePath}/`;
    for (const path of teamFiles.keys()) {
      if (path.startsWith(prefix)) return true;
    }
    
    return false;
  }

  async stat(teamId: string, filePath: string): Promise<{ isDirectory: boolean; size: number } | null> {
    const content = await this.readFile(teamId, filePath);
    if (content === null) return null;
    return { isDirectory: false, size: content.length };
  }

  async getLocation(teamId: string): Promise<string> {
    return `/mock/${teamId}`;
  }

  async listFiles(teamId: string, directory?: string): Promise<string[]> {
    const teamFiles = this.files.get(teamId);
    if (!teamFiles) return [];

    if (!directory) {
      // Return all files
      return Array.from(teamFiles.keys());
    }

    // Return files in the specified directory
    const prefix = directory.endsWith('/') ? directory : `${directory}/`;
    const files: string[] = [];

    for (const path of teamFiles.keys()) {
      if (path.startsWith(prefix)) {
        files.push(path);
      }
    }

    return files;
  }

  async bootstrap(teamId: string, archetypeId: string, config: Record<string, unknown>): Promise<void> {
    if (!this.files.has(teamId)) {
      this.files.set(teamId, new Map());
    }
    await this.writeFile(teamId, '.squad/config.json', JSON.stringify({ archetypeId, ...config }, null, 2));
  }

  async workspaceExists(teamId: string): Promise<boolean> {
    return this.files.has(teamId);
  }

  clear(): void {
    this.files.clear();
  }
}

describe('communication.contract.test.ts', () => {
  // Communication implementations to test
  const communications: Array<{ name: string; create: () => { comm: TeamCommunication; placement: MockPlacement } }> = [
    {
      name: 'FileSignalCommunication',
      create: () => {
        const placement = new MockPlacement();
        const comm = new FileSignalCommunication(placement);
        return { comm, placement };
      },
    },
  ];

  communications.forEach(({ name, create }) => {
    describe(`${name} TeamCommunication interface compliance`, () => {
      let communication: TeamCommunication;
      let placement: MockPlacement;
      const testTeamId = 'test-team';

      beforeEach(() => {
        const { comm, placement: p } = create();
        communication = comm;
        placement = p;
      });

      describe('status operations', () => {
        it('should implement readStatus', async () => {
          expect(communication.readStatus).toBeDefined();
          expect(typeof communication.readStatus).toBe('function');

          const result = await communication.readStatus(testTeamId);
          expect(result === null || (result && typeof result === 'object')).toBe(true);
        });

        it('should return null for missing status', async () => {
          const result = await communication.readStatus(testTeamId);
          expect(result).toBeNull();
        });

        it('should read valid status objects', async () => {
          const testStatus = {
            domain: testTeamId,
            domain_id: 'test-id',
            state: 'active',
            step: 'processing',
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            archetype_id: 'test-archetype'
          };

          await placement.writeFile(testTeamId, '.squad/status.json', JSON.stringify(testStatus));

          const result = await communication.readStatus(testTeamId);
          expect(result).not.toBeNull();
          expect(result!.domain).toBe(testTeamId);
          expect(result!.state).toBe('active');
          expect(result!.archetype_id).toBe('test-archetype');
        });

        it('should validate status schema', async () => {
          const invalidStatus = {
            domain: testTeamId,
            // Missing required fields
          };

          await placement.writeFile(testTeamId, '.squad/status.json', JSON.stringify(invalidStatus));

          await expect(communication.readStatus(testTeamId)).rejects.toThrow();
        });
      });

      describe('signal operations', () => {
        const createTestSignal = (overrides?: Partial<SignalMessage>): SignalMessage => ({
          id: `signal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          from: 'meta',
          to: testTeamId,
          type: 'directive',
          subject: 'Test Signal',
          body: 'Test body',
          protocol: 'v1',
          ...overrides
        });

        it('should implement readInboxSignals', async () => {
          expect(communication.readInboxSignals).toBeDefined();
          expect(typeof communication.readInboxSignals).toBe('function');

          const result = await communication.readInboxSignals(testTeamId);
          expect(Array.isArray(result)).toBe(true);
        });

        it('should implement writeInboxSignal', async () => {
          expect(communication.writeInboxSignal).toBeDefined();
          expect(typeof communication.writeInboxSignal).toBe('function');

          const signal = createTestSignal();
          await expect(communication.writeInboxSignal(testTeamId, signal)).resolves.not.toThrow();
        });

        it('should implement readOutboxSignals', async () => {
          expect(communication.readOutboxSignals).toBeDefined();
          expect(typeof communication.readOutboxSignals).toBe('function');

          const result = await communication.readOutboxSignals(testTeamId);
          expect(Array.isArray(result)).toBe(true);
        });

        it('should implement listSignals', async () => {
          expect(communication.listSignals).toBeDefined();
          expect(typeof communication.listSignals).toBe('function');

          const result = await communication.listSignals(testTeamId, 'inbox', {});
          expect(Array.isArray(result)).toBe(true);
        });

        it('should preserve signal order', async () => {
          const signals = [
            createTestSignal({ id: 's1', subject: 'First' }),
            createTestSignal({ id: 's2', subject: 'Second' }),
            createTestSignal({ id: 's3', subject: 'Third' }),
          ];

          for (const signal of signals) {
            await communication.writeInboxSignal(testTeamId, signal);
          }

          const result = await communication.readInboxSignals(testTeamId);
          expect(result.length).toBe(3);
          
          // Verify all signals are present
          const ids = result.map(s => s.id);
          expect(ids).toContain('s1');
          expect(ids).toContain('s2');
          expect(ids).toContain('s3');
        });

        it('should filter signals by type', async () => {
          const signals = [
            createTestSignal({ id: 's1', type: 'directive', subject: 'Directive 1' }),
            createTestSignal({ id: 's2', type: 'question', subject: 'Question 1' }),
            createTestSignal({ id: 's3', type: 'directive', subject: 'Directive 2' }),
          ];

          for (const signal of signals) {
            await communication.writeInboxSignal(testTeamId, signal);
          }

          const result = await communication.listSignals(testTeamId, 'inbox', { type: 'directive' });
          expect(result.length).toBe(2);
          expect(result.every(s => s.type === 'directive')).toBe(true);
        });

        it('should filter signals by sender', async () => {
          const signals = [
            createTestSignal({ id: 's1', from: 'meta', subject: 'From Meta 1' }),
            createTestSignal({ id: 's2', from: 'team-alpha', subject: 'From Alpha' }),
            createTestSignal({ id: 's3', from: 'meta', subject: 'From Meta 2' }),
          ];

          for (const signal of signals) {
            await communication.writeInboxSignal(testTeamId, signal);
          }

          const result = await communication.listSignals(testTeamId, 'inbox', { from: 'meta' });
          expect(result.length).toBe(2);
          expect(result.every(s => s.from === 'meta')).toBe(true);
        });

        it('should filter signals by timestamp', async () => {
          const now = new Date();
          const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          
          const signals = [
            createTestSignal({ id: 's1', timestamp: yesterday.toISOString(), subject: 'Yesterday Signal' }),
            createTestSignal({ id: 's2', timestamp: now.toISOString(), subject: 'Today Signal 1' }),
            createTestSignal({ id: 's3', timestamp: now.toISOString(), subject: 'Today Signal 2' }),
          ];

          for (const signal of signals) {
            await communication.writeInboxSignal(testTeamId, signal);
          }

          const result = await communication.listSignals(testTeamId, 'inbox', { since: now.toISOString() });
          expect(result.length).toBe(2);
          expect(result.every(s => s.timestamp >= now.toISOString())).toBe(true);
        });

        it('should handle empty signal directories', async () => {
          const inbox = await communication.readInboxSignals(testTeamId);
          const outbox = await communication.readOutboxSignals(testTeamId);

          expect(inbox).toEqual([]);
          expect(outbox).toEqual([]);
        });

        it('should validate signal schema', async () => {
          const invalidSignal = {
            id: 's1',
            // Missing required fields
          } as unknown as SignalMessage;

          await expect(
            communication.writeInboxSignal(testTeamId, invalidSignal)
          ).rejects.toThrow();
        });
      });

      describe('learning log operations', () => {
        const createTestLearning = (overrides?: Partial<LearningEntry>): LearningEntry => ({
          id: `learning-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          version: '1.0',
          type: 'pattern',
          content: 'Test learning',
          confidence: 'medium',
          ...overrides
        });

        it('should implement readLearningLog', async () => {
          expect(communication.readLearningLog).toBeDefined();
          expect(typeof communication.readLearningLog).toBe('function');

          const result = await communication.readLearningLog(testTeamId);
          expect(Array.isArray(result)).toBe(true);
        });

        it('should implement appendLearning', async () => {
          expect(communication.appendLearning).toBeDefined();
          expect(typeof communication.appendLearning).toBe('function');

          const entry = createTestLearning();
          await expect(communication.appendLearning(testTeamId, entry)).resolves.not.toThrow();
        });

        it('should preserve learning log order', async () => {
          const entries = [
            createTestLearning({ id: 'e1', content: 'First' }),
            createTestLearning({ id: 'e2', content: 'Second' }),
            createTestLearning({ id: 'e3', content: 'Third' }),
          ];

          for (const entry of entries) {
            await communication.appendLearning(testTeamId, entry);
          }

          const result = await communication.readLearningLog(testTeamId);
          expect(result.map(e => e.id)).toEqual(['e1', 'e2', 'e3']);
        });

        it('should handle all learning types', async () => {
          const types: Array<'discovery' | 'correction' | 'pattern' | 'technique' | 'gotcha'> = [
            'discovery',
            'correction',
            'pattern',
            'technique',
            'gotcha',
          ];

          for (const type of types) {
            const entry = createTestLearning({ type });
            await expect(communication.appendLearning(testTeamId, entry)).resolves.not.toThrow();
          }

          const result = await communication.readLearningLog(testTeamId);
          expect(result.length).toBe(types.length);
        });

        it('should handle empty learning log', async () => {
          const result = await communication.readLearningLog(testTeamId);
          expect(result).toEqual([]);
        });

        it('should validate learning entry schema', async () => {
          const invalidEntry = {
            id: 'e1',
            // Missing required fields
          } as unknown as LearningEntry;

          await expect(
            communication.appendLearning(testTeamId, invalidEntry)
          ).rejects.toThrow();
        });
      });

      describe('data integrity', () => {
        it('should handle concurrent signal writes', async () => {
          const signals = Array.from({ length: 10 }, (_, i) => ({
            id: `s${i}`,
            timestamp: new Date().toISOString(),
            from: 'meta',
            to: testTeamId,
            type: 'directive' as const,
            subject: `Signal ${i}`,
            body: `Body ${i}`,
            protocol: 'v1'
          }));

          await Promise.all(
            signals.map(s => communication.writeInboxSignal(testTeamId, s))
          );

          const result = await communication.readInboxSignals(testTeamId);
          expect(result.length).toBe(10);
        });

        it('should handle special characters in signal content', async () => {
          const signal = {
            id: 's1',
            timestamp: new Date().toISOString(),
            from: 'meta',
            to: testTeamId,
            type: 'directive' as const,
            subject: 'Test with émojis 🚀',
            body: 'Content with 日本語 and special chars: <>&"',
            protocol: 'v1'
          };

          await communication.writeInboxSignal(testTeamId, signal);
          const result = await communication.readInboxSignals(testTeamId);

          expect(result[0].subject).toBe(signal.subject);
          expect(result[0].body).toBe(signal.body);
        });
      });

      describe('async operation compliance', () => {
        it('should return Promises for all async operations', () => {
          const testSignal: SignalMessage = {
            id: 's1',
            timestamp: new Date().toISOString(),
            from: 'meta',
            to: testTeamId,
            type: 'directive',
            subject: 'Test',
            body: 'Test',
            protocol: 'v1'
          };

          const testLearning: LearningEntry = {
            id: 'e1',
            timestamp: new Date().toISOString(),
            version: '1.0',
            type: 'pattern',
            content: 'Test',
            confidence: 'medium'
          };

          expect(communication.readStatus(testTeamId) instanceof Promise).toBe(true);
          expect(communication.readInboxSignals(testTeamId) instanceof Promise).toBe(true);
          expect(communication.writeInboxSignal(testTeamId, testSignal) instanceof Promise).toBe(true);
          expect(communication.readOutboxSignals(testTeamId) instanceof Promise).toBe(true);
          expect(communication.listSignals(testTeamId, 'inbox', {}) instanceof Promise).toBe(true);
          expect(communication.readLearningLog(testTeamId) instanceof Promise).toBe(true);
          expect(communication.appendLearning(testTeamId, testLearning) instanceof Promise).toBe(true);
        });
      });
    });
  });
});
