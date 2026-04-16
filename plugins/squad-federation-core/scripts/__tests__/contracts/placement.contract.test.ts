/**
 * Contract tests for TeamPlacement implementations
 * Verifies that all placement implementations satisfy the TeamPlacement interface
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DirectoryPlacement } from '../../lib/placement/directory-placement.js';
import type { TeamPlacement } from '../../../sdk/types.js';

describe('placement.contract.test.ts', () => {
  let tempDir: string;
  let testTeamId: string;

  beforeEach(async () => {
    // Create temp directory for test isolation
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'placement-test-'));
    testTeamId = 'test-team';
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // Placement implementations to test
  const placements: Array<{ name: string; create: () => TeamPlacement }> = [
    {
      name: 'DirectoryPlacement',
      create: () => {
        const basePathMap = new Map<string, string>();
        basePathMap.set(testTeamId, path.join(tempDir, testTeamId));
        return new DirectoryPlacement(basePathMap);
      },
    },
    // WorktreePlacement requires git setup - better suited for integration tests
  ];

  placements.forEach(({ name, create }) => {
    describe(`${name} TeamPlacement interface compliance`, () => {
      let placement: TeamPlacement;

      beforeEach(() => {
        placement = create();
      });

      describe('file operations', () => {
        it('should implement readFile', async () => {
          expect(placement.readFile).toBeDefined();
          expect(typeof placement.readFile).toBe('function');

          // Write a test file first
          await placement.writeFile(testTeamId, 'test.txt', 'content');

          const result = await placement.readFile(testTeamId, 'test.txt');
          expect(result).toBe('content');
        });

        it('should return null for non-existent file', async () => {
          const result = await placement.readFile(testTeamId, 'nonexistent.txt');
          expect(result).toBeNull();
        });

        it('should implement writeFile', async () => {
          expect(placement.writeFile).toBeDefined();
          expect(typeof placement.writeFile).toBe('function');

          await expect(placement.writeFile(testTeamId, 'test.txt', 'content')).resolves.not.toThrow();

          // Verify file was written
          const content = await placement.readFile(testTeamId, 'test.txt');
          expect(content).toBe('content');
        });

        it('should create parent directories automatically', async () => {
          await placement.writeFile(testTeamId, 'nested/path/file.txt', 'nested content');

          const content = await placement.readFile(testTeamId, 'nested/path/file.txt');
          expect(content).toBe('nested content');
        });

        it('should implement exists', async () => {
          expect(placement.exists).toBeDefined();
          expect(typeof placement.exists).toBe('function');

          const existsBefore = await placement.exists(testTeamId, 'test.txt');
          expect(existsBefore).toBe(false);

          await placement.writeFile(testTeamId, 'test.txt', 'content');

          const existsAfter = await placement.exists(testTeamId, 'test.txt');
          expect(existsAfter).toBe(true);
        });

        it('should implement stat (optional)', async () => {
          if (!placement.stat) {
            return; // stat is optional
          }

          expect(typeof placement.stat).toBe('function');

          await placement.writeFile(testTeamId, 'test.txt', 'content');

          const result = await placement.stat(testTeamId, 'test.txt');
          expect(result).not.toBeNull();
          expect(result).toHaveProperty('isDirectory');
          expect(result).toHaveProperty('size');
          expect(result!.isDirectory).toBe(false);
          expect(result!.size).toBeGreaterThan(0);
        });

        it('should return null stat for non-existent file', async () => {
          if (!placement.stat) {
            return;
          }

          const result = await placement.stat(testTeamId, 'nonexistent.txt');
          expect(result).toBeNull();
        });
      });

      describe('workspace operations', () => {
        it('should implement workspaceExists', async () => {
          expect(placement.workspaceExists).toBeDefined();
          expect(typeof placement.workspaceExists).toBe('function');

          const existsBefore = await placement.workspaceExists(testTeamId);
          expect(typeof existsBefore).toBe('boolean');
        });

        it('should implement getLocation', async () => {
          expect(placement.getLocation).toBeDefined();
          expect(typeof placement.getLocation).toBe('function');

          const result = await placement.getLocation(testTeamId);
          expect(typeof result).toBe('string');
          expect(result.length).toBeGreaterThan(0);
        });

        it('should implement listFiles', async () => {
          expect(placement.listFiles).toBeDefined();
          expect(typeof placement.listFiles).toBe('function');

          // Bootstrap to create workspace
          await placement.bootstrap(testTeamId, 'test-archetype', {});

          // Add some test files
          await placement.writeFile(testTeamId, 'file1.txt', 'content1');
          await placement.writeFile(testTeamId, 'nested/file2.txt', 'content2');

          const result = await placement.listFiles(testTeamId);
          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBeGreaterThan(0);

          // Check that files are listed
          const hasFile1 = result.some(f => f.includes('file1.txt'));
          const hasFile2 = result.some(f => f.includes('file2.txt'));
          expect(hasFile1).toBe(true);
          expect(hasFile2).toBe(true);
        });

        it('should implement bootstrap', async () => {
          expect(placement.bootstrap).toBeDefined();
          expect(typeof placement.bootstrap).toBe('function');

          await expect(
            placement.bootstrap(testTeamId, 'test-archetype', { owner: 'test-user' })
          ).resolves.not.toThrow();

          // Verify bootstrap created standard structure
          const statusExists = await placement.exists(testTeamId, '.squad/signals/status.json');
          expect(statusExists).toBe(true);

          const learningLogExists = await placement.exists(testTeamId, '.squad/learnings/log.jsonl');
          expect(learningLogExists).toBe(true);
        });
      });

      describe('data integrity', () => {
        it('should preserve file contents', async () => {
          const content = 'test content with special chars: 日本語 émojis 🚀';
          
          await placement.writeFile(testTeamId, 'test.txt', content);
          const retrieved = await placement.readFile(testTeamId, 'test.txt');
          
          expect(retrieved).toBe(content);
        });

        it('should handle large files', async () => {
          const largeContent = 'x'.repeat(1024 * 1024); // 1MB
          
          await placement.writeFile(testTeamId, 'large.txt', largeContent);
          const retrieved = await placement.readFile(testTeamId, 'large.txt');
          
          expect(retrieved).toBe(largeContent);
        });

        it('should handle concurrent writes to different files', async () => {
          const writes = Array.from({ length: 10 }, (_, i) =>
            placement.writeFile(testTeamId, `file${i}.txt`, `content${i}`)
          );

          await Promise.all(writes);

          // Verify all files were written
          const reads = await Promise.all(
            Array.from({ length: 10 }, (_, i) =>
              placement.readFile(testTeamId, `file${i}.txt`)
            )
          );

          reads.forEach((content, i) => {
            expect(content).toBe(`content${i}`);
          });
        });
      });

      describe('error handling', () => {
        it('should throw meaningful error for unknown team', async () => {
          await expect(
            placement.readFile('unknown-team', 'file.txt')
          ).rejects.toThrow();
        });

        it('should handle file path edge cases', async () => {
          // Paths with dots
          await placement.writeFile(testTeamId, './test.txt', 'content');
          const content1 = await placement.readFile(testTeamId, './test.txt');
          expect(content1).toBe('content');

          // Empty directory component
          await placement.writeFile(testTeamId, 'dir//file.txt', 'content');
          const content2 = await placement.readFile(testTeamId, 'dir//file.txt');
          expect(content2).toBe('content');
        });
      });

      describe('async operation compliance', () => {
        it('should return Promises for all async operations', async () => {
          // Verify that all operations return Promises and await them to prevent leaks
          const promises = [
            placement.readFile(testTeamId, 'file'),
            placement.writeFile(testTeamId, 'file', 'data'),
            placement.exists(testTeamId, 'file'),
            placement.workspaceExists(testTeamId),
            placement.getLocation(testTeamId),
            placement.listFiles(testTeamId),
          ];
          for (const p of promises) {
            expect(p instanceof Promise).toBe(true);
          }
          // Await all to prevent unhandled rejections during cleanup
          await Promise.allSettled(promises);
          
          // Await bootstrap to ensure directory creation completes before cleanup
          const bootstrapPromise = placement.bootstrap(testTeamId, 'arch', {});
          expect(bootstrapPromise instanceof Promise).toBe(true);
          await bootstrapPromise;
        });
      });
    });
  });
});
