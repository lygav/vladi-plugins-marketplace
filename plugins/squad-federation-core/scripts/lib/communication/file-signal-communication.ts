/**
 * FileSignalCommunication — TeamCommunication implementation over filesystem.
 * 
 * Implements TeamCommunication interface by delegating all file I/O to TeamPlacement.
 * Works with any placement type (worktree, directory) — no direct filesystem access.
 * 
 * Signal/status/learning operations for file-based communication.
 * Same file formats: JSON signals in inbox/outbox dirs, JSONL learning log, status.json.
 * 
 * @since v0.4.0
 */

import { z } from 'zod';
import type {
  TeamPlacement,
  TeamCommunication,
  ScanStatus,
  SignalMessage,
  LearningEntry
} from '../../../sdk/types';
import { OTelEmitter } from '../../../sdk/otel-emitter.js';

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
  version: z.string(),
  type: z.enum(['discovery', 'correction', 'pattern', 'technique', 'gotcha']),
  content: z.string(),
  confidence: z.enum(['low', 'medium', 'high']),
  tags: z.array(z.string()).optional(),
  graduated: z.boolean().optional(),
  graduated_to: z.string().optional(),
  supersedes: z.string().optional()
}).passthrough();

/**
 * FileSignalCommunication implementation.
 * 
 * Implements TeamCommunication over filesystem by delegating to TeamPlacement.
 * Works with any placement type — no direct file I/O.
 */
export class FileSignalCommunication implements TeamCommunication {
  protected readonly emitter: OTelEmitter;

  /**
   * Create a new FileSignalCommunication.
   * @param placement - TeamPlacement instance for file I/O operations
   * @param emitter - Optional OTel emitter for instrumentation
   */
  constructor(
    private readonly placement: TeamPlacement,
    emitter?: OTelEmitter
  ) {
    this.emitter = emitter || new OTelEmitter();
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
   * Read team status from .squad/status.json.
   */
  async readStatus(teamId: string): Promise<ScanStatus | null> {
    try {
      const content = await this.placement.readFile(teamId, '.squad/status.json');
      if (!content) {
        return null;
      }

      const parsed = JSON.parse(content);
      return ScanStatusSchema.parse(parsed);
    } catch (error) {
      if ((error as Error).message?.includes('Failed to read file') || 
          (error as Error).message?.includes('ENOENT')) {
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
   * Write signal message to outbox.
   */
  async writeOutboxSignal(teamId: string, signal: SignalMessage): Promise<void> {
    await this.writeSignal(teamId, 'outbox', signal);
  }

  /**
   * Read signal messages from specified direction.
   */
  private async readSignals(teamId: string, direction: 'inbox' | 'outbox'): Promise<SignalMessage[]> {
    let signals: SignalMessage[] = [];

    await this.emitter.span(
      'communication.readSignals',
      async () => {
        try {
          const signalsDir = `.squad/signals/${direction}`;
          
          // Check if directory exists via placement
          const dirExists = await this.placement.exists(teamId, signalsDir);
          if (!dirExists) {
            return [];
          }

          // List files in signals directory
          const files = await this.placement.listFiles(teamId, signalsDir);
          const jsonFiles = files.filter(f => f.endsWith('.json'));

          const collected: SignalMessage[] = [];
          for (const file of jsonFiles) {
            const content = await this.placement.readFile(teamId, file);
            if (!content) continue;
            
            const parsed = JSON.parse(content);
            const validated = SignalMessageSchema.parse(parsed);
            collected.push(validated);
          }

          // Emit metric for signals read
          await this.emitter.metric('signals.read', collected.length, {
            'squad.domain': teamId,
            'signal.direction': direction
          });

          signals = collected;
        } catch (error) {
          throw new Error(`Failed to read ${direction} signals for team ${teamId}: ${(error as Error).message}`);
        }
      },
      {
        'squad.domain': teamId,
        'signal.direction': direction
      }
    );

    return signals;
  }

  /**
   * Write signal message to specified direction.
   */
  private async writeSignal(teamId: string, direction: 'inbox' | 'outbox', signal: SignalMessage): Promise<void> {
    await this.emitter.span(
      'communication.writeSignal',
      async () => {
        try {
          // Validate signal
          SignalMessageSchema.parse(signal);

          // Generate filename: {timestamp}-{type}-{subject-slug}.json
          const timestamp = signal.timestamp.replace(/[:.]/g, '-');
          const subjectSlug = this.slugify(signal.subject);
          const filename = `${timestamp}-${signal.type}-${subjectSlug}.json`;

          const signalPath = `.squad/signals/${direction}/${filename}`;
          await this.placement.writeFile(teamId, signalPath, JSON.stringify(signal, null, 2));

          // Emit event for signal sent
          await this.emitter.event('signal.sent', {
            'squad.domain': teamId,
            'signal.direction': direction,
            'signal.type': signal.type,
            'signal.from': signal.from,
            'signal.to': signal.to
          });
        } catch (error) {
          throw new Error(`Failed to write ${direction} signal for team ${teamId}: ${(error as Error).message}`);
        }
      },
      {
        'squad.domain': teamId,
        'signal.direction': direction,
        'signal.type': signal.type
      }
    );
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
   * Read learning log entries.
   */
  async readLearningLog(teamId: string): Promise<LearningEntry[]> {
    try {
      const logPath = '.squad/learnings/log.jsonl';
      const content = await this.placement.readFile(teamId, logPath);
      if (!content) {
        return [];
      }

      const lines = content.trim().split('\n').filter(line => line.trim());
      return lines.map(line => {
        const parsed = JSON.parse(line);
        return LearningEntrySchema.parse(parsed);
      });
    } catch (error) {
      if ((error as Error).message?.includes('Failed to read file') ||
          (error as Error).message?.includes('ENOENT')) {
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

      // Read existing log
      const logPath = '.squad/learnings/log.jsonl';
      const existingContent = await this.placement.readFile(teamId, logPath) || '';
      
      // Append new entry as JSONL line
      const line = JSON.stringify(entry);
      const existingTrimmed = existingContent.trimEnd();
      const newContent = existingTrimmed ? `${existingTrimmed}\n${line}` : line;
      
      // Write back to placement
      await this.placement.writeFile(teamId, logPath, `${newContent}\n`);
    } catch (error) {
      throw new Error(`Failed to append learning for team ${teamId}: ${(error as Error).message}`);
    }
  }
}
