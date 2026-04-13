/**
 * Unit tests for signals.ts — signal messaging operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockTransport } from '../helpers/mock-transport.js';
import { createTestSignal, signalBodies } from '../helpers/test-fixtures.js';

describe('signals.ts', () => {
  let transport: MockTransport;

  beforeEach(() => {
    transport = new MockTransport();
  });

  describe('inbox signal operations', () => {
    it('should write signal to inbox', async () => {
      const signal = createTestSignal({ to: 'team-alpha' });

      await transport.writeInboxSignal('team-alpha', signal);
      const signals = await transport.readInboxSignals('team-alpha');

      expect(signals).toHaveLength(1);
      expect(signals[0]).toEqual(signal);
    });

    it('should read all inbox signals', async () => {
      const signals = [
        createTestSignal({ id: 'signal-1' }),
        createTestSignal({ id: 'signal-2' }),
        createTestSignal({ id: 'signal-3' }),
      ];

      for (const signal of signals) {
        await transport.writeInboxSignal('team-alpha', signal);
      }

      const result = await transport.readInboxSignals('team-alpha');
      expect(result).toHaveLength(3);
    });

    it('should return empty array for empty inbox', async () => {
      const signals = await transport.readInboxSignals('team-alpha');
      expect(signals).toEqual([]);
    });

    it('should preserve signal order', async () => {
      const ids = ['signal-1', 'signal-2', 'signal-3'];
      for (const id of ids) {
        await transport.writeInboxSignal('team-alpha', createTestSignal({ id }));
      }

      const signals = await transport.readInboxSignals('team-alpha');
      expect(signals.map((s) => s.id)).toEqual(ids);
    });
  });

  describe('outbox signal operations', () => {
    it('should write signal to outbox', async () => {
      const signal = createTestSignal({ from: 'team-alpha' });

      await transport.writeOutboxSignal('team-alpha', signal);
      const signals = await transport.readOutboxSignals('team-alpha');

      expect(signals).toHaveLength(1);
      expect(signals[0]).toEqual(signal);
    });

    it('should read all outbox signals', async () => {
      const signals = [
        createTestSignal({ id: 'out-1' }),
        createTestSignal({ id: 'out-2' }),
        createTestSignal({ id: 'out-3' }),
      ];

      for (const signal of signals) {
        await transport.writeOutboxSignal('team-alpha', signal);
      }

      const result = await transport.readOutboxSignals('team-alpha');
      expect(result).toHaveLength(3);
    });

    it('should isolate inbox from outbox', async () => {
      await transport.writeInboxSignal('team-alpha', createTestSignal({ id: 'inbox-1' }));
      await transport.writeOutboxSignal('team-alpha', createTestSignal({ id: 'outbox-1' }));

      const inbox = await transport.readInboxSignals('team-alpha');
      const outbox = await transport.readOutboxSignals('team-alpha');

      expect(inbox).toHaveLength(1);
      expect(outbox).toHaveLength(1);
      expect(inbox[0].id).toBe('inbox-1');
      expect(outbox[0].id).toBe('outbox-1');
    });
  });

  describe('signal types', () => {
    const types: Array<'directive' | 'report' | 'alert' | 'sync' | 'ack'> = [
      'directive',
      'report',
      'alert',
      'sync',
      'ack',
    ];

    types.forEach((type) => {
      it(`should handle ${type} signal type`, async () => {
        const signal = createTestSignal({ type });

        await transport.writeInboxSignal('team-alpha', signal);
        const signals = await transport.readInboxSignals('team-alpha');

        expect(signals[0].type).toBe(type);
      });
    });

    it('should support mixed signal types', async () => {
      for (const type of types) {
        await transport.writeInboxSignal('team-alpha', createTestSignal({ type }));
      }

      const signals = await transport.readInboxSignals('team-alpha');
      const signalTypes = new Set(signals.map((s) => s.type));
      expect(signalTypes).toEqual(new Set(types));
    });
  });

  describe('signal filtering', () => {
    beforeEach(async () => {
      // Seed test data
      await transport.writeInboxSignal('team-alpha', createTestSignal({ id: 's1', type: 'directive', from: 'meta' }));
      await transport.writeInboxSignal('team-alpha', createTestSignal({ id: 's2', type: 'report', from: 'team-beta' }));
      await transport.writeInboxSignal('team-alpha', createTestSignal({ id: 's3', type: 'alert', from: 'meta' }));
      await transport.writeInboxSignal('team-alpha', createTestSignal({ id: 's4', type: 'directive', from: 'team-gamma' }));
    });

    it('should filter by type', async () => {
      const directives = await transport.listSignals('team-alpha', 'inbox', { type: 'directive' });
      expect(directives).toHaveLength(2);
      expect(directives.every((s) => s.type === 'directive')).toBe(true);
    });

    it('should filter by sender', async () => {
      const fromMeta = await transport.listSignals('team-alpha', 'inbox', { from: 'meta' });
      expect(fromMeta).toHaveLength(2);
      expect(fromMeta.every((s) => s.from === 'meta')).toBe(true);
    });

    it('should filter by recipient', async () => {
      const toAlpha = await transport.listSignals('team-alpha', 'inbox', { to: 'team-alpha' });
      expect(toAlpha).toHaveLength(4);
      expect(toAlpha.every((s) => s.to === 'team-alpha')).toBe(true);
    });

    it('should combine multiple filters', async () => {
      const filtered = await transport.listSignals('team-alpha', 'inbox', {
        type: 'directive',
        from: 'meta',
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('s1');
    });

    it('should filter by timestamp', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 3600000).toISOString();

      await transport.writeInboxSignal('team-alpha', createTestSignal({ id: 's5', timestamp: past }));

      const recent = await transport.listSignals('team-alpha', 'inbox', { since: past });
      expect(recent.length).toBeGreaterThan(0);
    });

    it('should return all signals when no filter provided', async () => {
      const all = await transport.listSignals('team-alpha', 'inbox', {});
      expect(all).toHaveLength(4);
    });
  });

  describe('signal body types', () => {
    it('should handle directive body', async () => {
      const signal = createTestSignal({
        type: 'directive',
        body: signalBodies.directive('scan', { depth: 'full' }),
      });

      await transport.writeInboxSignal('team-alpha', signal);
      const signals = await transport.readInboxSignals('team-alpha');

      expect(signals[0].body).toHaveProperty('command', 'scan');
      expect(signals[0].body).toHaveProperty('params');
    });

    it('should handle report body', async () => {
      const signal = createTestSignal({
        type: 'report',
        body: signalBodies.report('status', { state: 'scanning' }),
      });

      await transport.writeInboxSignal('team-alpha', signal);
      const signals = await transport.readInboxSignals('team-alpha');

      expect(signals[0].body).toHaveProperty('reportType', 'status');
      expect(signals[0].body).toHaveProperty('data');
    });

    it('should handle alert body', async () => {
      const signal = createTestSignal({
        type: 'alert',
        body: signalBodies.alert('error', 'Test error'),
      });

      await transport.writeInboxSignal('team-alpha', signal);
      const signals = await transport.readInboxSignals('team-alpha');

      expect(signals[0].body).toHaveProperty('severity', 'error');
      expect(signals[0].body).toHaveProperty('message', 'Test error');
    });

    it('should handle sync body', async () => {
      const signal = createTestSignal({
        type: 'sync',
        body: signalBodies.sync('skills', ['skill-1', 'skill-2']),
      });

      await transport.writeInboxSignal('team-alpha', signal);
      const signals = await transport.readInboxSignals('team-alpha');

      expect(signals[0].body).toHaveProperty('syncType', 'skills');
      expect(signals[0].body).toHaveProperty('payload');
    });

    it('should handle ack body', async () => {
      const signal = createTestSignal({
        type: 'ack',
        body: signalBodies.ack('original-signal-id', 'received'),
      });

      await transport.writeInboxSignal('team-alpha', signal);
      const signals = await transport.readInboxSignals('team-alpha');

      expect(signals[0].body).toHaveProperty('replyTo', 'original-signal-id');
      expect(signals[0].body).toHaveProperty('status', 'received');
    });
  });

  describe('signal metadata', () => {
    it('should preserve timestamps', async () => {
      const timestamp = new Date().toISOString();
      const signal = createTestSignal({ timestamp });

      await transport.writeInboxSignal('team-alpha', signal);
      const signals = await transport.readInboxSignals('team-alpha');

      expect(signals[0].timestamp).toBe(timestamp);
    });

    it('should track sender and recipient', async () => {
      const signal = createTestSignal({
        from: 'team-beta',
        to: 'team-alpha',
      });

      await transport.writeInboxSignal('team-alpha', signal);
      const signals = await transport.readInboxSignals('team-alpha');

      expect(signals[0].from).toBe('team-beta');
      expect(signals[0].to).toBe('team-alpha');
    });

    it('should support reply-to tracking', async () => {
      const signal = createTestSignal({
        type: 'ack',
        body: signalBodies.ack('original-123', 'processed'),
      });

      await transport.writeInboxSignal('team-alpha', signal);
      const signals = await transport.readInboxSignals('team-alpha');

      expect(signals[0].body.replyTo).toBe('original-123');
    });
  });

  describe('cross-team messaging', () => {
    it('should route signals between teams', async () => {
      const signal = createTestSignal({
        from: 'team-alpha',
        to: 'team-beta',
      });

      await transport.writeOutboxSignal('team-alpha', signal);
      await transport.writeInboxSignal('team-beta', signal);

      const alphaOutbox = await transport.readOutboxSignals('team-alpha');
      const betaInbox = await transport.readInboxSignals('team-beta');

      expect(alphaOutbox).toHaveLength(1);
      expect(betaInbox).toHaveLength(1);
      expect(alphaOutbox[0]).toEqual(betaInbox[0]);
    });

    it('should isolate team signal queues', async () => {
      await transport.writeInboxSignal('team-alpha', createTestSignal({ to: 'team-alpha' }));
      await transport.writeInboxSignal('team-beta', createTestSignal({ to: 'team-beta' }));

      const alphaSignals = await transport.readInboxSignals('team-alpha');
      const betaSignals = await transport.readInboxSignals('team-beta');

      expect(alphaSignals).toHaveLength(1);
      expect(betaSignals).toHaveLength(1);
      expect(alphaSignals[0].to).toBe('team-alpha');
      expect(betaSignals[0].to).toBe('team-beta');
    });

    it('should support broadcast signals', async () => {
      const broadcast = createTestSignal({
        from: 'meta',
        to: 'broadcast',
      });

      await transport.writeInboxSignal('team-alpha', broadcast);
      await transport.writeInboxSignal('team-beta', broadcast);
      await transport.writeInboxSignal('team-gamma', broadcast);

      const teams = ['team-alpha', 'team-beta', 'team-gamma'];
      for (const team of teams) {
        const signals = await transport.readInboxSignals(team);
        expect(signals).toHaveLength(1);
        expect(signals[0].to).toBe('broadcast');
      }
    });
  });

  describe('signal file format', () => {
    it('should store signals as JSONL', async () => {
      await transport.writeInboxSignal('team-alpha', createTestSignal({ id: 's1' }));
      await transport.writeInboxSignal('team-alpha', createTestSignal({ id: 's2' }));

      const raw = await transport.readFile('team-alpha', '.squad/inbox.jsonl');
      expect(raw).not.toBeNull();

      const lines = raw!.split('\n').filter((l) => l.trim());
      expect(lines.length).toBe(2);

      lines.forEach((line) => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });

    it('should handle multi-line body content', async () => {
      const signal = createTestSignal({
        body: {
          message: 'Line 1\nLine 2\nLine 3',
        },
      });

      await transport.writeInboxSignal('team-alpha', signal);
      const signals = await transport.readInboxSignals('team-alpha');

      expect(signals[0].body.message).toBe('Line 1\nLine 2\nLine 3');
    });
  });
});
