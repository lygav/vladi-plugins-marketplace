/**
 * Contract Tests — Validate coding archetype against SDK contracts
 *
 * Ensures monitor and triage scripts correctly extend SDK base classes
 * and that archetype manifest conforms to expected schema.
 */

import { describe, it, expect } from 'vitest';
import { CodingMonitor } from '../meta/scripts/coding-monitor.js';
import { CodingTriage } from '../meta/scripts/coding-triage.js';
import type { StateSchema, ArchetypeManifest } from '@squad/federation-core/sdk/types.js';

describe('Coding Archetype Contract Tests', () => {
  describe('Monitor Script', () => {
    it('extends MonitorBase correctly', () => {
      const monitor = new CodingMonitor(new Map(), new Map());
      expect(monitor.archetypeName).toBe('coding');
      expect(typeof monitor.collectArchetypeData).toBe('function');
      expect(typeof monitor.formatArchetypeColumns).toBe('function');
    });
  });

  describe('Triage Script', () => {
    it('extends TriageBase correctly', () => {
      const triage = new CodingTriage();
      expect(typeof triage.diagnose).toBe('function');
      expect(typeof triage.suggestRecovery).toBe('function');
    });
  });

  describe('State Machine', () => {
    it('has valid lifecycle states', async () => {
      const archetype = await import('../team/archetype.json');
      const states = archetype.states as StateSchema;

      expect(states.lifecycle).toHaveLength(7);
      expect(states.lifecycle).toEqual([
        'preparing', 'implementing', 'testing',
        'pr-open', 'pr-review', 'pr-approved', 'merged'
      ]);
      expect(states.terminal).toContain('complete');
      expect(states.terminal).toContain('failed');
      expect(states.pauseable).toBe(true);
    });

    it('lifecycle states are non-empty strings', async () => {
      const archetype = await import('../team/archetype.json');
      const states = archetype.states.lifecycle as string[];
      states.forEach((state) => {
        expect(state).toBeTruthy();
        expect(typeof state).toBe('string');
      });
    });
  });

  describe('Archetype Manifest', () => {
    it('declares required fields', async () => {
      const manifest = await import('../archetype.json');

      expect(manifest.name).toBe('squad-archetype-coding');
      expect(manifest.version).toBeTruthy();
      expect(manifest.description).toBeTruthy();
      expect(manifest.coreCompatibility).toBeTruthy();
      expect(manifest.meta).toBeDefined();
      expect(manifest.team).toBeDefined();
    });

    it('has valid meta/team paths', async () => {
      const manifest = await import('../archetype.json');

      expect(manifest.meta.skills).toBe('meta/skills/');
      // coding archetype does not declare meta.scripts
      expect((manifest.meta as any).scripts).toBeUndefined();
      expect(manifest.team.skills).toBe('team/skills/');
      expect(manifest.team.templates).toBe('team/templates/');
    });
  });
});
