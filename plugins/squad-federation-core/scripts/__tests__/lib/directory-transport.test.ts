/**
 * Unit tests for directory-placement.ts — directory-based placement implementation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { DirectoryPlacement } from '../../lib/directory-placement.js';

const TEST_ROOT = path.join(process.cwd(), 'scripts', '__tests__', 'tmp');

describe('directory-placement.ts', () => {
  let placement: DirectoryPlacement;
  let basePath: string;

  beforeEach(async () => {
    await fs.mkdir(TEST_ROOT, { recursive: true });
    basePath = path.join(TEST_ROOT, `directory-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    await fs.mkdir(basePath, { recursive: true });

    placement = new DirectoryPlacement(new Map([['team-alpha', basePath]]));
  });

  afterEach(async () => {
    await fs.rm(basePath, { recursive: true, force: true });
  });

  it('should write and read files', async () => {
    await placement.writeFile('team-alpha', 'test.txt', 'content');
    const content = await placement.readFile('team-alpha', 'test.txt');
    expect(content).toBe('content');
  });

  it('should check file existence', async () => {
    await placement.writeFile('team-alpha', 'exists.txt', 'content');
    expect(await placement.exists('team-alpha', 'exists.txt')).toBe(true);
    expect(await placement.exists('team-alpha', 'missing.txt')).toBe(false);
  });

  it('should return file stats', async () => {
    await placement.writeFile('team-alpha', 'file.txt', 'test content');
    const stats = await placement.stat('team-alpha', 'file.txt');
    expect(stats?.isDirectory).toBe(false);
    expect(stats?.size).toBe(12);
  });

  it('should list files recursively', async () => {
    await placement.writeFile('team-alpha', 'dir/file1.txt', 'one');
    await placement.writeFile('team-alpha', 'dir/sub/file2.txt', 'two');

    const files = await placement.listFiles('team-alpha');
    expect(files).toContain('dir/file1.txt');
    expect(files).toContain('dir/sub/file2.txt');
  });

  it('should bootstrap a team workspace', async () => {
    await placement.bootstrap('team-alpha', 'deliverable', { owner: 'test' });

    expect(await placement.exists('team-alpha', '.squad/status.json')).toBe(true);
    expect(await placement.exists('team-alpha', '.squad/signals/inbox')).toBe(true);
    expect(await placement.exists('team-alpha', '.squad/signals/outbox')).toBe(true);
    expect(await placement.exists('team-alpha', '.squad/learnings/log.jsonl')).toBe(true);
  });
});
