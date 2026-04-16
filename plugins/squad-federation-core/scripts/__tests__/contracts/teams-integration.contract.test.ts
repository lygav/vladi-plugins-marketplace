/**
 * Contract tests for Teams MCP integration.
 *
 * Verifies that the federation-orchestration skill and teams-presence
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

    it('includes @<federationName> polling instructions', () => {
      expect(skillContent).toContain('@<federationName>');
    });

    it('explains conditional logic when teamsConfig is absent', () => {
      expect(skillContent).toMatch(/teamsConfig.*absent|teamsConfig.*skip/i);
    });

    it('has a Teams Notifications section', () => {
      expect(skillContent).toContain('## Teams Notifications');
    });
  });

  describe('teams-presence.ts loads config', () => {
    const presenceContent = readFileSync(
      resolve(PLUGIN_ROOT, 'scripts', 'teams-presence.ts'),
      'utf-8',
    );

    it('teams-presence references teamsConfig', () => {
      expect(presenceContent).toContain('teamsConfig');
    });

    it('teams-presence references federationName', () => {
      expect(presenceContent).toContain('federationName');
    });

    it('teams-presence reads federate.config.json', () => {
      expect(presenceContent).toContain('federate.config.json');
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
