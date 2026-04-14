/**
 * Contract tests for TeamPlacement and TeamCommunication implementations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockPlacement, MockCommunication } from '../helpers/mock-transport.js';
import { createTestSignal, createTestStatus, createTestLearning } from '../helpers/test-fixtures.js';
import type { TeamPlacement, TeamCommunication } from '../../../sdk/types.js';

const placements: Array<{ name: string; create: () => TeamPlacement }> = [
  {
    name: 'MockPlacement',
    create: () => new MockPlacement(),
  },
];

const communications: Array<{ name: string; create: (placement: MockPlacement) => TeamCommunication }> = [
  {
    name: 'MockCommunication',
    create: (placement) => new MockCommunication(placement),
  },
];

describe('placement + communication contract', () => {
  placements.forEach(({ name, create }) => {
    describe(`${name} TeamPlacement compliance`, () => {
      let placement: TeamPlacement;

      beforeEach(() => {
        placement = create();
      });

      it('should implement readFile/writeFile', async () => {
        await placement.writeFile('test-team', 'test.txt', 'content');
        const result = await placement.readFile('test-team', 'test.txt');
        expect(result).toBe('content');
      });

      it('should implement exists', async () => {
        const result = await placement.exists('test-team', 'test.txt');
        expect(typeof result).toBe('boolean');
      });

      it('should implement stat', async () => {
        const result = await placement.stat?.('test-team', 'test.txt');
        expect(result === null || (result && typeof result === 'object')).toBe(true);
      });

      it('should implement workspace helpers', async () => {
        expect(typeof (await placement.workspaceExists('test-team'))).toBe('boolean');
        expect(typeof (await placement.getLocation('test-team'))).toBe('string');
        expect(Array.isArray(await placement.listFiles('test-team'))).toBe(true);
      });
    });
  });

  communications.forEach(({ name, create }) => {
    describe(`${name} TeamCommunication compliance`, () => {
      let placement: MockPlacement;
      let communication: TeamCommunication;

      beforeEach(() => {
        placement = new MockPlacement();
        communication = create(placement);
      });

      it('should implement readStatus', async () => {
        const status = createTestStatus({ domain: 'test-team' });
        await placement.writeFile('test-team', '.squad/status.json', JSON.stringify(status));

        const result = await communication.readStatus('test-team');
        expect(result?.domain).toBe('test-team');
      });

      it('should implement signal operations', async () => {
        const signal = createTestSignal({ to: 'test-team' });
        await communication.writeInboxSignal('test-team', signal);

        const inbox = await communication.readInboxSignals('test-team');
        expect(Array.isArray(inbox)).toBe(true);
      });

      it('should implement learning log operations', async () => {
        const entry = createTestLearning();
        await communication.appendLearning('test-team', entry);

        const entries = await communication.readLearningLog('test-team');
        expect(Array.isArray(entries)).toBe(true);
      });
    });
  });
});
