/**
 * Tests for MockPlacement + MockCommunication to validate new interfaces.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockPlacement, MockCommunication } from './mock-transport.js';
import { createTestSignal, createTestStatus, createTestLearning } from './test-fixtures.js';

describe('MockPlacement + MockCommunication', () => {
  let placement: MockPlacement;
  let communication: MockCommunication;

  beforeEach(() => {
    placement = new MockPlacement();
    communication = new MockCommunication(placement);
  });

  describe('placement file operations', () => {
    it('should write and read files', async () => {
      await placement.writeFile('team-alpha', 'test.txt', 'hello world');
      const content = await placement.readFile('team-alpha', 'test.txt');

      expect(content).toBe('hello world');
    });

    it('should return null for non-existent files', async () => {
      const content = await placement.readFile('team-alpha', 'missing.txt');
      expect(content).toBeNull();
    });

    it('should check file existence', async () => {
      await placement.writeFile('team-alpha', 'exists.txt', 'content');

      expect(await placement.exists('team-alpha', 'exists.txt')).toBe(true);
      expect(await placement.exists('team-alpha', 'missing.txt')).toBe(false);
    });

    it('should return file stats', async () => {
      await placement.writeFile('team-alpha', 'file.txt', 'content');
      const stats = await placement.stat('team-alpha', 'file.txt');

      expect(stats).not.toBeNull();
      expect(stats?.isDirectory).toBe(false);
      expect(stats?.size).toBe(7);
    });

    it('should isolate files by teamId', async () => {
      await placement.writeFile('team-alpha', 'file.txt', 'alpha content');
      await placement.writeFile('team-beta', 'file.txt', 'beta content');

      expect(await placement.readFile('team-alpha', 'file.txt')).toBe('alpha content');
      expect(await placement.readFile('team-beta', 'file.txt')).toBe('beta content');
    });
  });

  describe('communication operations', () => {
    it('should read and write status', async () => {
      const status = createTestStatus({
        domain: 'team-alpha',
        state: 'scanning',
        step: 'analysis',
      });

      await placement.writeFile('team-alpha', '.squad/status.json', JSON.stringify(status));
      const result = await communication.readStatus('team-alpha');

      expect(result).toEqual(status);
    });

    it('should return null for missing status', async () => {
      const result = await communication.readStatus('team-alpha');
      expect(result).toBeNull();
    });

    it('should write and read inbox signals', async () => {
      const signal = createTestSignal({
        from: 'meta',
        to: 'team-alpha',
        type: 'directive',
      });

      await communication.writeInboxSignal('team-alpha', signal);
      const signals = await communication.readInboxSignals('team-alpha');

      expect(signals).toHaveLength(1);
      expect(signals[0]).toEqual(signal);
    });

    it('should list signals with filters', async () => {
      const signal1 = createTestSignal({ type: 'directive', from: 'meta' });
      const signal2 = createTestSignal({ type: 'report', from: 'team-alpha' });

      await communication.writeInboxSignal('team-alpha', signal1);
      await communication.writeInboxSignal('team-alpha', signal2);

      const directives = await communication.listSignals('team-alpha', 'inbox', { type: 'directive' });
      expect(directives).toHaveLength(1);
      expect(directives[0].type).toBe('directive');

      const fromMeta = await communication.listSignals('team-alpha', 'inbox', { from: 'meta' });
      expect(fromMeta).toHaveLength(1);
      expect(fromMeta[0].from).toBe('meta');
    });

    it('should append and read learning entries', async () => {
      const entry1 = createTestLearning({ content: 'First learning' });
      const entry2 = createTestLearning({ content: 'Second learning' });

      await communication.appendLearning('team-alpha', entry1);
      await communication.appendLearning('team-alpha', entry2);

      const entries = await communication.readLearningLog('team-alpha');

      expect(entries).toHaveLength(2);
      expect(entries[0].content).toBe('First learning');
      expect(entries[1].content).toBe('Second learning');
    });
  });

  describe('workspace helpers', () => {
    it('should seed team with files', () => {
      placement.seedTeam('team-alpha', {
        'file1.txt': 'content1',
        'file2.txt': 'content2',
      });

      expect(placement.getTeams()).toContain('team-alpha');
    });

    it('should clear all data', async () => {
      await placement.writeFile('team-alpha', 'file.txt', 'content');
      await placement.writeFile('team-beta', 'file.txt', 'content');

      placement.clear();

      expect(placement.getTeams()).toHaveLength(0);
      expect(await placement.readFile('team-alpha', 'file.txt')).toBeNull();
    });

    it('should list all teams', () => {
      placement.seedTeam('team-alpha', {});
      placement.seedTeam('team-beta', {});
      placement.seedTeam('team-gamma', {});

      const teams = placement.getTeams();
      expect(teams).toHaveLength(3);
      expect(teams).toContain('team-alpha');
      expect(teams).toContain('team-beta');
      expect(teams).toContain('team-gamma');
    });
  });

  describe('workspace operations', () => {
    it('should check workspace existence', async () => {
      expect(await placement.workspaceExists('team-alpha')).toBe(false);

      await placement.writeFile('team-alpha', 'test.txt', 'content');

      expect(await placement.workspaceExists('team-alpha')).toBe(true);
    });

    it('should get workspace location', async () => {
      const location = await placement.getLocation('team-alpha');
      expect(location).toBe('/mock/workspace/team-alpha');
    });

    it('should list all files in workspace', async () => {
      await placement.writeFile('team-alpha', 'file1.txt', 'content1');
      await placement.writeFile('team-alpha', 'dir/file2.txt', 'content2');
      await placement.writeFile('team-alpha', 'dir/file3.txt', 'content3');

      const allFiles = await placement.listFiles('team-alpha');
      expect(allFiles).toHaveLength(3);
      expect(allFiles).toContain('file1.txt');
      expect(allFiles).toContain('dir/file2.txt');

      const dirFiles = await placement.listFiles('team-alpha', 'dir');
      expect(dirFiles).toHaveLength(2);
      expect(dirFiles.every(f => f.startsWith('dir/'))).toBe(true);
    });

    it('should bootstrap a team workspace', async () => {
      await placement.bootstrap('team-alpha', 'deliverable', { owner: 'test' });

      expect(await placement.workspaceExists('team-alpha')).toBe(true);
      const config = await placement.readFile('team-alpha', '.squad/config.json');
      expect(config).not.toBeNull();
    });
  });
});
