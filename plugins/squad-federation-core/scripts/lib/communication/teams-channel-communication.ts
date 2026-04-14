/**
 * TeamsChannelCommunication — TeamCommunication implementation over Microsoft Teams channels.
 * 
 * Implements TeamCommunication interface using Microsoft Teams channel messages via Graph API.
 * Hashtag-based addressing protocol: #meta, #meta-status, #meta-error, #{teamId}.
 * Injectable TeamsClient abstraction for testability.
 * 
 * @since v0.4.0
 */

import { z } from 'zod';
import type {
  TeamCommunication,
  ScanStatus,
  SignalMessage,
  LearningEntry
} from '../../../sdk/types';
import { OTelEmitter } from '../../../sdk/otel-emitter.js';

/**
 * Teams message shape returned by Graph API.
 */
export interface TeamsMessage {
  id: string;
  createdDateTime: string;
  from: {
    user?: {
      displayName?: string;
      id?: string;
    };
  };
  body: {
    contentType: 'text' | 'html';
    content: string;
  };
}

/**
 * TeamsClient — Transport abstraction for Graph API calls.
 * 
 * Allows injection of mock client for testing or different auth mechanisms.
 */
export interface TeamsClient {
  /**
   * Post a message to a channel.
   */
  postMessage(
    teamId: string,
    channelId: string,
    content: string,
    contentType?: 'text' | 'html'
  ): Promise<TeamsMessage>;

  /**
   * List messages in a channel.
   */
  listMessages(
    teamId: string,
    channelId: string,
    top?: number
  ): Promise<TeamsMessage[]>;

  /**
   * Search messages by query.
   */
  searchMessages(query: string): Promise<TeamsMessage[]>;
}

/**
 * Configuration for TeamsChannelCommunication.
 * Adapter-specific, not TeamPlacement.
 */
export interface TeamsChannelConfig {
  /** Teams workspace ID (GUID) */
  teamId: string;

  /** Teams channel ID (thread.tacv2 format) */
  channelId: string;
}

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
 * TeamsChannelCommunication implementation.
 * 
 * Uses hashtag protocol in Teams channel messages:
 * - #meta — humans → meta (PRIORITY)
 * - #meta-status — teams → meta status updates
 * - #meta-error — teams → meta errors
 * - #{teamId} — meta → specific team
 */
export class TeamsChannelCommunication implements TeamCommunication {
  protected readonly emitter: OTelEmitter;

  /**
   * Create a new TeamsChannelCommunication.
   * @param config - Teams channel configuration
   * @param client - TeamsClient for API operations
   * @param emitter - Optional OTel emitter for instrumentation
   */
  constructor(
    private readonly config: TeamsChannelConfig,
    private readonly client: TeamsClient,
    emitter?: OTelEmitter
  ) {
    this.emitter = emitter || new OTelEmitter();
  }

