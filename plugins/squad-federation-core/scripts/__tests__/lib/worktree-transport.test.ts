/**
 * Unit tests for worktree-placement.ts — git worktree-based placement implementation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { WorktreePlacement } from '../../lib/worktree-placement.js';

const TEST_ROOT = path.join(process.cwd(), 'scripts', '__tests__', 'tmp');

describe('worktree-placement.ts', () => {
  let placement: WorktreePlacement;
  let basePath: string;

  beforeEach(async () => {
    await fs.mkdir(TEST_ROOT, { recursive: true });
    basePath = path.join(TEST_ROOT, `worktree-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    await fs.mkdir(basePath, { recursive: true });

    placement = new WorktreePlacement(basePath, 'squad/test', process.cwd(), undefined, 'team-alpha');
  });

  afterEach(async () => {
    await fs.rm(basePath, { recursive: true, force: true });
  });

  it('should expose branch name', () => {
    expect(placement.getBranch()).toBe('squad/test');
  });

  it('should write and read files via inherited placement', async () => {
    await placement.writeFile('team-alpha', 'README.md', 'content');
    const content = await placement.readFile('team-alpha', 'README.md');
    expect(content).toBe('content');
  });

  it('should list files in workspace', async () => {
    await placement.writeFile('team-alpha', 'dir/file1.txt', 'one');
    await placement.writeFile('team-alpha', 'dir/file2.txt', 'two');

    const files = await placement.listFiles('team-alpha');
    expect(files).toContain('dir/file1.txt');
    expect(files).toContain('dir/file2.txt');
  });

  it('should bootstrap a team workspace', async () => {
    await placement.bootstrap('team-alpha', 'deliverable', { owner: 'test' });
    expect(await placement.exists('team-alpha', '.squad/status.json')).toBe(true);
  });
});
