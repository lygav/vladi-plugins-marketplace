/**
 * Contract Tests — Validate deliverable archetype against SDK contracts
 *
 * Ensures monitor, triage, and aggregate scripts correctly extend SDK
 * base classes and that archetype manifest conforms to expected schema.
 */

import { describe, it, expect } from 'vitest';
import { DeliverableMonitor } from '../meta/scripts/deliverable-monitor.js';
import { DeliverableTriage } from '../meta/scripts/deliverable-triage.js';
import type { StateSchema, ArchetypeManifest } from '@squad/federation-core/sdk/types.js';

describe('Deliverable Archetype Contract Tests', () => {
  describe('Monitor Script', () => {
    it('extends MonitorBase correctly', () => {
      const monitor = new DeliverableMonitor(new Map(), new Map());
      expect(monitor.archetypeName).toBe('deliverable');
      expect(typeof monitor.collectArchetypeData).toBe('function');
      expect(typeof monitor.formatArchetypeColumns).toBe('function');
    });
  });

  describe('Triage Script', () => {
    it('extends TriageBase correctly', () => {
      const triage = new DeliverableTriage();
      expect(typeof triage.diagnose).toBe('function');
      expect(typeof triage.suggestRecovery).toBe('function');
    });
  });

  describe('Aggregate Script', () => {
    it('exports as a runnable module', async () => {
      // aggregate.ts is a CLI script, not a class — verify it can be statically analyzed
      const aggregateSource = await import('fs').then(fs =>
        fs.readFileSync(
          new URL('../meta/scripts/aggregate.ts', import.meta.url).pathname,
          'utf-8'
        )
      );
      expect(aggregateSource).toContain('function main');
      expect(aggregateSource).toContain('discoverAllDomains');
      expect(aggregateSource).toContain('collectDeliverables');
    });
  });

  describe('State Machine', () => {
    it('has valid lifecycle states', async () => {
      const archetype = await import('../team/archetype.json');
      const states = archetype.states as StateSchema;

      expect(states.lifecycle).toHaveLength(4);
      expect(states.lifecycle).toEqual([
        'preparing', 'scanning', 'distilling', 'aggregating'
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

      expect(manifest.name).toBe('squad-archetype-deliverable');
      expect(manifest.version).toBeTruthy();
      expect(manifest.description).toBeTruthy();
      expect(manifest.coreCompatibility).toBeTruthy();
      expect(manifest.meta).toBeDefined();
      expect(manifest.team).toBeDefined();
    });

    it('has valid meta/team paths', async () => {
      const manifest = await import('../archetype.json');

      expect(manifest.meta.skills).toBe('meta/skills/');
      expect(manifest.meta.scripts).toBe('meta/scripts/');
      expect((manifest.meta as any).agents).toBe('meta/agents/');
      expect(manifest.team.skills).toBe('team/skills/');
      expect(manifest.team.templates).toBe('team/templates/');
    });
  });
});
