/**
 * Unit tests for directory-placement.ts — directory-based placement implementation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockPlacement } from '../helpers/mock-placement.js';

describe('directory-placement.ts', () => {
  let placement: MockPlacement;

  beforeEach(() => {
    placement = new MockPlacement();
  });

  describe('file operations', () => {
    it('should write and read files', async () => {
      await placement.writeFile('team-alpha', 'test.txt', 'content');
      const content = await placement.readFile('team-alpha', 'test.txt');

      expect(content).toBe('content');
    });

    it('should handle nested file paths', async () => {
      await placement.writeFile('team-alpha', 'dir/subdir/file.txt', 'nested content');
      const content = await placement.readFile('team-alpha', 'dir/subdir/file.txt');

      expect(content).toBe('nested content');
    });

    it('should check file existence', async () => {
      await placement.writeFile('team-alpha', 'exists.txt', 'content');

      expect(await placement.exists('team-alpha', 'exists.txt')).toBe(true);
      expect(await placement.exists('team-alpha', 'missing.txt')).toBe(false);
    });

    it('should get file stats', async () => {
      await placement.writeFile('team-alpha', 'file.txt', 'test content');
      const stats = await placement.stat('team-alpha', 'file.txt');

      expect(stats).not.toBeNull();
      expect(stats?.isDirectory).toBe(false);
      expect(stats?.size).toBeGreaterThan(0);
    });

    it('should isolate teams', async () => {
      await placement.writeFile('team-alpha', 'shared.txt', 'alpha');
      await placement.writeFile('team-beta', 'shared.txt', 'beta');

      expect(await placement.readFile('team-alpha', 'shared.txt')).toBe('alpha');
      expect(await placement.readFile('team-beta', 'shared.txt')).toBe('beta');
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
      expect(location).toContain('team-alpha');
    });

    it('should list files in workspace', async () => {
      await placement.writeFile('team-alpha', 'file1.txt', 'content1');
      await placement.writeFile('team-alpha', 'dir/file2.txt', 'content2');
      await placement.writeFile('team-alpha', 'dir/subdir/file3.txt', 'content3');

      const allFiles = await placement.listFiles('team-alpha');
      expect(allFiles.length).toBeGreaterThan(0);
    });

    it('should bootstrap team workspace', async () => {
      await placement.bootstrap('team-alpha', 'deliverable', {
        owner: 'test-user',
        priority: 'high',
      });

      expect(await placement.workspaceExists('team-alpha')).toBe(true);

      const config = await placement.readFile('team-alpha', '.squad/config.json');
      expect(config).not.toBeNull();

      const parsed = JSON.parse(config!);
      expect(parsed.archetypeId).toBe('deliverable');
      expect(parsed.owner).toBe('test-user');
    });
  });

  describe('test helpers', () => {
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
    });

    it('should list all teams', () => {
      placement.seedTeam('team-alpha', {});
      placement.seedTeam('team-beta', {});
      placement.seedTeam('team-gamma', {});

      const teams = placement.getTeams();
      expect(teams).toHaveLength(3);
      expect(teams).toEqual(['team-alpha', 'team-beta', 'team-gamma']);
    });
  });
});
