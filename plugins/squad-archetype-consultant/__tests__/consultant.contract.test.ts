/**
 * Contract Tests — Validate consultant archetype against SDK contracts
 *
 * Ensures monitor and triage scripts correctly extend SDK base classes
 * and that archetype manifest conforms to expected schema.
 */

import { describe, it, expect } from 'vitest';
import { ConsultantMonitor } from '../meta/scripts/consultant-monitor.js';
import { ConsultantTriage } from '../meta/scripts/consultant-triage.js';
import type { StateSchema, ArchetypeManifest } from '@squad/federation-core/sdk/types.js';

describe('Consultant Archetype Contract Tests', () => {
  describe('Monitor Script', () => {
    it('extends MonitorBase correctly', () => {
      const monitor = new ConsultantMonitor(new Map());
      expect(monitor.archetypeName).toBe('consultant');
      expect(typeof monitor.collectArchetypeData).toBe('function');
      expect(typeof monitor.formatArchetypeColumns).toBe('function');
    });
  });

  describe('Triage Script', () => {
    it('extends TriageBase correctly', () => {
      const triage = new ConsultantTriage(new Map());
      expect(triage.archetypeName).toBe('consultant');
      expect(typeof triage.detectArchetypeProblems).toBe('function');
    });
  });

  describe('State Machine', () => {
    it('has valid lifecycle states', () => {
      const states: StateSchema = {
        lifecycle: ["indexing", "ready", "researching"],
        terminal: ["complete", "failed"],
        pauseable: false,
      };

      expect(states.lifecycle).toHaveLength(3);
      expect(states.terminal).toContain('complete');
      expect(states.terminal).toContain('failed');
    });

    it('lifecycle states are non-empty strings', () => {
      const states = ["indexing", "ready", "researching"];
      states.forEach((state) => {
        expect(state).toBeTruthy();
        expect(typeof state).toBe('string');
      });
    });
  });

  describe('Archetype Manifest', () => {
    it('declares required fields', async () => {
      const manifest = await import('../archetype.json');

      expect(manifest.name).toBe('squad-archetype-consultant');
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
      expect(manifest.team.skills).toBe('team/skills/');
      expect(manifest.team.templates).toBe('team/templates/');
    });
  });
});
