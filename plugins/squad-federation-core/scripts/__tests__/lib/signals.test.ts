/**
 * Unit tests for file-signal-communication.ts — signal messaging operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FileSignalCommunication } from '../../lib/file-signal-communication.js';
import { MockPlacement } from '../helpers/mock-transport.js';
import { createTestSignal, createTestStatus, createTestLearning } from '../helpers/test-fixtures.js';

describe('file-signal-communication.ts', () => {
  let placement: MockPlacement;
  let communication: FileSignalCommunication;

  beforeEach(() => {
    placement = new MockPlacement();
    communication = new FileSignalCommunication(placement);
  });

  it('should read status from .squad/status.json', async () => {
    const status = createTestStatus({ domain: 'team-alpha', state: 'scanning' });
    await placement.writeFile('team-alpha', '.squad/status.json', JSON.stringify(status));

    const result = await communication.readStatus('team-alpha');
    expect(result).toEqual(status);
  });

  it('should write and read inbox signals', async () => {
    const signal = createTestSignal({ to: 'team-alpha' });

    await communication.writeInboxSignal('team-alpha', signal);
    const signals = await communication.readInboxSignals('team-alpha');

    expect(signals).toHaveLength(1);
    expect(signals[0]).toEqual(signal);
  });

  it('should write and read outbox signals', async () => {
    const signal = createTestSignal({ from: 'team-alpha' });

    await communication.writeOutboxSignal('team-alpha', signal);
    const signals = await communication.readOutboxSignals('team-alpha');

    expect(signals).toHaveLength(1);
    expect(signals[0]).toEqual(signal);
  });

  it('should filter signals by type', async () => {
    await communication.writeInboxSignal('team-alpha', createTestSignal({ type: 'directive' }));
    await communication.writeInboxSignal('team-alpha', createTestSignal({ type: 'report' }));

    const directives = await communication.listSignals('team-alpha', 'inbox', { type: 'directive' });
    expect(directives).toHaveLength(1);
    expect(directives[0].type).toBe('directive');
  });

  it('should append and read learning entries', async () => {
    const entry1 = createTestLearning({ content: 'First learning' });
    const entry2 = createTestLearning({ content: 'Second learning' });

    await communication.appendLearning('team-alpha', entry1);
    await communication.appendLearning('team-alpha', entry2);

    const entries = await communication.readLearningLog('team-alpha');
    expect(entries).toHaveLength(2);
    expect(entries[0].content).toBe('First learning');
  });
});
