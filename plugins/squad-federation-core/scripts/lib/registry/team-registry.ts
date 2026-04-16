/**
 * Team Registry — Centralized team discovery and management.
 * 
 * Replaces git worktree list as the source of truth for team discovery.
 * Stores team entries in .squad/teams.json with file-based locking for concurrent safety.
 * 
 * @module team-registry
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import { OTelEmitter } from '../../../sdk/otel-emitter.js';

// ==================== Types & Schema ====================

/**
 * Team entry in the registry — core metadata for a federated team.
 */
export interface TeamEntry {
  /** Domain name (e.g., "frontend", "backend", "api") */
  domain: string;
  /** Unique team identifier (UUID or slug) */
  domainId: string;
  /** Archetype identifier for this team */
  archetypeId: string;
  /**
   * Placement type (where files live).
   * @since v0.4.0
   */
  placementType: 'worktree' | 'directory';
  /** Absolute path to team workspace or remote URL */
  location: string;
  /** ISO 8601 timestamp when team was registered */
  createdAt: string;
  /** Team lifecycle status. @default 'active' @since v0.5.0 */
  status?: 'active' | 'paused' | 'retired';
  /** ISO 8601 timestamp when team was paused. @since v0.5.0 */
  pausedAt?: string;
  /** ISO 8601 timestamp when team was retired. @since v0.5.0 */
  retiredAt?: string;
  /** Federation metadata (optional) */
  federation?: {
    /** Parent team identifier (e.g., "meta-squad") */
    parent: string;
    /** Parent team location path */
    parentLocation: string;
    /** Team role in federation hierarchy */
    role: 'team' | 'meta';
  };
  /** Additional metadata (placement-specific config, etc.) */
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
  placementType: z.enum(['worktree', 'directory']),
  location: z.string().min(1),
  createdAt: z.string().datetime(),
  status: z.enum(['active', 'paused', 'retired']).optional().default('active'),
  pausedAt: z.string().datetime().optional(),
  retiredAt: z.string().datetime().optional(),
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
 *   placementType: 'worktree',
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
  private emitter: OTelEmitter;

  /**
   * Create a new TeamRegistry instance.
   * 
   * @param repoRoot - Absolute path to repository root
   * @param emitter - Optional OTel emitter for instrumentation
   */
  constructor(repoRoot: string, emitter?: OTelEmitter) {
    const squadDir = path.join(repoRoot, '.squad');
    this.registryPath = path.join(squadDir, 'teams.json');
    this.lockPath = `${this.registryPath}.lock`;
    this.emitter = emitter || new OTelEmitter();
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
    await this.emitter.span(
      'registry.register',
      async () => {
        // Validate entry
        const validatedEntry = TeamEntrySchema.parse(entry);

        await this.withLock(async () => {
          const registry = await this.load();
          
          // Check for duplicate domain or domainId
          const existingTeam = registry.teams.find(
            (t) => t.domainId === validatedEntry.domainId || t.domain === validatedEntry.domain
          );
          if (existingTeam) {
            const conflictField = existingTeam.domainId === validatedEntry.domainId ? 'domainId' : 'domain';
            throw new Error(
              `Team with ${conflictField} "${conflictField === 'domainId' ? validatedEntry.domainId : validatedEntry.domain}" already registered.\n` +
              `Existing team: ${existingTeam.domain || 'unknown'}\n` +
              `Recovery:\n` +
              `  1. Check existing teams:\n` +
              `     cat .squad/teams.json\n` +
              `  2. If duplicate is a mistake, remove it manually:\n` +
              `     vim .squad/teams.json  # Remove duplicate entry\n` +
              `  3. Or use a different domain ID:\n` +
              `     npx tsx scripts/onboard.ts --name <name> --domain-id <unique-id> --archetype <arch>\n` +
              `  4. List all teams to see conflicts:\n` +
              `     npx tsx scripts/monitor.ts\n` +
              `  5. If teams.json is corrupted, restore from git:\n` +
              `     git checkout HEAD -- .squad/teams.json`
            );
          }

          registry.teams.push(validatedEntry);
          await this.save(registry);

          // Emit event for team registered
          await this.emitter.event('team.registered', {
            'squad.domain': validatedEntry.domain,
            'domain.id': validatedEntry.domainId,
            'placement.type': validatedEntry.placementType
          });
        });
      },
      {
        'squad.domain': entry.domain,
        'placement.type': entry.placementType
      }
    );
  }

