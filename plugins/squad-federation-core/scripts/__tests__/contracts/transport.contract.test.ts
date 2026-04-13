/**
 * Contract tests for TeamTransport implementations
 * Verifies that all transport implementations satisfy the TeamTransport interface
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockTransport } from '../helpers/mock-transport.js';
import { createTestSignal, createTestStatus, createTestLearning } from '../helpers/test-fixtures.js';
import type { TeamTransport } from '../../../sdk/types.js';

// Transport implementations to test
const transports: Array<{ name: string; create: () => TeamTransport }> = [
  {
    name: 'MockTransport',
    create: () => new MockTransport(),
  },
  // DirectoryTransport and WorktreeTransport would be added here in production
  // but require filesystem/git setup which is better suited for integration tests
];

describe('transport.contract.test.ts', () => {
  transports.forEach(({ name, create }) => {
    describe(`${name} TeamTransport interface compliance`, () => {
      let transport: TeamTransport;

      beforeEach(() => {
        transport = create();
      });

      describe('file operations', () => {
        it('should implement readFile', async () => {
          expect(transport.readFile).toBeDefined();
          expect(typeof transport.readFile).toBe('function');

          // Mock setup for test
          if ('writeFile' in transport) {
            await transport.writeFile('test-team', 'test.txt', 'content');
          }

          const result = await transport.readFile('test-team', 'test.txt');
          expect(typeof result === 'string' || result === null).toBe(true);
        });

        it('should implement writeFile', async () => {
          expect(transport.writeFile).toBeDefined();
          expect(typeof transport.writeFile).toBe('function');

          await expect(transport.writeFile('test-team', 'test.txt', 'content')).resolves.not.toThrow();
        });

        it('should implement exists', async () => {
          expect(transport.exists).toBeDefined();
          expect(typeof transport.exists).toBe('function');

          const result = await transport.exists('test-team', 'test.txt');
          expect(typeof result).toBe('boolean');
        });

        it('should implement stat (optional)', async () => {
          // stat is optional in TeamTransport
          if (transport.stat) {
            expect(typeof transport.stat).toBe('function');

            const result = await transport.stat('test-team', 'test.txt');
            expect(result === null || (result && typeof result === 'object')).toBe(true);

            if (result) {
              expect(result).toHaveProperty('isDirectory');
              expect(typeof result.isDirectory).toBe('boolean');
            }
          }
        });
      });

      describe('status operations', () => {
        it('should implement readStatus', async () => {
          expect(transport.readStatus).toBeDefined();
          expect(typeof transport.readStatus).toBe('function');

          const result = await transport.readStatus('test-team');
          expect(result === null || (result && typeof result === 'object')).toBe(true);
        });

        it('should read valid status objects', async () => {
          const testStatus = createTestStatus({ domain: 'test-team' });

          if ('writeFile' in transport) {
            await transport.writeFile('test-team', '.squad/status.json', JSON.stringify(testStatus));
          }

          const result = await transport.readStatus('test-team');
          if (result) {
            expect(result).toHaveProperty('domain');
            expect(result).toHaveProperty('state');
            expect(result).toHaveProperty('updated_at');
          }
        });
      });

      describe('signal operations', () => {
        it('should implement readInboxSignals', async () => {
          expect(transport.readInboxSignals).toBeDefined();
          expect(typeof transport.readInboxSignals).toBe('function');

          const result = await transport.readInboxSignals('test-team');
          expect(Array.isArray(result)).toBe(true);
        });

        it('should implement writeInboxSignal', async () => {
          expect(transport.writeInboxSignal).toBeDefined();
          expect(typeof transport.writeInboxSignal).toBe('function');

          const signal = createTestSignal();
          await expect(transport.writeInboxSignal('test-team', signal)).resolves.not.toThrow();
        });

        it('should implement readOutboxSignals', async () => {
          expect(transport.readOutboxSignals).toBeDefined();
          expect(typeof transport.readOutboxSignals).toBe('function');

          const result = await transport.readOutboxSignals('test-team');
          expect(Array.isArray(result)).toBe(true);
        });

        it('should implement writeOutboxSignal', async () => {
          expect(transport.writeOutboxSignal).toBeDefined();
          expect(typeof transport.writeOutboxSignal).toBe('function');

          const signal = createTestSignal();
          await expect(transport.writeOutboxSignal('test-team', signal)).resolves.not.toThrow();
        });

        it('should implement listSignals', async () => {
          expect(transport.listSignals).toBeDefined();
          expect(typeof transport.listSignals).toBe('function');

          const result = await transport.listSignals('test-team', 'inbox', {});
          expect(Array.isArray(result)).toBe(true);
        });
      });

      describe('learning log operations', () => {
        it('should implement readLearningLog', async () => {
          expect(transport.readLearningLog).toBeDefined();
          expect(typeof transport.readLearningLog).toBe('function');

          const result = await transport.readLearningLog('test-team');
          expect(Array.isArray(result)).toBe(true);
        });

        it('should implement appendLearning', async () => {
          expect(transport.appendLearning).toBeDefined();
          expect(typeof transport.appendLearning).toBe('function');

          const entry = createTestLearning();
          await expect(transport.appendLearning('test-team', entry)).resolves.not.toThrow();
        });

        it('should handle learning entry types', async () => {
          const types: Array<'discovery' | 'correction' | 'pattern' | 'technique' | 'gotcha'> = [
            'discovery',
            'correction',
            'pattern',
            'technique',
            'gotcha',
          ];

          for (const type of types) {
            const entry = createTestLearning({ type });
            await expect(transport.appendLearning('test-team', entry)).resolves.not.toThrow();
          }
        });
      });

      describe('workspace operations', () => {
        it('should implement workspaceExists', async () => {
          expect(transport.workspaceExists).toBeDefined();
          expect(typeof transport.workspaceExists).toBe('function');

          const result = await transport.workspaceExists('test-team');
          expect(typeof result).toBe('boolean');
        });

        it('should implement getLocation', async () => {
          expect(transport.getLocation).toBeDefined();
          expect(typeof transport.getLocation).toBe('function');

          const result = await transport.getLocation('test-team');
          expect(typeof result).toBe('string');
          expect(result.length).toBeGreaterThan(0);
        });

        it('should implement listFiles', async () => {
          expect(transport.listFiles).toBeDefined();
          expect(typeof transport.listFiles).toBe('function');

          const result = await transport.listFiles('test-team');
          expect(Array.isArray(result)).toBe(true);
        });

        it('should implement bootstrap', async () => {
          expect(transport.bootstrap).toBeDefined();
          expect(typeof transport.bootstrap).toBe('function');

          await expect(
            transport.bootstrap('test-team', 'deliverable', { owner: 'test-user' })
          ).resolves.not.toThrow();
        });
      });

      describe('data integrity', () => {
        it('should isolate team workspaces', async () => {
          if (!('writeFile' in transport)) return;

          await transport.writeFile('team-a', 'file.txt', 'content-a');
          await transport.writeFile('team-b', 'file.txt', 'content-b');

          const contentA = await transport.readFile('team-a', 'file.txt');
          const contentB = await transport.readFile('team-b', 'file.txt');

          expect(contentA).toBe('content-a');
          expect(contentB).toBe('content-b');
        });

        it('should preserve signal order', async () => {
          const signals = [
            createTestSignal({ id: 's1' }),
            createTestSignal({ id: 's2' }),
            createTestSignal({ id: 's3' }),
          ];

          for (const signal of signals) {
            await transport.writeInboxSignal('test-team', signal);
          }

          const result = await transport.readInboxSignals('test-team');
          expect(result.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
        });

        it('should preserve learning log order', async () => {
          const entries = [
            createTestLearning({ id: 'e1' }),
            createTestLearning({ id: 'e2' }),
            createTestLearning({ id: 'e3' }),
          ];

          for (const entry of entries) {
            await transport.appendLearning('test-team', entry);
          }

          const result = await transport.readLearningLog('test-team');
          expect(result.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
        });
      });

      describe('error handling', () => {
        it('should return null for non-existent files', async () => {
          const result = await transport.readFile('test-team', 'nonexistent.txt');
          expect(result).toBeNull();
        });

        it('should return false for non-existent workspace', async () => {
          const result = await transport.workspaceExists('nonexistent-team');
          expect(result).toBe(false);
        });

        it('should return empty arrays for missing signals', async () => {
          const inbox = await transport.readInboxSignals('new-team');
          const outbox = await transport.readOutboxSignals('new-team');

          expect(inbox).toEqual([]);
          expect(outbox).toEqual([]);
        });

        it('should return empty array for missing learning log', async () => {
          const result = await transport.readLearningLog('new-team');
          expect(result).toEqual([]);
        });

        it('should return null for missing status', async () => {
          const result = await transport.readStatus('new-team');
          expect(result).toBeNull();
        });
      });

      describe('async operation compliance', () => {
        it('should return Promises for all async operations', () => {
          expect(transport.readFile('test', 'file') instanceof Promise).toBe(true);
          expect(transport.writeFile('test', 'file', 'data') instanceof Promise).toBe(true);
          expect(transport.exists('test', 'file') instanceof Promise).toBe(true);
          expect(transport.readStatus('test') instanceof Promise).toBe(true);
          expect(transport.readInboxSignals('test') instanceof Promise).toBe(true);
          expect(transport.writeInboxSignal('test', createTestSignal()) instanceof Promise).toBe(true);
          expect(transport.readOutboxSignals('test') instanceof Promise).toBe(true);
          expect(transport.writeOutboxSignal('test', createTestSignal()) instanceof Promise).toBe(true);
          expect(transport.listSignals('test', 'inbox', {}) instanceof Promise).toBe(true);
          expect(transport.readLearningLog('test') instanceof Promise).toBe(true);
          expect(transport.appendLearning('test', createTestLearning()) instanceof Promise).toBe(true);
          expect(transport.workspaceExists('test') instanceof Promise).toBe(true);
          expect(transport.getLocation('test') instanceof Promise).toBe(true);
          expect(transport.listFiles('test') instanceof Promise).toBe(true);
          expect(transport.bootstrap('test', 'deliverable', {}) instanceof Promise).toBe(true);
        });
      });
    });
  });
});
