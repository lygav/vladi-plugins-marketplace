/**
 * Contract tests for state machine schema validation
 * Validates that archetype state definitions conform to StateSchemaSchema
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StateSchemaSchema } from '../../../sdk/schemas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '../../../../..');

describe('state-schema.contract.test.ts', () => {
  describe('StateSchemaSchema validation', () => {
    it('should validate minimal state schema', () => {
      const minimalSchema = {
        lifecycle: ['idle', 'active', 'done'],
        terminal: ['done'],
      };

      const result = StateSchemaSchema.safeParse(minimalSchema);
      expect(result.success).toBe(true);
    });

    it('should validate complete state schema', () => {
      const completeSchema = {
        lifecycle: ['idle', 'scanning', 'analyzing', 'paused', 'completed', 'failed'],
        terminal: ['completed', 'failed'],
        pauseable: ['scanning', 'analyzing'],
        transitions: {
          idle: ['scanning'],
          scanning: ['analyzing', 'paused', 'failed'],
          analyzing: ['paused', 'completed', 'failed'],
          paused: ['scanning', 'analyzing'],
        },
        descriptions: {
          idle: 'Team is idle and awaiting directive',
          scanning: 'Actively scanning workspace',
          analyzing: 'Analyzing discovered items',
          paused: 'Temporarily paused',
          completed: 'Work successfully completed',
          failed: 'Work failed with errors',
        },
      };

      const result = StateSchemaSchema.safeParse(completeSchema);
      expect(result.success).toBe(true);
    });

    it('should reject schema with empty lifecycle', () => {
      const invalidSchema = {
        lifecycle: [],
        terminal: ['done'],
      };

      const result = StateSchemaSchema.safeParse(invalidSchema);
      expect(result.success).toBe(false);
    });

    it('should reject schema with empty terminal', () => {
      const invalidSchema = {
        lifecycle: ['idle', 'done'],
        terminal: [],
      };

      const result = StateSchemaSchema.safeParse(invalidSchema);
      expect(result.success).toBe(false);
    });

    it('should reject schema without lifecycle', () => {
      const invalidSchema = {
        terminal: ['done'],
      };

      const result = StateSchemaSchema.safeParse(invalidSchema);
      expect(result.success).toBe(false);
    });

    it('should reject schema without terminal', () => {
      const invalidSchema = {
        lifecycle: ['idle', 'done'],
      };

      const result = StateSchemaSchema.safeParse(invalidSchema);
      expect(result.success).toBe(false);
    });
  });

  describe('deliverable archetype states', () => {
    it('should have valid state schema', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      const result = StateSchemaSchema.safeParse(manifest.states);
      if (!result.success) {
        console.error('Validation errors:', result.error.errors);
      }

      expect(result.success).toBe(true);
    });

    it('should have non-empty lifecycle', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      expect(manifest.states.lifecycle).toBeDefined();
      expect(Array.isArray(manifest.states.lifecycle)).toBe(true);
      expect(manifest.states.lifecycle.length).toBeGreaterThan(0);
    });

    it('should have non-empty terminal states', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      expect(manifest.states.terminal).toBeDefined();
      expect(Array.isArray(manifest.states.terminal)).toBe(true);
      expect(manifest.states.terminal.length).toBeGreaterThan(0);
    });

    it('should have terminal states in lifecycle', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      const { lifecycle, terminal } = manifest.states;
      const lifecycleSet = new Set(lifecycle);

      terminal.forEach((state: string) => {
        expect(lifecycleSet.has(state)).toBe(true);
      });
    });

    it('should have valid transition definitions if present', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      if (manifest.states.transitions) {
        const { lifecycle, transitions } = manifest.states;
        const lifecycleSet = new Set(lifecycle);

        Object.entries(transitions).forEach(([fromState, toStates]) => {
          expect(lifecycleSet.has(fromState)).toBe(true);
          expect(Array.isArray(toStates)).toBe(true);

          (toStates as string[]).forEach((toState) => {
            expect(lifecycleSet.has(toState)).toBe(true);
          });
        });
      }
    });

    it('should have valid pauseable states if present', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      if (manifest.states.pauseable) {
        const { lifecycle, pauseable, terminal } = manifest.states;
        const lifecycleSet = new Set(lifecycle);
        const terminalSet = new Set(terminal);

        pauseable.forEach((state: string) => {
          expect(lifecycleSet.has(state)).toBe(true);
          expect(terminalSet.has(state)).toBe(false);
        });
      }
    });
  });

  describe('coding archetype states', () => {
    it('should have valid state schema', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      const result = StateSchemaSchema.safeParse(manifest.states);
      if (!result.success) {
        console.error('Validation errors:', result.error.errors);
      }

      expect(result.success).toBe(true);
    });

    it('should have non-empty lifecycle', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      expect(manifest.states.lifecycle).toBeDefined();
      expect(Array.isArray(manifest.states.lifecycle)).toBe(true);
      expect(manifest.states.lifecycle.length).toBeGreaterThan(0);
    });

    it('should have non-empty terminal states', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      expect(manifest.states.terminal).toBeDefined();
      expect(Array.isArray(manifest.states.terminal)).toBe(true);
      expect(manifest.states.terminal.length).toBeGreaterThan(0);
    });

    it('should have terminal states in lifecycle', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      const { lifecycle, terminal } = manifest.states;
      const lifecycleSet = new Set(lifecycle);

      terminal.forEach((state: string) => {
        expect(lifecycleSet.has(state)).toBe(true);
      });
    });

    it('should have valid transition definitions if present', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      if (manifest.states.transitions) {
        const { lifecycle, transitions } = manifest.states;
        const lifecycleSet = new Set(lifecycle);

        Object.entries(transitions).forEach(([fromState, toStates]) => {
          expect(lifecycleSet.has(fromState)).toBe(true);
          expect(Array.isArray(toStates)).toBe(true);

          (toStates as string[]).forEach((toState) => {
            expect(lifecycleSet.has(toState)).toBe(true);
          });
        });
      }
    });

    it('should have valid pauseable states if present', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      if (manifest.states.pauseable) {
        const { lifecycle, pauseable, terminal } = manifest.states;
        const lifecycleSet = new Set(lifecycle);
        const terminalSet = new Set(terminal);

        pauseable.forEach((state: string) => {
          expect(lifecycleSet.has(state)).toBe(true);
          expect(terminalSet.has(state)).toBe(false);
        });
      }
    });
  });

  describe('cross-archetype state consistency', () => {
    it('should use similar lifecycle structure', () => {
      const deliverablePath = join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json');
      const codingPath = join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json');

      const deliverable = JSON.parse(readFileSync(deliverablePath, 'utf-8'));
      const coding = JSON.parse(readFileSync(codingPath, 'utf-8'));

      // Both should have lifecycle and terminal
      expect(deliverable.states).toHaveProperty('lifecycle');
      expect(deliverable.states).toHaveProperty('terminal');
      expect(coding.states).toHaveProperty('lifecycle');
      expect(coding.states).toHaveProperty('terminal');

      // Lifecycles should be non-empty
      expect(deliverable.states.lifecycle.length).toBeGreaterThan(0);
      expect(coding.states.lifecycle.length).toBeGreaterThan(0);
    });

    it('should have at least one terminal state each', () => {
      const deliverablePath = join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json');
      const codingPath = join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json');

      const deliverable = JSON.parse(readFileSync(deliverablePath, 'utf-8'));
      const coding = JSON.parse(readFileSync(codingPath, 'utf-8'));

      expect(deliverable.states.terminal.length).toBeGreaterThan(0);
      expect(coding.states.terminal.length).toBeGreaterThan(0);
    });

    it('should not have overlapping terminal states with pauseable states', () => {
      const manifestPaths = [
        join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json'),
        join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json'),
      ];

      manifestPaths.forEach((path) => {
        const manifest = JSON.parse(readFileSync(path, 'utf-8'));
        if (manifest.states.pauseable) {
          const terminalSet = new Set(manifest.states.terminal);
          manifest.states.pauseable.forEach((state: string) => {
            expect(terminalSet.has(state)).toBe(false);
          });
        }
      });
    });
  });
});