  /**
   * Extract hashtags from message content.
   */
  private extractHashtags(content: string): string[] {
    const matches = content.match(/#[\w-]+/g);
    return matches || [];
  }

  /**
   * Parse signal data from message content.
   * Handles both JSON in Adaptive Card format and plain text.
   */
  private parseSignalFromMessage(message: TeamsMessage): SignalMessage | null {
    try {
      const content = message.body.content;
      
      // Try to parse entire content as JSON first (Adaptive Card format)
      let payload: any;
      try {
        payload = JSON.parse(content);
        
        // Check if it's an Adaptive Card - extract signal from card body
        if (payload.type === 'AdaptiveCard' && payload.body) {
          // Find TextBlock with ```json content
          let foundSignal = false;
          for (const element of payload.body) {
            if (element.type === 'TextBlock' && element.text) {
              const cardJsonMatch = element.text.match(/```json\s*([\s\S]*?)\s*```/);
              if (cardJsonMatch) {
                payload = JSON.parse(cardJsonMatch[1]);
                foundSignal = true;
                break;
              }
            }
          }
          // If we didn't find a signal in the card, return null
          if (!foundSignal) {
            return null;
          }
        }
        // If it's JSON but not an Adaptive Card, treat as signal payload
      } catch {
        // Not JSON, try to extract from ```json code block
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          payload = JSON.parse(jsonMatch[1]);
        } else {
          // Parse as plain text signal
          const hashtags = this.extractHashtags(content);
          const typeMatch = content.match(/\b(directive|question|report|alert)\b/i);
          
          if (!typeMatch) return null;

          payload = {
            id: message.id,
            timestamp: message.createdDateTime,
            from: message.from.user?.displayName || 'unknown',
            to: hashtags.find(h => h !== '#meta' && h !== '#meta-status' && h !== '#meta-error') || '',
            type: typeMatch[1].toLowerCase(),
            subject: content.split('\n')[0].replace(/#[\w-]+/g, '').trim().slice(0, 100),
            body: content,
            protocol: 'teams-channel/1.0'
          };
        }
      }

      return SignalMessageSchema.parse(payload);
    } catch (error) {
      this.emitter.event('signal.parse.failed', {
        'message.id': message.id,
        'error': (error as Error).message
      });
      return null;
    }
  }

  /**
   * Format signal as Adaptive Card for Teams.
   */
  private formatSignalAsAdaptiveCard(signal: SignalMessage, hashtag: string): string {
    const card = {
      type: 'AdaptiveCard',
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `${hashtag} ${signal.type}: ${signal.subject}`,
          weight: 'bolder',
          size: 'medium'
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Type', value: signal.type },
            { title: 'From', value: signal.from },
            { title: 'To', value: signal.to },
            { title: 'Time', value: new Date(signal.timestamp).toLocaleString() }
          ]
        },
        {
          type: 'TextBlock',
          text: '```json\n' + JSON.stringify(signal, null, 2) + '\n```',
          wrap: true
        }
      ]
    };

    return JSON.stringify(card);
  }

  /**
   * Read team status from latest #meta-status message.
   */
  async readStatus(teamId: string): Promise<ScanStatus | null> {
    try {
      // Search for latest #meta-status message from this team
      const messages = await this.client.listMessages(
        this.config.teamId,
        this.config.channelId,
        50
      );

      // Filter for #meta-status messages from this team
      const statusMessages = messages.filter(m => {
        const content = m.body.content;
        return content.includes('#meta-status') && content.includes(teamId);
      });

      if (statusMessages.length === 0) {
        return null;
      }

      // Get most recent
      const latest = statusMessages[0];
      
      // Try to parse status from message
      const jsonMatch = latest.body.content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        return ScanStatusSchema.parse(parsed);
      }

      return null;
    } catch (error) {
      throw new Error(`Failed to read status for team ${teamId}: ${(error as Error).message}`);
    }
  }

  /**
   * Read signal messages from inbox (messages addressed to this team).
   */
  async readInboxSignals(teamId: string): Promise<SignalMessage[]> {
    try {
      const messages = await this.client.listMessages(
        this.config.teamId,
        this.config.channelId,
        100
      );

      // Filter for messages containing #{teamId}
      const inboxMessages = messages.filter(m => {
        const hashtags = this.extractHashtags(m.body.content);
        return hashtags.includes(`#${teamId}`);
      });

      const signals: SignalMessage[] = [];
      for (const msg of inboxMessages) {
        const signal = this.parseSignalFromMessage(msg);
        if (signal) {
          signals.push(signal);
        }
      }

      await this.emitter.metric('signals.read', signals.length, {
        'squad.domain': teamId,
        'signal.direction': 'inbox'
      });

      return signals;
    } catch (error) {
      throw new Error(`Failed to read inbox signals for team ${teamId}: ${(error as Error).message}`);
    }
  }

  /**
   * Write signal message to inbox (post with #{targetTeamId}).
   */
  async writeInboxSignal(teamId: string, signal: SignalMessage): Promise<void> {
    try {
      // Validate signal
      SignalMessageSchema.parse(signal);

      // Format as Adaptive Card
      const hashtag = `#${teamId}`;
      const cardJson = this.formatSignalAsAdaptiveCard(signal, hashtag);

      // Post to channel
      await this.client.postMessage(
        this.config.teamId,
        this.config.channelId,
        cardJson,
        'html'
      );

      await this.emitter.event('signal.sent', {
        'squad.domain': teamId,
        'signal.direction': 'inbox',
        'signal.type': signal.type,
        'signal.from': signal.from,
        'signal.to': signal.to
      });
    } catch (error) {
      throw new Error(`Failed to write inbox signal for team ${teamId}: ${(error as Error).message}`);
    }
  }

  /**
   * Read signal messages from outbox (messages FROM this team).
   */
  async readOutboxSignals(teamId: string): Promise<SignalMessage[]> {
    try {
      const messages = await this.client.listMessages(
        this.config.teamId,
        this.config.channelId,
        100
      );

      // Filter for messages from this team (containing #meta-status, #meta-error, or #meta)
      const outboxMessages = messages.filter(m => {
        const content = m.body.content;
        const fromTeam = content.includes(teamId);
        const toMeta = content.includes('#meta') || 
                       content.includes('#meta-status') || 
                       content.includes('#meta-error');
        return fromTeam && toMeta;
      });

      const signals: SignalMessage[] = [];
      for (const msg of outboxMessages) {
        const signal = this.parseSignalFromMessage(msg);
        if (signal) {
          signals.push(signal);
        }
      }

      await this.emitter.metric('signals.read', signals.length, {
        'squad.domain': teamId,
        'signal.direction': 'outbox'
      });

      return signals;
    } catch (error) {
      throw new Error(`Failed to read outbox signals for team ${teamId}: ${(error as Error).message}`);
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
      let signals = direction === 'inbox' 
        ? await this.readInboxSignals(teamId)
        : await this.readOutboxSignals(teamId);

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
   * Read learning log entries from channel messages.
   */
  async readLearningLog(teamId: string): Promise<LearningEntry[]> {
    try {
      const messages = await this.client.listMessages(
        this.config.teamId,
        this.config.channelId,
        100
      );

      // Filter for learning entries from this team
      const learningMessages = messages.filter(m => {
        const content = m.body.content;
        return content.includes('#learning') && content.includes(teamId);
      });

      const entries: LearningEntry[] = [];
      for (const msg of learningMessages) {
        try {
          const jsonMatch = msg.body.content.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1]);
            const entry = LearningEntrySchema.parse(parsed);
            entries.push(entry);
          }
        } catch (error) {
          // Skip malformed entries
          continue;
        }
      }

      return entries;
    } catch (error) {
      throw new Error(`Failed to read learning log for team ${teamId}: ${(error as Error).message}`);
    }
  }

  /**
   * Append entry to learning log (post to channel).
   */
  async appendLearning(teamId: string, entry: LearningEntry): Promise<void> {
    try {
      // Validate entry
      LearningEntrySchema.parse(entry);

      // Format as message
      const content = `#learning #${teamId}\n\n**${entry.type}** (${entry.confidence} confidence)\n\n${entry.content}\n\n\`\`\`json\n${JSON.stringify(entry, null, 2)}\n\`\`\``;

      // Post to channel
      await this.client.postMessage(
        this.config.teamId,
        this.config.channelId,
        content,
        'html'
      );
    } catch (error) {
      throw new Error(`Failed to append learning for team ${teamId}: ${(error as Error).message}`);
    }
  }
}
