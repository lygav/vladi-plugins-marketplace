/**
 * Team Registry — Centralized team discovery and management.
 * 
 * Replaces git worktree list as the source of truth for team discovery.
 * Stores team entries in .squad/teams.json with file-based locking for concurrent safety.
 * 
 * @module team-registry
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { execSync } from 'child_process';

// ==================== Types & Schema ====================

/**
 * Team entry in the registry — core metadata for a federated team.
 */
export interface TeamEntry {
  /** Domain name (e.g., "frontend", "backend", "api") */
  domain: string;
  /** Unique team identifier (UUID or slug) */
  domainId: string;
  /** Archetype identifier (e.g., "codebase-scanner", "api-reviewer") */
  archetypeId: string;
  /** Transport type for team workspace access */
  transport: 'worktree' | 'directory' | 'remote';
  /** Absolute path to team workspace or remote URL */
  location: string;
  /** ISO 8601 timestamp when team was registered */
  createdAt: string;
  /** Federation metadata (optional) */
  federation?: {
    /** Parent team identifier (e.g., "meta-squad") */
    parent: string;
    /** Parent team location path */
    parentLocation: string;
    /** Team role in federation hierarchy */
    role: 'team' | 'meta';
  };
  /** Additional metadata (transport-specific config, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * Registry file structure — stored at .squad/teams.json
 */
interface RegistryFile {
  version: string;
  teams: TeamEntry[];
}

/**
 * Zod schema for TeamEntry validation
 */
const TeamEntrySchema = z.object({
  domain: z.string().min(1),
  domainId: z.string().min(1),
  archetypeId: z.string().min(1),
  transport: z.enum(['worktree', 'directory', 'remote']),
  location: z.string().min(1),
  createdAt: z.string().datetime(),
  federation: z.object({
    parent: z.string(),
    parentLocation: z.string(),
    role: z.enum(['team', 'meta']),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Zod schema for RegistryFile validation
 */
const RegistryFileSchema = z.object({
  version: z.string(),
  teams: z.array(TeamEntrySchema),
});

// ==================== TeamRegistry Class ====================

/**
 * TeamRegistry — Centralized team discovery and management.
 * 
 * Provides thread-safe CRUD operations for team entries with file-based locking.
 * 
 * @example
 * ```typescript
 * const registry = new TeamRegistry('/path/to/repo');
 * await registry.register({
 *   domain: 'frontend',
 *   domainId: 'frontend-123',
 *   archetypeId: 'codebase-scanner',
 *   transport: 'worktree',
 *   location: '/path/to/.worktrees/frontend',
 *   createdAt: new Date().toISOString(),
 * });
 * const teams = await registry.list();
 * ```
 */
export class TeamRegistry {
  private registryPath: string;
  private lockPath: string;
  private lockTimeout = 5000; // 5 seconds

  /**
   * Create a new TeamRegistry instance.
   * 
   * @param repoRoot - Absolute path to repository root
   */
  constructor(repoRoot: string) {
    const squadDir = path.join(repoRoot, '.squad');
    this.registryPath = path.join(squadDir, 'teams.json');
    this.lockPath = `${this.registryPath}.lock`;
  }

  // ==================== Public API ====================

  /**
   * Register a new team in the registry.
   * 
   * @param entry - Team entry to register
   * @throws {Error} If team with same domainId already exists
   * @throws {z.ZodError} If entry fails validation
   */
  async register(entry: TeamEntry): Promise<void> {
    // Validate entry
    TeamEntrySchema.parse(entry);

    await this.withLock(async () => {
      const registry = await this.load();
      
      // Check for duplicate
      if (registry.teams.some(t => t.domainId === entry.domainId)) {
        throw new Error(`Team with domainId "${entry.domainId}" already registered`);
      }

      registry.teams.push(entry);
      await this.save(registry);
    });
  }

  /**
   * Unregister a team from the registry.
   * 
   * @param domainId - Team identifier to remove
   * @returns True if team was found and removed, false otherwise
   */
  async unregister(domainId: string): Promise<boolean> {
    return await this.withLock(async () => {
      const registry = await this.load();
      const initialLength = registry.teams.length;
      
      registry.teams = registry.teams.filter(t => t.domainId !== domainId);
      
      if (registry.teams.length < initialLength) {
        await this.save(registry);
        return true;
      }
      return false;
    });
  }

  /**
   * Get a team entry by domainId.
   * 
   * @param domainId - Team identifier to lookup
   * @returns Team entry if found, null otherwise
   */
  async get(domainId: string): Promise<TeamEntry | null> {
    const registry = await this.load();
    return registry.teams.find(t => t.domainId === domainId) ?? null;
  }

  /**
   * List all registered teams.
   * 
   * @returns Array of all team entries
   */
  async list(): Promise<TeamEntry[]> {
    const registry = await this.load();
    return [...registry.teams]; // Return copy to prevent mutation
  }

  /**
   * List teams filtered by transport type.
   * 
   * @param transportType - Transport type to filter by
   * @returns Array of matching team entries
   */
  async listByTransport(transportType: TeamEntry['transport']): Promise<TeamEntry[]> {
    const registry = await this.load();
    return registry.teams.filter(t => t.transport === transportType);
  }

  /**
   * Update a team entry with partial changes.
   * 
   * @param domainId - Team identifier to update
   * @param updates - Partial team entry with fields to update
   * @returns True if team was found and updated, false otherwise
   * @throws {z.ZodError} If updated entry fails validation
   */
  async update(domainId: string, updates: Partial<TeamEntry>): Promise<boolean> {
    return await this.withLock(async () => {
      const registry = await this.load();
      const index = registry.teams.findIndex(t => t.domainId === domainId);
      
      if (index === -1) return false;

      // Merge updates and validate result
      const updated = { ...registry.teams[index], ...updates };
      TeamEntrySchema.parse(updated);

      registry.teams[index] = updated;
      await this.save(registry);
      return true;
    });
  }

  /**
   * Check if a team exists in the registry.
   * 
   * @param domainId - Team identifier to check
   * @returns True if team exists, false otherwise
   */
  async exists(domainId: string): Promise<boolean> {
    const registry = await this.load();
    return registry.teams.some(t => t.domainId === domainId);
  }

  /**
   * Migrate from git worktree discovery to registry.
   * 
   * Scans existing worktrees and registers them in the team registry.
   * Safe to run multiple times — skips already-registered teams.
   * 
   * @param repoRoot - Absolute path to repository root
   * @returns Number of teams migrated
   */
  async migrateFromWorktreeDiscovery(repoRoot: string): Promise<number> {
    let migrated = 0;

    try {
      // Parse git worktree list output
      const output = execSync('git worktree list --porcelain', {
        cwd: repoRoot,
        encoding: 'utf-8',
      });

      const worktrees = this.parseWorktreeList(output);

      for (const wt of worktrees) {
        // Skip if not a squad worktree (no .squad/team.md)
        const teamMdPath = path.join(wt.path, '.squad', 'team.md');
        if (!fsSync.existsSync(teamMdPath)) continue;

        // Skip if already registered
        if (await this.exists(wt.domain)) continue;

        // Read team.md to extract metadata
        const teamMd = await fs.readFile(teamMdPath, 'utf-8');
        const metadata = this.parseTeamMd(teamMd);

        // Register team
        await this.register({
          domain: wt.domain,
          domainId: wt.domain, // Use domain as ID for v0.1.0 compatibility
          archetypeId: metadata.archetypeId || 'unknown',
          transport: 'worktree',
          location: wt.path,
          createdAt: new Date().toISOString(),
          federation: metadata.federation,
          metadata: {
            branch: wt.branch,
            migrated: true,
            migratedAt: new Date().toISOString(),
          },
        });

        migrated++;
      }
    } catch (error) {
      // If git worktree list fails, return 0 (no worktrees or not a git repo)
      if (error instanceof Error && error.message.includes('not a git repository')) {
        return 0;
      }
      throw error;
    }

    return migrated;
  }

  // ==================== Private Helpers ====================

  /**
   * Load registry from disk. Creates empty registry if file doesn't exist.
   */
  private async load(): Promise<RegistryFile> {
    try {
      const content = await fs.readFile(this.registryPath, 'utf-8');
      const data = JSON.parse(content);
      return RegistryFileSchema.parse(data);
    } catch (error) {
      // File doesn't exist or is corrupted — return empty registry
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { version: '1.0', teams: [] };
      }
      
      // Validation error or corrupt JSON
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        throw new Error(`Registry file corrupted: ${this.registryPath}. Backup and delete to reset.`);
      }
      
      throw error;
    }
  }

  /**
   * Save registry to disk atomically (write to temp, then rename).
   */
  private async save(registry: RegistryFile): Promise<void> {
    // Validate before saving
    RegistryFileSchema.parse(registry);

    // Ensure .squad directory exists
    const squadDir = path.dirname(this.registryPath);
    await fs.mkdir(squadDir, { recursive: true });

    // Atomic write: temp file + rename
    const tempPath = `${this.registryPath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(registry, null, 2), 'utf-8');
    await fs.rename(tempPath, this.registryPath);
  }

  /**
   * Execute a function with file lock for concurrent safety.
   * 
   * Uses a simple lock file approach with timeout.
   */
  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      throw new Error(`Failed to acquire lock on registry after ${this.lockTimeout}ms`);
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Acquire lock file with timeout.
   * Uses atomic exclusive write (wx flag) to prevent TOCTOU race conditions.
   */
  private async acquireLock(): Promise<boolean> {
    const startTime = Date.now();
    const maxRetries = 10;
    let retries = 0;
    
    while (Date.now() - startTime < this.lockTimeout && retries < maxRetries) {
      try {
        // Atomic exclusive create — fails if file exists
        const lockData = JSON.stringify({ pid: process.pid, ts: Date.now() });
        await fs.writeFile(this.lockPath, lockData, { flag: 'wx' });
        return true;
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'EEXIST') {
          // Check if lock is stale (>5s old)
          try {
            const stat = await fs.stat(this.lockPath);
            const lockAge = Date.now() - stat.mtimeMs;
            
            if (lockAge > 5000) {
              // Lock is stale — try to remove it atomically
              // Use unlink which will fail if file doesn't exist (race-safe)
              await fs.unlink(this.lockPath).catch(() => {
                // Another process may have already removed it, that's OK
              });
              // Retry immediately after removing stale lock
              retries++;
              continue;
            }
          } catch (statErr) {
            // Lock file disappeared between EEXIST and stat — that's OK
            // Another process removed it, retry immediately
            retries++;
            continue;
          }
          
          // Lock is not stale — wait and retry
          await this.sleep(200);
          retries++;
          continue;
        }
        throw error;
      }
    }
    
    return false;
  }

  /**
   * Release lock file.
   */
  private async releaseLock(): Promise<void> {
    try {
      await fs.unlink(this.lockPath);
    } catch (error) {
      // Ignore if lock file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Sleep for a given number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Parse git worktree list --porcelain output.
   */
  private parseWorktreeList(output: string): Array<{ path: string; branch: string; domain: string }> {
    const worktrees: Array<{ path: string; branch: string; domain: string }> = [];
    const lines = output.split('\n');
    
    let currentWorktree: Partial<{ path: string; branch: string }> = {};
    
    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        currentWorktree.path = line.substring('worktree '.length);
      } else if (line.startsWith('branch ')) {
        currentWorktree.branch = line.substring('branch '.length).replace(/^refs\/heads\//, '');
      } else if (line === '' && currentWorktree.path) {
        // End of worktree entry
        if (currentWorktree.path && currentWorktree.branch) {
          // Extract domain from branch name (e.g., "squad/frontend" -> "frontend")
          const branchParts = currentWorktree.branch.split('/');
          const domain = branchParts.length > 1 ? branchParts[branchParts.length - 1] : currentWorktree.branch;
          
          worktrees.push({
            path: currentWorktree.path,
            branch: currentWorktree.branch,
            domain,
          });
        }
        currentWorktree = {};
      }
    }
    
    // Handle last entry
    if (currentWorktree.path && currentWorktree.branch) {
      const branchParts = currentWorktree.branch.split('/');
      const domain = branchParts.length > 1 ? branchParts[branchParts.length - 1] : currentWorktree.branch;
      worktrees.push({
        path: currentWorktree.path,
        branch: currentWorktree.branch,
        domain,
      });
    }
    
    return worktrees;
  }

  /**
   * Parse team.md frontmatter to extract metadata.
   */
  private parseTeamMd(content: string): {
    archetypeId?: string;
    federation?: TeamEntry['federation'];
  } {
    const result: ReturnType<TeamRegistry['parseTeamMd']> = {};
    
    // Simple frontmatter extraction (between --- markers)
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return result;
    
    const frontmatter = frontmatterMatch[1];
    
    // Extract archetype
    const archetypeMatch = frontmatter.match(/archetype:\s*(.+)/);
    if (archetypeMatch) {
      result.archetypeId = archetypeMatch[1].trim();
    }
    
    // Extract federation metadata
    const parentMatch = frontmatter.match(/parent:\s*(.+)/);
    const roleMatch = frontmatter.match(/role:\s*(.+)/);
    
    if (parentMatch && roleMatch) {
      result.federation = {
        parent: parentMatch[1].trim(),
        parentLocation: '', // Not available in team.md
        role: roleMatch[1].trim() as 'team' | 'meta',
      };
    }
    
    return result;
  }
}
