/**
 * Contract tests for Teams MCP integration.
 *
 * Verifies that the federation-orchestration skill and heartbeat prompt
 * contain the correct Teams MCP tool call instructions.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PLUGIN_ROOT = resolve(__dirname, '..', '..', '..');

describe('Teams MCP integration contracts', () => {
  describe('federation-orchestration SKILL.md', () => {
    const skillContent = readFileSync(
      resolve(PLUGIN_ROOT, 'skills', 'federation-orchestration', 'SKILL.md'),
      'utf-8',
    );

    it('contains PostChannelMessage tool instructions', () => {
      expect(skillContent).toContain('PostChannelMessage');
    });

    it('contains ListChannelMessages tool instructions', () => {
      expect(skillContent).toContain('ListChannelMessages');
    });

    it('references teamsConfig.teamId parameter', () => {
      expect(skillContent).toContain('teamsConfig.teamId');
    });

    it('references teamsConfig.channelId parameter', () => {
      expect(skillContent).toContain('teamsConfig.channelId');
    });

    it('includes #directive polling instructions', () => {
      expect(skillContent).toContain('#directive');
    });

    it('explains conditional logic when teamsConfig is absent', () => {
      expect(skillContent).toMatch(/teamsConfig.*absent|teamsConfig.*skip/i);
    });

    it('has a Teams Notifications section', () => {
      expect(skillContent).toContain('## Teams Notifications');
    });
  });

  describe('meta-heartbeat.ts prompt', () => {
    const heartbeatContent = readFileSync(
      resolve(PLUGIN_ROOT, 'scripts', 'meta-heartbeat.ts'),
      'utf-8',
    );

    it('heartbeat prompt mentions PostChannelMessage', () => {
      expect(heartbeatContent).toContain('PostChannelMessage');
    });

    it('heartbeat prompt mentions ListChannelMessages', () => {
      expect(heartbeatContent).toContain('ListChannelMessages');
    });

    it('heartbeat prompt references teamsConfig in federate.config.json', () => {
      expect(heartbeatContent).toContain('teamsConfig');
      expect(heartbeatContent).toContain('federate.config.json');
    });

    it('heartbeat prompt includes #directive polling', () => {
      expect(heartbeatContent).toContain('#directive');
    });
  });

  describe('meta-relay.ts documents skill-layer responsibility', () => {
    const relayContent = readFileSync(
      resolve(PLUGIN_ROOT, 'scripts', 'meta-relay.ts'),
      'utf-8',
    );

    it('meta-relay.ts explains Teams posting is skill-layer', () => {
      expect(relayContent).toMatch(/skill.layer|skill layer/i);
    });

    it('meta-relay.ts references teamsConfig', () => {
      expect(relayContent).toContain('teamsConfig');
    });

    it('meta-relay.ts has a comment about Teams integration', () => {
      expect(relayContent).toMatch(/Teams.*notification|Teams.*skill/i);
    });
  });

  describe('FederateConfig schema supports teamsConfig', () => {
    it('schema parses config with teamsConfig', async () => {
      const { FederateConfigSchema } = await import(resolve(PLUGIN_ROOT, 'sdk', 'schemas.ts'));
      const config = {
        communicationType: 'file-signal',
        telemetry: { enabled: false },
        teamsConfig: {
          teamId: 'abc-123',
          channelId: '19:xyz@thread.tacv2',
        },
      };
      const result = FederateConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('schema parses config without teamsConfig', async () => {
      const { FederateConfigSchema } = await import(resolve(PLUGIN_ROOT, 'sdk', 'schemas.ts'));
      const config = {
        communicationType: 'file-signal',
        telemetry: { enabled: false },
      };
      const result = FederateConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });
});
