/**
 * DirectoryPlacement — Base filesystem placement implementation.
 * 
 * Provides TeamPlacement interface implementation for arbitrary directory paths.
 * This is the foundation placement that WorktreePlacement will extend.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import type { TeamPlacement } from '../../sdk/types';
import { OTelEmitter } from '../../sdk/otel-emitter.js';

/**
 * DirectoryPlacement implementation.
 * 
 * Implements TeamPlacement for filesystem-based operations at any directory path.
 * WorktreePlacement will extend this class and add git operations.
 */
export class DirectoryPlacement implements TeamPlacement {
  protected readonly emitter: OTelEmitter;

  /**
   * Create a new DirectoryPlacement.
   * @param basePathMap - Map of teamId to base directory path
   * @param emitter - Optional OTel emitter for instrumentation
   */
  constructor(
    private readonly basePathMap: Map<string, string>,
    emitter?: OTelEmitter
  ) {
    this.emitter = emitter || new OTelEmitter();
  }

  /**
   * Get absolute path for a team's workspace.
   */
  private getTeamPath(teamId: string): string {
    const basePath = this.basePathMap.get(teamId);
    if (!basePath) {
      throw new Error(`Team not found: ${teamId}`);
    }
    return basePath;
  }

  /**
   * Get absolute path for a file within team workspace.
   */
  private getFilePath(teamId: string, filePath: string): string {
    const basePath = this.getTeamPath(teamId);
    return path.join(basePath, filePath);
  }

  /**
   * Read a file from team workspace.
   */
  async readFile(teamId: string, filePath: string): Promise<string | null> {
    try {
      const fullPath = this.getFilePath(teamId, filePath);
      return await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw new Error(
        `Failed to read file ${filePath} for team ${teamId}: ${(error as Error).message}\n` +
        `Recovery:\n` +
        `  1. Check if file path exists:\n` +
        `     ls -la ${this.getFilePath(teamId, filePath)}\n` +
        `  2. Verify team directory exists:\n` +
        `     ls -la ${this.getTeamPath(teamId)}\n` +
        `  3. Check file permissions:\n` +
        `     ls -la $(dirname ${this.getFilePath(teamId, filePath)})\n` +
        `  4. If directory doesn't exist, create it:\n` +
        `     mkdir -p ${this.getTeamPath(teamId)}\n` +
        `  5. Verify correct team ID:\n` +
        `     ls -la $(dirname ${this.getTeamPath(teamId)})/\n` +
        `  6. Check file system:\n` +
        `     df -h`
      );
    }
  }

  /**
   * Write a file to team workspace.
   */
  async writeFile(teamId: string, filePath: string, content: string): Promise<void> {
    try {
      const fullPath = this.getFilePath(teamId, filePath);
      const dirPath = path.dirname(fullPath);
      
      // Ensure parent directories exist
      await fs.mkdir(dirPath, { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
    } catch (error) {
      const fullPath = this.getFilePath(teamId, filePath);
      throw new Error(
        `Failed to write file ${filePath} for team ${teamId}: ${(error as Error).message}\n` +
        `Recovery:\n` +
        `  1. Check disk space:\n` +
        `     df -h\n` +
        `  2. Verify parent directory is writable:\n` +
        `     ls -la $(dirname ${fullPath})\n` +
        `  3. Check team directory exists:\n` +
        `     ls -la ${this.getTeamPath(teamId)}\n` +
        `  4. Ensure proper permissions:\n` +
        `     chmod -R u+w ${this.getTeamPath(teamId)}\n` +
        `  5. If directory doesn't exist, create it:\n` +
        `     mkdir -p $(dirname ${fullPath})\n` +
        `  6. Check for file locks:\n` +
        `     lsof ${fullPath}\n` +
        `  7. Verify file path is valid (no special characters):\n` +
        `     echo "${filePath}"`
      );
    }
  }

  /**
   * Check if a file exists in team workspace.
   */
  async exists(teamId: string, filePath: string): Promise<boolean> {
    try {
      const fullPath = this.getFilePath(teamId, filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file/directory metadata.
   */
  async stat(teamId: string, filePath: string): Promise<{ isDirectory: boolean; size: number } | null> {
    try {
      const fullPath = this.getFilePath(teamId, filePath);
      const stats = await fs.stat(fullPath);
      return {
        isDirectory: stats.isDirectory(),
        size: stats.size
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw new Error(`Failed to stat ${filePath} for team ${teamId}: ${(error as Error).message}`);
    }
  }

  /**
   * Check if team workspace exists.
   */
  async workspaceExists(teamId: string): Promise<boolean> {
    try {
      const basePath = this.getTeamPath(teamId);
      await fs.access(basePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get workspace absolute path.
   */
  async getLocation(teamId: string): Promise<string> {
    return this.getTeamPath(teamId);
  }

  /**
   * List all files in workspace directory.
   */
  async listFiles(teamId: string, directory: string = ''): Promise<string[]> {
    try {
      const dirPath = this.getFilePath(teamId, directory);
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      const files: string[] = [];
      for (const entry of entries) {
        const relativePath = directory ? `${directory}/${entry.name}` : entry.name;
        
        if (entry.isDirectory()) {
          // Recursively list subdirectory
          const subFiles = await this.listFiles(teamId, relativePath);
          files.push(...subFiles);
        } else {
          files.push(relativePath);
        }
      }

      return files;
    } catch (error) {
      throw new Error(`Failed to list files for team ${teamId} in ${directory}: ${(error as Error).message}`);
    }
  }

  /**
   * Bootstrap a new team workspace.
   */
  async bootstrap(teamId: string, archetypeId: string, config: Record<string, unknown>): Promise<void> {
    await this.emitter.span(
      'placement.bootstrap',
      async () => {
        try {
          const basePath = this.getTeamPath(teamId);
          
          // Create workspace directory
          await fs.mkdir(basePath, { recursive: true });

          // Create .squad directory structure
          await fs.mkdir(path.join(basePath, '.squad/signals/inbox'), { recursive: true });
          await fs.mkdir(path.join(basePath, '.squad/signals/outbox'), { recursive: true });
          await fs.mkdir(path.join(basePath, '.squad/learnings'), { recursive: true });

          // Initialize status.json with minimal bootstrap state
          const initialStatus = {
            domain: teamId,
            domain_id: teamId,
            state: 'initialized',
            step: 'bootstrap',
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            archetype_id: archetypeId
          };
          
          await this.writeFile(teamId, '.squad/status.json', JSON.stringify(initialStatus, null, 2));

          // Create empty learning log
          await this.writeFile(teamId, '.squad/learnings/log.jsonl', '');

          // Write config if provided
          if (Object.keys(config).length > 0) {
            await this.writeFile(teamId, '.squad/config.json', JSON.stringify(config, null, 2));
          }

          // Emit event for team bootstrapped
          await this.emitter.event('team.bootstrapped', {
            'squad.domain': teamId,
            'archetype.id': archetypeId
          });
        } catch (error) {
          throw new Error(`Failed to bootstrap workspace for team ${teamId}: ${(error as Error).message}`);
        }
      },
      {
        'squad.domain': teamId,
        'archetype.id': archetypeId
      }
    );
  }
}
