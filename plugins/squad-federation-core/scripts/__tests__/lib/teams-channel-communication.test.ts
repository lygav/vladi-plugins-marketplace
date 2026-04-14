/**
 * Unit tests for TeamsChannelCommunication
 * Tests hashtag protocol, signal marshalling, status operations, and learning log
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TeamsChannelCommunication } from '../../lib/communication/teams-channel-communication.js';
import type {
  TeamsClient,
  TeamsMessage,
  TeamsChannelConfig
} from '../../lib/communication/teams-channel-communication.js';
import type { SignalMessage, LearningEntry, ScanStatus } from '../../../sdk/types.js';

/**
 * MockTeamsClient - in-memory TeamsClient for testing
 * Simulates Microsoft Teams Graph API without network calls
 */
class MockTeamsClient implements TeamsClient {
  messages: TeamsMessage[] = [];
  
  async postMessage(
    teamId: string,
    channelId: string,
    content: string,
    contentType?: 'text' | 'html'
  ): Promise<TeamsMessage> {
    const message: TeamsMessage = {
      id: `msg-${this.messages.length + 1}`,
      createdDateTime: new Date().toISOString(),
      from: {
        user: {
          displayName: 'Test Bot',
          id: 'bot-123'
        }
      },
      body: {
        contentType: contentType || 'text',
        content
      }
    };
    
    this.messages.push(message);
    return message;
  }
  
  async listMessages(
    teamId: string,
    channelId: string,
    top?: number
  ): Promise<TeamsMessage[]> {
    const limit = top || 20;
    return this.messages.slice(-limit);
  }
  
  async searchMessages(query: string): Promise<TeamsMessage[]> {
    return this.messages.filter(m => m.body.content.includes(query));
  }

  // Test helpers
  clear(): void {
    this.messages = [];
  }

  getMessageCount(): number {
    return this.messages.length;
  }
}