  /**
   * Unregister a team from the registry.
   * 
   * @param domainId - Team identifier to remove
   * @returns True if team was found and removed, false otherwise
   */
  async unregister(domainOrId: string): Promise<boolean> {
    let removed = false;

    await this.emitter.span(
      'registry.unregister',
      async () => {
        removed = await this.withLock(async () => {
          const registry = await this.load();
          const initialLength = registry.teams.length;
          
          // Find the team before removing for telemetry
          const team = registry.teams.find(
            t => t.domainId === domainOrId || t.domain === domainOrId
          );
          
          registry.teams = registry.teams.filter(
            t => t.domainId !== domainOrId && t.domain !== domainOrId
          );
          
          if (registry.teams.length < initialLength) {
            await this.save(registry);

            // Emit event for team unregistered
            if (team) {
              await this.emitter.event('team.unregistered', {
                'squad.domain': team.domain,
                'domain.id': team.domainId,
                'placement.type': team.placementType
              });
            }

            return true;
          }
          return false;
        });
      },
      {
        'domain.id': domainOrId
      }
    );

    return removed;
  }

  /**
   * Get a team entry by domain or domainId.
   * 
   * @param domainOrId - Team identifier to lookup
   * @returns Team entry if found, null otherwise
   */
  async get(domainOrId: string): Promise<TeamEntry | null> {
    const registry = await this.load();
    return registry.teams.find(t => t.domainId === domainOrId || t.domain === domainOrId) ?? null;
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
   * Update a team entry with partial changes.
   * 
   * @param domainOrId - Team identifier (domain or domainId) to update
   * @param updates - Partial team entry with fields to update
   * @returns True if team was found and updated, false otherwise
   * @throws {z.ZodError} If updated entry fails validation
   */
  async update(domainOrId: string, updates: Partial<TeamEntry>): Promise<boolean> {
    let updatedResult = false;

    await this.emitter.span(
      'registry.update',
      async () => {
        updatedResult = await this.withLock(async () => {
          const registry = await this.load();
          const index = registry.teams.findIndex(
            t => t.domainId === domainOrId || t.domain === domainOrId
          );
          
          if (index === -1) return false;

          // Merge updates and validate result
          const updated = { ...registry.teams[index], ...updates };
          TeamEntrySchema.parse(updated);

          registry.teams[index] = updated;
          await this.save(registry);

          // Emit event for team updated
          await this.emitter.event('team.updated', {
            'squad.domain': updated.domain,
            'domain.id': updated.domainId,
            'placement.type': updated.placementType
          });

          return true;
        });
      },
      {
        'domain.id': domainOrId
      }
    );

    return updatedResult;
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

  async updateStatus(domainOrId: string, status: 'active' | 'paused' | 'retired'): Promise<boolean> {
    let result = false;
    await this.emitter.span('registry.updateStatus', async () => {
      result = await this.withLock(async () => {
        const registry = await this.load();
        const index = registry.teams.findIndex(t => t.domainId === domainOrId || t.domain === domainOrId);
        if (index === -1) return false;
        const team = registry.teams[index];
        const currentStatus = team.status ?? 'active';
        if (currentStatus === status) throw new Error(`Team "${team.domain}" is already ${status}`);
        if (currentStatus === 'retired') throw new Error(`Team "${team.domain}" is retired and cannot change status`);
        if (status === 'active' && currentStatus !== 'paused') throw new Error(`Only paused teams can be resumed to active (current: ${currentStatus})`);
        const now = new Date().toISOString();
        const updates: Partial<TeamEntry> = { status };
        if (status === 'paused') updates.pausedAt = now;
        else if (status === 'retired') updates.retiredAt = now;
        else if (status === 'active') updates.pausedAt = undefined;
        const updated = { ...team, ...updates };
        if (updates.pausedAt === undefined) delete updated.pausedAt;
        TeamEntrySchema.parse(updated);
        registry.teams[index] = updated;
        await this.save(registry);
        await this.emitter.event('team.status.changed', {
          'squad.domain': updated.domain, 'domain.id': updated.domainId,
          'old.status': currentStatus, 'new.status': status,
        });
        return true;
      });
    }, { 'domain.id': domainOrId, 'target.status': status });
    return result;
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
        throw new Error(
          `Registry file corrupted: ${this.registryPath}\n` +
          `Recovery:\n` +
          `  1. Backup the corrupted file:\n` +
          `     cp .squad/teams.json .squad/teams.json.backup\n` +
          `  2. Try to fix JSON syntax:\n` +
          `     cat .squad/teams.json  # Look for syntax errors\n` +
          `  3. Restore from git if available:\n` +
          `     git checkout HEAD -- .squad/teams.json\n` +
          `  4. Or reset registry (will lose team registrations):\n` +
          `     rm .squad/teams.json\n` +
          `     echo '{"version":"1.0","teams":[]}' > .squad/teams.json\n` +
          `  5. Re-onboard teams if reset:\n` +
          `     npx tsx scripts/onboard.ts --name <name> --domain-id <id> --archetype <arch>\n` +
          `  6. Validation errors: ${error instanceof z.ZodError ? error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') : 'Invalid JSON'}`
        );
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

}
