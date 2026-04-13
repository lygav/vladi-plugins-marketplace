/**
 * DirectoryTransport — Base filesystem transport implementation.
 * 
 * Provides TeamTransport interface implementation for arbitrary directory paths.
 * This is the foundation transport that WorktreeTransport will extend.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { z } from 'zod';
import type {
  TeamTransport,
  ScanStatus,
  SignalMessage,
  LearningEntry
} from '../../sdk/types';

/**
 * Zod schema for ScanStatus validation.
 */
const ScanStatusSchema = z.object({
  domain: z.string(),
  domain_id: z.string(),
  state: z.string(),
  step: z.string(),
  started_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().optional(),
  progress_pct: z.number().optional(),
  error: z.string().optional(),
  agent_active: z.string().optional(),
  archetype_id: z.string()
});

/**
 * Zod schema for SignalMessage validation.
 */
const SignalMessageSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  from: z.string(),
  to: z.string(),
  type: z.enum(['directive', 'question', 'report', 'alert']),
  subject: z.string(),
  body: z.string(),
  protocol: z.string(),
  acknowledged: z.boolean().optional(),
  acknowledged_at: z.string().optional()
});

/**
 * Zod schema for LearningEntry validation.
 */
const LearningEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  type: z.enum(['discovery', 'correction', 'pattern', 'technique', 'gotcha']),
  content: z.string(),
  confidence: z.enum(['low', 'medium', 'high']),
  tags: z.array(z.string()).optional(),
  graduated: z.boolean().optional(),
  graduated_to: z.string().optional(),
  supersedes: z.string().optional()
});

/**
 * DirectoryTransport implementation.
 * 
 * Implements TeamTransport for filesystem-based operations at any directory path.
 * WorktreeTransport will extend this class and add git operations.
 */
export class DirectoryTransport implements TeamTransport {
  /**
   * Create a new DirectoryTransport.
   * @param basePathMap - Map of teamId to base directory path
   */
  constructor(private readonly basePathMap: Map<string, string>) {}

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
   * Slugify a string for use in filenames.
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
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
      throw new Error(`Failed to read file ${filePath} for team ${teamId}: ${(error as Error).message}`);
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
      throw new Error(`Failed to write file ${filePath} for team ${teamId}: ${(error as Error).message}`);
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
   * Read team status from .squad/signals/status.json.
   */
  async readStatus(teamId: string): Promise<ScanStatus | null> {
    try {
      const content = await this.readFile(teamId, '.squad/signals/status.json');
      if (!content) {
        return null;
      }

      const parsed = JSON.parse(content);
      return ScanStatusSchema.parse(parsed);
    } catch (error) {
      if ((error as Error).message.includes('Failed to read file')) {
        return null;
      }
      throw new Error(`Failed to read status for team ${teamId}: ${(error as Error).message}`);
    }
  }

  /**
   * Read signal messages from inbox.
   */
  async readInboxSignals(teamId: string): Promise<SignalMessage[]> {
    return this.readSignals(teamId, 'inbox');
  }

  /**
   * Write signal message to inbox.
   */
  async writeInboxSignal(teamId: string, signal: SignalMessage): Promise<void> {
    await this.writeSignal(teamId, 'inbox', signal);
  }

  /**
   * Read signal messages from outbox.
   */
  async readOutboxSignals(teamId: string): Promise<SignalMessage[]> {
    return this.readSignals(teamId, 'outbox');
  }

