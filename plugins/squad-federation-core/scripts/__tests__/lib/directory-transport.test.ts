/**
 * Unit tests for directory-transport.ts — directory-based transport implementation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockTransport } from '../helpers/mock-transport.js';
import { createTestSignal, createTestStatus, createTestLearning } from '../helpers/test-fixtures.js';

describe('directory-transport.ts', () => {
  let transport: MockTransport;

  beforeEach(() => {
    transport = new MockTransport();
  });

  describe('file operations', () => {
    it('should write and read files', async () => {
      await transport.writeFile('team-alpha', 'test.txt', 'content');
      const content = await transport.readFile('team-alpha', 'test.txt');

      expect(content).toBe('content');
    });

    it('should handle nested file paths', async () => {
      await transport.writeFile('team-alpha', 'dir/subdir/file.txt', 'nested content');
      const content = await transport.readFile('team-alpha', 'dir/subdir/file.txt');

      expect(content).toBe('nested content');
    });

    it('should check file existence', async () => {
      await transport.writeFile('team-alpha', 'exists.txt', 'content');

      expect(await transport.exists('team-alpha', 'exists.txt')).toBe(true);
      expect(await transport.exists('team-alpha', 'missing.txt')).toBe(false);
    });

    it('should get file stats', async () => {
      await transport.writeFile('team-alpha', 'file.txt', 'test content');
      const stats = await transport.stat('team-alpha', 'file.txt');

      expect(stats).not.toBeNull();
      expect(stats?.isDirectory).toBe(false);
      expect(stats?.size).toBe(12);
    });

    it('should isolate teams', async () => {
      await transport.writeFile('team-alpha', 'shared.txt', 'alpha');
      await transport.writeFile('team-beta', 'shared.txt', 'beta');

      expect(await transport.readFile('team-alpha', 'shared.txt')).toBe('alpha');
      expect(await transport.readFile('team-beta', 'shared.txt')).toBe('beta');
    });
  });

  describe('status operations', () => {
    it('should read and write status', async () => {
      const status = createTestStatus({
        domain: 'team-alpha',
        state: 'scanning',
        step: 'discovery',
      });

      await transport.writeFile('team-alpha', '.squad/status.json', JSON.stringify(status));
      const result = await transport.readStatus('team-alpha');

      expect(result).toEqual(status);
    });

    it('should return null for missing status', async () => {
      const result = await transport.readStatus('team-alpha');
      expect(result).toBeNull();
    });

    it('should handle status updates', async () => {
      const initial = createTestStatus({ state: 'idle' });
      const updated = createTestStatus({ state: 'scanning', progress_pct: 50 });

      await transport.writeFile('team-alpha', '.squad/status.json', JSON.stringify(initial));
      await transport.writeFile('team-alpha', '.squad/status.json', JSON.stringify(updated));

      const result = await transport.readStatus('team-alpha');
      expect(result?.state).toBe('scanning');
      expect(result?.progress_pct).toBe(50);
    });
  });

  describe('signal operations', () => {
    it('should write and read inbox signals', async () => {
      const signal = createTestSignal({
        from: 'meta',
        to: 'team-alpha',
        type: 'directive',
      });

      await transport.writeInboxSignal('team-alpha', signal);
      const signals = await transport.readInboxSignals('team-alpha');

      expect(signals).toHaveLength(1);
      expect(signals[0]).toEqual(signal);
    });

    it('should handle multiple signals', async () => {
      const signals = [
        createTestSignal({ id: 'signal-1', type: 'directive' }),
        createTestSignal({ id: 'signal-2', type: 'report' }),
        createTestSignal({ id: 'signal-3', type: 'alert' }),
      ];

      for (const signal of signals) {
        await transport.writeInboxSignal('team-alpha', signal);
      }

      const result = await transport.readInboxSignals('team-alpha');
      expect(result).toHaveLength(3);
    });

    it('should filter signals by type', async () => {
      await transport.writeInboxSignal('team-alpha', createTestSignal({ type: 'directive' }));
      await transport.writeInboxSignal('team-alpha', createTestSignal({ type: 'report' }));
      await transport.writeInboxSignal('team-alpha', createTestSignal({ type: 'alert' }));

      const directives = await transport.listSignals('team-alpha', 'inbox', { type: 'directive' });
      expect(directives).toHaveLength(1);
      expect(directives[0].type).toBe('directive');
    });

    it('should filter signals by sender', async () => {
      await transport.writeInboxSignal('team-alpha', createTestSignal({ from: 'meta', type: 'directive' }));
      await transport.writeInboxSignal('team-alpha', createTestSignal({ from: 'team-beta', type: 'report' }));

      const fromMeta = await transport.listSignals('team-alpha', 'inbox', { from: 'meta' });
      expect(fromMeta).toHaveLength(1);
      expect(fromMeta[0].from).toBe('meta');
    });

    it('should filter signals by timestamp', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 3600000).toISOString();

      await transport.writeInboxSignal('team-alpha', createTestSignal({ timestamp: past }));
      await transport.writeInboxSignal('team-alpha', createTestSignal({ timestamp: now.toISOString() }));

      const recent = await transport.listSignals('team-alpha', 'inbox', { since: past });
      expect(recent).toHaveLength(2);
    });
  });

  describe('learning log operations', () => {
    it('should append and read learning entries', async () => {
      const entry1 = createTestLearning({ content: 'First learning' });
      const entry2 = createTestLearning({ content: 'Second learning' });

      await transport.appendLearning('team-alpha', entry1);
      await transport.appendLearning('team-alpha', entry2);

      const entries = await transport.readLearningLog('team-alpha');
      expect(entries).toHaveLength(2);
      expect(entries[0].content).toBe('First learning');
      expect(entries[1].content).toBe('Second learning');
    });

    it('should handle different learning types', async () => {
      const types: Array<'discovery' | 'correction' | 'pattern' | 'technique' | 'gotcha'> = [
        'discovery',
        'correction',
        'pattern',
        'technique',
        'gotcha',
      ];

      for (const type of types) {
        await transport.appendLearning('team-alpha', createTestLearning({ type }));
      }

      const entries = await transport.readLearningLog('team-alpha');
      expect(entries).toHaveLength(5);
      expect(new Set(entries.map((e) => e.type))).toEqual(new Set(types));
    });

    it('should support confidence levels', async () => {
      await transport.appendLearning('team-alpha', createTestLearning({ confidence: 'low' }));
      await transport.appendLearning('team-alpha', createTestLearning({ confidence: 'medium' }));
      await transport.appendLearning('team-alpha', createTestLearning({ confidence: 'high' }));

      const entries = await transport.readLearningLog('team-alpha');
      expect(entries.map((e) => e.confidence)).toEqual(['low', 'medium', 'high']);
    });

    it('should handle graduation metadata', async () => {
      const graduated = createTestLearning({
        content: 'Graduated learning',
        graduated: true,
        graduated_to: 'shared-skills',
      });

      await transport.appendLearning('team-alpha', graduated);
      const entries = await transport.readLearningLog('team-alpha');

      expect(entries[0].graduated).toBe(true);
      expect(entries[0].graduated_to).toBe('shared-skills');
    });

    it('should return empty array for missing log', async () => {
      const entries = await transport.readLearningLog('team-alpha');
      expect(entries).toEqual([]);
    });
  });

  describe('workspace operations', () => {
    it('should check workspace existence', async () => {
      expect(await transport.workspaceExists('team-alpha')).toBe(false);

      await transport.writeFile('team-alpha', 'test.txt', 'content');

      expect(await transport.workspaceExists('team-alpha')).toBe(true);
    });

    it('should get workspace location', async () => {
      const location = await transport.getLocation('team-alpha');
      expect(location).toContain('team-alpha');
    });

    it('should list files in workspace', async () => {
      await transport.writeFile('team-alpha', 'file1.txt', 'content1');
      await transport.writeFile('team-alpha', 'dir/file2.txt', 'content2');
      await transport.writeFile('team-alpha', 'dir/subdir/file3.txt', 'content3');

      const allFiles = await transport.listFiles('team-alpha');
      expect(allFiles).toHaveLength(3);
      expect(allFiles).toContain('file1.txt');
      expect(allFiles).toContain('dir/file2.txt');
      expect(allFiles).toContain('dir/subdir/file3.txt');
    });

    it('should list files in specific directory', async () => {
      await transport.writeFile('team-alpha', 'root.txt', 'content');
      await transport.writeFile('team-alpha', 'dir/file1.txt', 'content');
      await transport.writeFile('team-alpha', 'dir/file2.txt', 'content');
      await transport.writeFile('team-alpha', 'other/file.txt', 'content');

      const dirFiles = await transport.listFiles('team-alpha', 'dir');
      expect(dirFiles).toHaveLength(2);
      expect(dirFiles.every((f) => f.startsWith('dir/'))).toBe(true);
    });

    it('should bootstrap team workspace', async () => {
      await transport.bootstrap('team-alpha', 'deliverable', {
        owner: 'test-user',
        priority: 'high',
      });

      expect(await transport.workspaceExists('team-alpha')).toBe(true);

      const config = await transport.readFile('team-alpha', '.squad/config.json');
      expect(config).not.toBeNull();

      const parsed = JSON.parse(config!);
      expect(parsed.archetypeId).toBe('deliverable');
      expect(parsed.owner).toBe('test-user');
    });
  });

  describe('test helpers', () => {
    it('should seed team with files', () => {
      transport.seedTeam('team-alpha', {
        'file1.txt': 'content1',
        'file2.txt': 'content2',
      });

      expect(transport.getTeams()).toContain('team-alpha');
    });

    it('should clear all data', async () => {
      await transport.writeFile('team-alpha', 'file.txt', 'content');
      await transport.writeFile('team-beta', 'file.txt', 'content');

      transport.clear();

      expect(transport.getTeams()).toHaveLength(0);
    });

    it('should list all teams', () => {
      transport.seedTeam('team-alpha', {});
      transport.seedTeam('team-beta', {});
      transport.seedTeam('team-gamma', {});

      const teams = transport.getTeams();
      expect(teams).toHaveLength(3);
      expect(teams).toEqual(['team-alpha', 'team-beta', 'team-gamma']);
    });
  });
});