describe('teams-channel-communication.test.ts', () => {
  let client: MockTeamsClient;
  let communication: TeamsChannelCommunication;
  const config: TeamsChannelConfig = {
    teamId: 'team-abc-123',
    channelId: '19:channel-def-456@thread.tacv2'
  };
  const testTeamId = 'data-eng';

  beforeEach(() => {
    client = new MockTeamsClient();
    communication = new TeamsChannelCommunication(config, client);
  });

  describe('writeInboxSignal', () => {
    it('should post message with #{teamId} hashtag', async () => {
      const signal: SignalMessage = {
        id: 'signal-1',
        timestamp: new Date().toISOString(),
        from: 'meta',
        to: testTeamId,
        type: 'directive',
        subject: 'Start data processing',
        body: 'Begin processing customer data',
        protocol: 'teams-channel/1.0'
      };

      await communication.writeInboxSignal(testTeamId, signal);

      expect(client.getMessageCount()).toBe(1);
      const message = client.messages[0];
      expect(message.body.content).toContain(`#${testTeamId}`);
      expect(message.body.content).toContain('directive');
      expect(message.body.content).toContain(signal.subject);
    });

    it('should format signal as Adaptive Card', async () => {
      const signal: SignalMessage = {
        id: 'signal-2',
        timestamp: new Date().toISOString(),
        from: 'meta',
        to: testTeamId,
        type: 'question',
        subject: 'Status update request',
        body: 'What is the current progress?',
        protocol: 'teams-channel/1.0'
      };

      await communication.writeInboxSignal(testTeamId, signal);

      const message = client.messages[0];
      const content = message.body.content;
      
      // Should contain Adaptive Card structure
      expect(content).toContain('AdaptiveCard');
      expect(content).toContain('TextBlock');
      expect(content).toContain('FactSet');
      
      // Should contain signal data in JSON block
      expect(content).toContain('```json');
      expect(content).toContain(signal.id);
      expect(content).toContain(signal.subject);
    });
  });

  describe('readInboxSignals', () => {
    it('should find messages tagged for the team', async () => {
      // Post signals to different teams
      await communication.writeInboxSignal('data-eng', {
        id: 's1',
        timestamp: new Date().toISOString(),
        from: 'meta',
        to: 'data-eng',
        type: 'directive',
        subject: 'For data-eng',
        body: 'Task 1',
        protocol: 'teams-channel/1.0'
      });

      await communication.writeInboxSignal('frontend', {
        id: 's2',
        timestamp: new Date().toISOString(),
        from: 'meta',
        to: 'frontend',
        type: 'directive',
        subject: 'For frontend',
        body: 'Task 2',
        protocol: 'teams-channel/1.0'
      });

      await communication.writeInboxSignal('data-eng', {
        id: 's3',
        timestamp: new Date().toISOString(),
        from: 'meta',
        to: 'data-eng',
        type: 'question',
        subject: 'For data-eng again',
        body: 'Task 3',
        protocol: 'teams-channel/1.0'
      });

      const signals = await communication.readInboxSignals('data-eng');

      expect(signals.length).toBe(2);
      expect(signals.every(s => s.to === 'data-eng')).toBe(true);
      expect(signals.map(s => s.id)).toContain('s1');
      expect(signals.map(s => s.id)).toContain('s3');
    });

    it('should return empty array for team with no messages', async () => {
      const signals = await communication.readInboxSignals('nonexistent-team');
      expect(signals).toEqual([]);
    });

    it('should parse plain text signals without JSON', async () => {
      // Manually post a plain text message with hashtag
      await client.postMessage(
        config.teamId,
        config.channelId,
        '#backend directive: Deploy new feature\n\nBody content here',
        'text'
      );

      const signals = await communication.readInboxSignals('backend');

      expect(signals.length).toBe(1);
      expect(signals[0].type).toBe('directive');
    });
  });

  describe('readStatus', () => {
    it('should return latest status from #meta-status messages', async () => {
      const status: ScanStatus = {
        domain: testTeamId,
        domain_id: 'team-123',
        state: 'active',
        step: 'processing',
        started_at: '2025-01-15T10:00:00Z',
        updated_at: '2025-01-15T10:30:00Z',
        archetype_id: 'data-processor',
        progress_pct: 75
      };

      // Post status update
      await client.postMessage(
        config.teamId,
        config.channelId,
        `#meta-status #${testTeamId}\n\n\`\`\`json\n${JSON.stringify(status, null, 2)}\n\`\`\``,
        'html'
      );

      const result = await communication.readStatus(testTeamId);

      expect(result).not.toBeNull();
      expect(result!.domain).toBe(testTeamId);
      expect(result!.state).toBe('active');
      expect(result!.progress_pct).toBe(75);
    });

    it('should return null when no status messages exist', async () => {
      const result = await communication.readStatus('team-without-status');
      expect(result).toBeNull();
    });

    it('should distinguish #meta-status from #meta messages', async () => {
      // Post a #meta message (should be ignored)
      await client.postMessage(
        config.teamId,
        config.channelId,
        `#meta #${testTeamId}\n\nGeneral message`,
        'text'
      );

      // Post a #meta-status message (should be found)
      const status: ScanStatus = {
        domain: testTeamId,
        domain_id: 'team-123',
        state: 'completed',
        step: 'done',
        started_at: '2025-01-15T10:00:00Z',
        updated_at: '2025-01-15T11:00:00Z',
        archetype_id: 'processor'
      };

      await client.postMessage(
        config.teamId,
        config.channelId,
        `#meta-status #${testTeamId}\n\n\`\`\`json\n${JSON.stringify(status)}\n\`\`\``,
        'html'
      );

      const result = await communication.readStatus(testTeamId);

      expect(result).not.toBeNull();
      expect(result!.state).toBe('completed');
    });
  });

  describe('readOutboxSignals', () => {
    it('should find messages from the team', async () => {
      // Simulate team posting status update
      await client.postMessage(
        config.teamId,
        config.channelId,
        `#meta-status data-eng: Progress update\n\n\`\`\`json\n${JSON.stringify({
          id: 'status-1',
          timestamp: new Date().toISOString(),
          from: 'data-eng',
          to: 'meta',
          type: 'report',
          subject: 'Progress update',
          body: 'Processing 75% complete',
          protocol: 'teams-channel/1.0'
        })}\n\`\`\``,
        'html'
      );

      const signals = await communication.readOutboxSignals('data-eng');

      expect(signals.length).toBe(1);
      expect(signals[0].from).toBe('data-eng');
      expect(signals[0].to).toBe('meta');
    });

    it('should return empty array when no outbox messages exist', async () => {
      const signals = await communication.readOutboxSignals('silent-team');
      expect(signals).toEqual([]);
    });
  });

  describe('appendLearning', () => {
    it('should post learning entry to channel', async () => {
      const learning: LearningEntry = {
        id: 'learning-1',
        timestamp: new Date().toISOString(),
        version: '1.0',
        type: 'pattern',
        content: 'Always validate input data before processing',
        confidence: 'high',
        tags: ['validation', 'data-quality']
      };

      await communication.appendLearning(testTeamId, learning);

      expect(client.getMessageCount()).toBe(1);
      const message = client.messages[0];
      
      expect(message.body.content).toContain('#learning');
      expect(message.body.content).toContain(`#${testTeamId}`);
      expect(message.body.content).toContain('pattern');
      expect(message.body.content).toContain(learning.content);
      expect(message.body.content).toContain('```json');
    });

    it('should handle all learning types', async () => {
      const types: Array<'discovery' | 'correction' | 'pattern' | 'technique' | 'gotcha'> = [
        'discovery',
        'correction',
        'pattern',
        'technique',
        'gotcha'
      ];

      for (const type of types) {
        const learning: LearningEntry = {
          id: `learning-${type}`,
          timestamp: new Date().toISOString(),
          version: '1.0',
          type,
          content: `Test ${type} learning`,
          confidence: 'medium'
        };

        await communication.appendLearning(testTeamId, learning);
      }

      expect(client.getMessageCount()).toBe(types.length);
      
      // Verify each type was posted
      for (const type of types) {
        const typeMessages = client.messages.filter(m => m.body.content.includes(type));
        expect(typeMessages.length).toBeGreaterThan(0);
      }
    });
  });

  describe('readLearningLog', () => {
    it('should read learning entries from channel', async () => {
      const learning1: LearningEntry = {
        id: 'learning-1',
        timestamp: '2025-01-15T10:00:00Z',
        version: '1.0',
        type: 'discovery',
        content: 'Database indexes improve query performance',
        confidence: 'high'
      };

      const learning2: LearningEntry = {
        id: 'learning-2',
        timestamp: '2025-01-15T11:00:00Z',
        version: '1.0',
        type: 'gotcha',
        content: 'Remember to handle null values in aggregations',
        confidence: 'medium'
      };

      await communication.appendLearning(testTeamId, learning1);
      await communication.appendLearning(testTeamId, learning2);

      const entries = await communication.readLearningLog(testTeamId);

      expect(entries.length).toBe(2);
      expect(entries.map(e => e.id)).toContain('learning-1');
      expect(entries.map(e => e.id)).toContain('learning-2');
    });

    it('should return empty array when no learning entries exist', async () => {
      const entries = await communication.readLearningLog('team-no-learning');
      expect(entries).toEqual([]);
    });

    it('should skip malformed learning entries', async () => {
      // Post valid learning
      await communication.appendLearning(testTeamId, {
        id: 'valid-1',
        timestamp: new Date().toISOString(),
        version: '1.0',
        type: 'pattern',
        content: 'Valid learning',
        confidence: 'high'
      });

      // Post malformed learning
      await client.postMessage(
        config.teamId,
        config.channelId,
        `#learning #${testTeamId}\n\n\`\`\`json\n{ "invalid": "no required fields" }\n\`\`\``,
        'html'
      );

      // Post another valid learning
      await communication.appendLearning(testTeamId, {
        id: 'valid-2',
        timestamp: new Date().toISOString(),
        version: '1.0',
        type: 'technique',
        content: 'Another valid learning',
        confidence: 'medium'
      });

      const entries = await communication.readLearningLog(testTeamId);

      // Should only return valid entries
      expect(entries.length).toBe(2);
      expect(entries.map(e => e.id)).toContain('valid-1');
      expect(entries.map(e => e.id)).toContain('valid-2');
    });
  });

  describe('empty channel behavior', () => {
    it('should return empty arrays for all read operations on empty channel', async () => {
      const inboxSignals = await communication.readInboxSignals(testTeamId);
      const outboxSignals = await communication.readOutboxSignals(testTeamId);
      const learningLog = await communication.readLearningLog(testTeamId);
      const status = await communication.readStatus(testTeamId);

      expect(inboxSignals).toEqual([]);
      expect(outboxSignals).toEqual([]);
      expect(learningLog).toEqual([]);
      expect(status).toBeNull();
    });
  });

  describe('multiple teams isolation', () => {
    it('should isolate signals by team hashtag', async () => {
      // Post signals to multiple teams
      await communication.writeInboxSignal('team-alpha', {
        id: 'alpha-1',
        timestamp: new Date().toISOString(),
        from: 'meta',
        to: 'team-alpha',
        type: 'directive',
        subject: 'For alpha',
        body: 'Alpha task',
        protocol: 'teams-channel/1.0'
      });

      await communication.writeInboxSignal('team-beta', {
        id: 'beta-1',
        timestamp: new Date().toISOString(),
        from: 'meta',
        to: 'team-beta',
        type: 'directive',
        subject: 'For beta',
        body: 'Beta task',
        protocol: 'teams-channel/1.0'
      });

      await communication.writeInboxSignal('team-alpha', {
        id: 'alpha-2',
        timestamp: new Date().toISOString(),
        from: 'meta',
        to: 'team-alpha',
        type: 'question',
        subject: 'For alpha again',
        body: 'Alpha question',
        protocol: 'teams-channel/1.0'
      });

      // Verify team-alpha only sees its signals
      const alphaSignals = await communication.readInboxSignals('team-alpha');
      expect(alphaSignals.length).toBe(2);
      expect(alphaSignals.every(s => s.to === 'team-alpha')).toBe(true);

      // Verify team-beta only sees its signals
      const betaSignals = await communication.readInboxSignals('team-beta');
      expect(betaSignals.length).toBe(1);
      expect(betaSignals[0].to).toBe('team-beta');
    });
  });

  describe('listSignals filtering', () => {
    beforeEach(async () => {
      // Seed test signals
      await communication.writeInboxSignal(testTeamId, {
        id: 's1',
        timestamp: '2025-01-15T10:00:00Z',
        from: 'meta',
        to: testTeamId,
        type: 'directive',
        subject: 'Directive 1',
        body: 'Task 1',
        protocol: 'teams-channel/1.0'
      });

      await communication.writeInboxSignal(testTeamId, {
        id: 's2',
        timestamp: '2025-01-15T11:00:00Z',
        from: 'meta',
        to: testTeamId,
        type: 'question',
        subject: 'Question 1',
        body: 'Query 1',
        protocol: 'teams-channel/1.0'
      });

      await communication.writeInboxSignal(testTeamId, {
        id: 's3',
        timestamp: '2025-01-15T12:00:00Z',
        from: 'team-other',
        to: testTeamId,
        type: 'directive',
        subject: 'Directive 2',
        body: 'Task 2',
        protocol: 'teams-channel/1.0'
      });
    });

    it('should filter by type', async () => {
      const directives = await communication.listSignals(testTeamId, 'inbox', { type: 'directive' });
      
      expect(directives.length).toBe(2);
      expect(directives.every(s => s.type === 'directive')).toBe(true);
    });

    it('should filter by sender', async () => {
      const fromMeta = await communication.listSignals(testTeamId, 'inbox', { from: 'meta' });
      
      expect(fromMeta.length).toBe(2);
      expect(fromMeta.every(s => s.from === 'meta')).toBe(true);
    });

    it('should filter by timestamp', async () => {
      const since = await communication.listSignals(testTeamId, 'inbox', { 
        since: '2025-01-15T10:30:00Z' 
      });
      
      expect(since.length).toBe(2);
      expect(since.every(s => s.timestamp >= '2025-01-15T10:30:00Z')).toBe(true);
    });

    it('should combine multiple filters', async () => {
      const filtered = await communication.listSignals(testTeamId, 'inbox', {
        type: 'directive',
        from: 'meta'
      });
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('s1');
    });
  });
});