  /**
   * Read signal messages from specified direction.
   */
  private async readSignals(teamId: string, direction: 'inbox' | 'outbox'): Promise<SignalMessage[]> {
    try {
      const signalsDir = `.squad/signals/${direction}`;
      const fullPath = this.getFilePath(teamId, signalsDir);

      try {
        await fs.access(fullPath);
      } catch {
        // Directory doesn't exist, return empty array
        return [];
      }

      const files = await fs.readdir(fullPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      const signals: SignalMessage[] = [];
      for (const file of jsonFiles) {
        const content = await fs.readFile(path.join(fullPath, file), 'utf-8');
        const parsed = JSON.parse(content);
        const validated = SignalMessageSchema.parse(parsed);
        signals.push(validated);
      }

      return signals;
    } catch (error) {
      throw new Error(`Failed to read ${direction} signals for team ${teamId}: ${(error as Error).message}`);
    }
  }

  /**
   * Write signal message to specified direction.
   */
  private async writeSignal(teamId: string, direction: 'inbox' | 'outbox', signal: SignalMessage): Promise<void> {
    try {
      // Validate signal
      SignalMessageSchema.parse(signal);

      // Generate filename: {timestamp}-{type}-{subject-slug}.json
      const timestamp = signal.timestamp.replace(/[:.]/g, '-');
      const subjectSlug = this.slugify(signal.subject);
      const filename = `${timestamp}-${signal.type}-${subjectSlug}.json`;

      const signalPath = `.squad/signals/${direction}/${filename}`;
      await this.writeFile(teamId, signalPath, JSON.stringify(signal, null, 2));
    } catch (error) {
      throw new Error(`Failed to write ${direction} signal for team ${teamId}: ${(error as Error).message}`);
    }
  }

  /**
   * Read learning log entries.
   */
  async readLearningLog(teamId: string): Promise<LearningEntry[]> {
    try {
      const content = await this.readFile(teamId, '.squad/learning-log.jsonl');
      if (!content) {
        return [];
      }

      const lines = content.trim().split('\n').filter(line => line.trim());
      const entries: LearningEntry[] = [];

      for (const line of lines) {
        const parsed = JSON.parse(line);
        const validated = LearningEntrySchema.parse(parsed);
        entries.push(validated);
      }

      return entries;
    } catch (error) {
      if ((error as Error).message.includes('Failed to read file')) {
        return [];
      }
      throw new Error(`Failed to read learning log for team ${teamId}: ${(error as Error).message}`);
    }
  }

  /**
   * Append entry to learning log.
   */
  async appendLearning(teamId: string, entry: LearningEntry): Promise<void> {
    try {
      // Validate entry
      LearningEntrySchema.parse(entry);

      const line = JSON.stringify(entry) + '\n';
      const logPath = this.getFilePath(teamId, '.squad/learning-log.jsonl');
      const dirPath = path.dirname(logPath);

      // Ensure parent directories exist
      await fs.mkdir(dirPath, { recursive: true });

      // Append to file
      await fs.appendFile(logPath, line, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to append learning for team ${teamId}: ${(error as Error).message}`);
    }
  }

  /**
   * List signals with optional filtering.
   */
  async listSignals(
    teamId: string,
    direction: 'inbox' | 'outbox',
    filter?: {
      type?: string;
      since?: string;
      from?: string;
    }
  ): Promise<SignalMessage[]> {
    try {
      let signals = await this.readSignals(teamId, direction);

      if (filter) {
        if (filter.type) {
          signals = signals.filter(s => s.type === filter.type);
        }
        if (filter.since) {
          signals = signals.filter(s => s.timestamp >= filter.since!);
        }
        if (filter.from) {
          signals = signals.filter(s => s.from === filter.from);
        }
      }

      return signals;
    } catch (error) {
      throw new Error(`Failed to list ${direction} signals for team ${teamId}: ${(error as Error).message}`);
    }
  }

  /**
   * Watch signals for real-time updates using fs.watch().
   */
  watchSignals(
    teamId: string,
    direction: 'inbox' | 'outbox',
    callback: (signal: SignalMessage) => void
  ): () => void {
    const signalsDir = this.getFilePath(teamId, `.squad/signals/${direction}`);
    
    // Track seen files to avoid duplicate callbacks
    const seenFiles = new Set<string>();

    const watcher = fs.watch(signalsDir, async (eventType, filename) => {
      if (!filename || !filename.endsWith('.json')) {
        return;
      }

      // Only process new files (rename event indicates file creation in many systems)
      if (eventType === 'rename' && !seenFiles.has(filename)) {
        seenFiles.add(filename);
        
        try {
          const filePath = path.join(signalsDir, filename);
          const content = await fs.readFile(filePath, 'utf-8');
          const parsed = JSON.parse(content);
          const signal = SignalMessageSchema.parse(parsed);
          callback(signal);
        } catch (error) {
          // Silently ignore parse/validation errors for watch events
          console.error(`Failed to process signal ${filename}:`, error);
        }
      }
    });

    // Return unsubscribe function
    return () => {
      watcher.close();
    };
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
    try {
      const basePath = this.getTeamPath(teamId);
      
      // Create workspace directory
      await fs.mkdir(basePath, { recursive: true });

      // Create .squad directory structure
      await fs.mkdir(path.join(basePath, '.squad/signals/inbox'), { recursive: true });
      await fs.mkdir(path.join(basePath, '.squad/signals/outbox'), { recursive: true });

      // Initialize status.json
      const initialStatus: ScanStatus = {
        domain: teamId,
        domain_id: teamId,
        state: 'initialized',
        step: 'bootstrap',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        archetype_id: archetypeId
      };
      
      await this.writeFile(teamId, '.squad/signals/status.json', JSON.stringify(initialStatus, null, 2));

      // Create empty learning log
      await this.writeFile(teamId, '.squad/learning-log.jsonl', '');

      // Write config if provided
      if (Object.keys(config).length > 0) {
        await this.writeFile(teamId, '.squad/config.json', JSON.stringify(config, null, 2));
      }
    } catch (error) {
      throw new Error(`Failed to bootstrap workspace for team ${teamId}: ${(error as Error).message}`);
    }
  }
}
