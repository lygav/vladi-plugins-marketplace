/**
 * MockPlacement - in-memory TeamPlacement for testing
 * Provides fast, isolated placement implementation without filesystem operations
 */

import type { TeamPlacement } from '../../../sdk/types.js';

interface FileEntry {
  content: string;
  size: number;
  isDirectory: boolean;
}

/**
 * In-memory implementation of TeamPlacement for testing.
 * Uses Map storage to simulate filesystem operations.
 */
export class MockPlacement implements TeamPlacement {
  private teams = new Map<string, Map<string, FileEntry>>();

  async readFile(teamId: string, filePath: string): Promise<string | null> {
    const file = this.teams.get(teamId)?.get(filePath);
    if (!file || file.isDirectory) return null;
    return file.content;
  }

  async writeFile(teamId: string, filePath: string, content: string): Promise<void> {
    if (!this.teams.has(teamId)) {
      this.teams.set(teamId, new Map());
    }
    
    this.teams.get(teamId)!.set(filePath, {
      content,
      size: Buffer.byteLength(content, 'utf8'),
      isDirectory: false
    });
  }

  async exists(teamId: string, filePath: string): Promise<boolean> {
    return this.teams.get(teamId)?.has(filePath) || false;
  }

  async stat(teamId: string, filePath: string): Promise<{ isDirectory: boolean; size: number } | null> {
    const file = this.teams.get(teamId)?.get(filePath);
    if (!file) return null;
    
    return {
      isDirectory: file.isDirectory,
      size: file.size
    };
  }

  async getLocation(teamId: string): Promise<string> {
    return `/mock/${teamId}`;
  }

  async listFiles(teamId: string, directory?: string): Promise<string[]> {
    const teamFiles = this.teams.get(teamId);
    if (!teamFiles) return [];

    const prefix = directory ? `${directory}/` : '';
    const files: string[] = [];

    for (const path of teamFiles.keys()) {
      if (!directory || path.startsWith(prefix)) {
        // For directory filtering, only include direct children
        const relativePath = directory ? path.slice(prefix.length) : path;
        if (!relativePath.includes('/')) {
          files.push(path);
        }
      }
    }

    return files;
  }

  async bootstrap(teamId: string, archetypeId: string, config: Record<string, unknown>): Promise<void> {
    if (!this.teams.has(teamId)) {
      this.teams.set(teamId, new Map());
    }

    // Create standard squad directory structure
    await this.writeFile(teamId, '.squad/config.json', JSON.stringify({ archetypeId, ...config }, null, 2));
    
    // Add directory markers (empty files with isDirectory flag)
    const teamFiles = this.teams.get(teamId)!;
    teamFiles.set('.squad/signals/inbox', { content: '', size: 0, isDirectory: true });
    teamFiles.set('.squad/signals/outbox', { content: '', size: 0, isDirectory: true });
  }

  async workspaceExists(teamId: string): Promise<boolean> {
    return this.teams.has(teamId);
  }

  // Test helpers

  /**
   * Seed a team workspace with files for testing
   */
  seedTeam(teamId: string, files: Record<string, string>): void {
    if (!this.teams.has(teamId)) {
      this.teams.set(teamId, new Map());
    }

    const teamFiles = this.teams.get(teamId)!;
    for (const [path, content] of Object.entries(files)) {
      teamFiles.set(path, {
        content,
        size: Buffer.byteLength(content, 'utf8'),
        isDirectory: false
      });
    }
  }

  /**
   * Clear all teams and files
   */
  clear(): void {
    this.teams.clear();
  }

  /**
   * Get list of all team IDs
   */
  getTeams(): string[] {
    return Array.from(this.teams.keys());
  }

  /**
   * Get all files for a team (for debugging)
   */
  getTeamFiles(teamId: string): Record<string, string> {
    const teamFiles = this.teams.get(teamId);
    if (!teamFiles) return {};

    const result: Record<string, string> = {};
    for (const [path, file] of teamFiles.entries()) {
      if (!file.isDirectory) {
        result[path] = file.content;
      }
    }
    return result;
  }

  /**
   * Seed a team with a complete squad workspace structure
   */
  seedCompleteWorkspace(
    teamId: string,
    archetypeId: string,
    config?: Record<string, unknown>
  ): void {
    const fullConfig = {
      archetypeId,
      ...config
    };

    this.seedTeam(teamId, {
      '.squad/config.json': JSON.stringify(fullConfig, null, 2),
      '.squad/status.json': JSON.stringify({
        domain: teamId,
        domain_id: `${teamId}-id`,
        state: 'idle',
        step: 'waiting',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        archetype_id: archetypeId
      }, null, 2),
      '.squad/learning-log.jsonl': ''
    });

    // Add directory markers
    const teamFiles = this.teams.get(teamId)!;
    teamFiles.set('.squad/signals/inbox', { content: '', size: 0, isDirectory: true });
    teamFiles.set('.squad/signals/outbox', { content: '', size: 0, isDirectory: true });
  }
}

/**
 * Create a MockPlacement instance for testing
 */
export function createMockPlacement(): MockPlacement {
  return new MockPlacement();
}
