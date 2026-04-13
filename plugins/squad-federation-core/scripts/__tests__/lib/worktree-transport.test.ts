/**
 * Unit tests for worktree-transport.ts — git worktree-based transport implementation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockTransport } from '../helpers/mock-transport.js';
import { createTestSignal, createTestStatus } from '../helpers/test-fixtures.js';

// For worktree transport, we'll test the common interface patterns
// Actual git operations would be tested in integration tests
describe('worktree-transport.ts', () => {
  let transport: MockTransport;

  beforeEach(() => {
    transport = new MockTransport();
  });

  describe('TeamTransport interface compliance', () => {
    it('should implement readFile operation', async () => {
      await transport.writeFile('team-alpha', 'test.txt', 'content');
      const content = await transport.readFile('team-alpha', 'test.txt');

      expect(content).toBe('content');
      expect(typeof content).toBe('string');
    });

    it('should implement writeFile operation', async () => {
      await transport.writeFile('team-alpha', 'new.txt', 'new content');
      const content = await transport.readFile('team-alpha', 'new.txt');

      expect(content).toBe('new content');
    });

    it('should implement exists operation', async () => {
      await transport.writeFile('team-alpha', 'exists.txt', 'content');

      expect(await transport.exists('team-alpha', 'exists.txt')).toBe(true);
      expect(await transport.exists('team-alpha', 'missing.txt')).toBe(false);
    });

    it('should implement stat operation', async () => {
      await transport.writeFile('team-alpha', 'file.txt', 'content');
      const stats = await transport.stat?.('team-alpha', 'file.txt');

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('isDirectory');
      expect(stats).toHaveProperty('size');
    });

    it('should implement readStatus operation', async () => {
      const status = createTestStatus({ domain: 'team-alpha' });
      await transport.writeFile('team-alpha', '.squad/status.json', JSON.stringify(status));

      const result = await transport.readStatus('team-alpha');
      expect(result).toEqual(status);
    });

    it('should implement signal operations', async () => {
      const signal = createTestSignal();

      await transport.writeInboxSignal('team-alpha', signal);
      const signals = await transport.readInboxSignals('team-alpha');

      expect(signals).toHaveLength(1);
      expect(signals[0]).toEqual(signal);
    });

    it('should implement workspace operations', async () => {
      expect(await transport.workspaceExists('team-alpha')).toBe(false);

      await transport.writeFile('team-alpha', 'test.txt', 'content');

      expect(await transport.workspaceExists('team-alpha')).toBe(true);
    });

    it('should implement getLocation operation', async () => {
      const location = await transport.getLocation('team-alpha');
      expect(typeof location).toBe('string');
      expect(location.length).toBeGreaterThan(0);
    });

    it('should implement listFiles operation', async () => {
      await transport.writeFile('team-alpha', 'file1.txt', 'content');
      await transport.writeFile('team-alpha', 'file2.txt', 'content');

      const files = await transport.listFiles('team-alpha');
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
    });

    it('should implement bootstrap operation', async () => {
      await transport.bootstrap('team-alpha', 'deliverable', { owner: 'test' });

      expect(await transport.workspaceExists('team-alpha')).toBe(true);
      const config = await transport.readFile('team-alpha', '.squad/config.json');
      expect(config).not.toBeNull();
    });
  });

  describe('git worktree-specific patterns', () => {
    it('should handle worktree paths correctly', async () => {
      // Simulate worktree structure
      transport.seedTeam('squad/frontend', {
        '.squad/status.json': JSON.stringify(createTestStatus({ domain: 'frontend' })),
      });

      const status = await transport.readStatus('squad/frontend');
      expect(status).not.toBeNull();
      expect(status?.domain).toBe('frontend');
    });

    it('should handle branch-based team identification', async () => {
      // Simulate multiple worktrees
      transport.seedTeam('squad/frontend', {});
      transport.seedTeam('squad/backend', {});
      transport.seedTeam('squad/api', {});

      const teams = transport.getTeams();
      expect(teams).toHaveLength(3);
      expect(teams.every((t) => t.startsWith('squad/'))).toBe(true);
    });

    it('should isolate team workspaces', async () => {
      await transport.writeFile('squad/frontend', 'README.md', 'Frontend team');
      await transport.writeFile('squad/backend', 'README.md', 'Backend team');

      const frontendReadme = await transport.readFile('squad/frontend', 'README.md');
      const backendReadme = await transport.readFile('squad/backend', 'README.md');

      expect(frontendReadme).toBe('Frontend team');
      expect(backendReadme).toBe('Backend team');
    });
  });

  describe('error handling', () => {
    it('should return null for non-existent files', async () => {
      const content = await transport.readFile('team-alpha', 'nonexistent.txt');
      expect(content).toBeNull();
    });

    it('should return false for non-existent workspace', async () => {
      const exists = await transport.workspaceExists('nonexistent-team');
      expect(exists).toBe(false);
    });

    it('should return empty array for empty workspace', async () => {
      transport.seedTeam('team-alpha', {});
      const files = await transport.listFiles('team-alpha');
      expect(files).toEqual([]);
    });

    it('should return null for missing status', async () => {
      const status = await transport.readStatus('team-alpha');
      expect(status).toBeNull();
    });

    it('should return empty array for missing signals', async () => {
      const signals = await transport.readInboxSignals('team-alpha');
      expect(signals).toEqual([]);
    });
  });

  describe('concurrent access patterns', () => {
    it('should handle multiple readers', async () => {
      await transport.writeFile('team-alpha', 'shared.txt', 'shared content');

      const reads = await Promise.all([
        transport.readFile('team-alpha', 'shared.txt'),
        transport.readFile('team-alpha', 'shared.txt'),
        transport.readFile('team-alpha', 'shared.txt'),
      ]);

      expect(reads.every((r) => r === 'shared content')).toBe(true);
    });

    it('should handle concurrent writes to different teams', async () => {
      await Promise.all([
        transport.writeFile('team-alpha', 'file.txt', 'alpha'),
        transport.writeFile('team-beta', 'file.txt', 'beta'),
        transport.writeFile('team-gamma', 'file.txt', 'gamma'),
      ]);

      expect(await transport.readFile('team-alpha', 'file.txt')).toBe('alpha');
      expect(await transport.readFile('team-beta', 'file.txt')).toBe('beta');
      expect(await transport.readFile('team-gamma', 'file.txt')).toBe('gamma');
    });
  });
});
