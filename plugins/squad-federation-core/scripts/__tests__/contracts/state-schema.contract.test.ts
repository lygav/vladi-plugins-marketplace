/**
 * Contract tests for state machine schema validation
 * Validates that archetype state definitions conform to expected structure
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
    it('should have lifecycle and terminal arrays', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

      expect(manifest.states.lifecycle).toBeDefined();
      expect(Array.isArray(manifest.states.lifecycle)).toBe(true);
      expect(manifest.states.lifecycle.length).toBeGreaterThan(0);
    });

    it('should have non-empty terminal states', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

      expect(manifest.states.terminal).toBeDefined();
      expect(Array.isArray(manifest.states.terminal)).toBe(true);
      expect(manifest.states.terminal.length).toBeGreaterThan(0);
    });

    it('should have valid transition definitions if present', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

      if (manifest.states.transitions && typeof manifest.states.transitions === 'object') {
        const allStates = new Set([...manifest.states.lifecycle, ...manifest.states.terminal]);

        Object.entries(manifest.states.transitions).forEach(([fromState, toStates]) => {
          expect(allStates.has(fromState)).toBe(true);
          expect(Array.isArray(toStates)).toBe(true);

          (toStates as string[]).forEach((toState) => {
            expect(allStates.has(toState)).toBe(true);
          });
        });
      }
    });

    it('should have pauseable flag or array if present', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

      if (manifest.states.pauseable !== undefined) {
        const validType = typeof manifest.states.pauseable === 'boolean' || Array.isArray(manifest.states.pauseable);
        expect(validType).toBe(true);
      }
    });
  });

  describe('coding archetype states', () => {
    it('should have lifecycle and terminal arrays', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

      expect(manifest.states.lifecycle).toBeDefined();
      expect(Array.isArray(manifest.states.lifecycle)).toBe(true);
      expect(manifest.states.lifecycle.length).toBeGreaterThan(0);
    });

    it('should have non-empty terminal states', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

      expect(manifest.states.terminal).toBeDefined();
      expect(Array.isArray(manifest.states.terminal)).toBe(true);
      expect(manifest.states.terminal.length).toBeGreaterThan(0);
    });

    it('should have valid transition definitions if present', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

      if (manifest.states.transitions && typeof manifest.states.transitions === 'object') {
        const allStates = new Set([...manifest.states.lifecycle, ...manifest.states.terminal]);

        Object.entries(manifest.states.transitions).forEach(([fromState, toStates]) => {
          expect(allStates.has(fromState)).toBe(true);
          expect(Array.isArray(toStates)).toBe(true);

          (toStates as string[]).forEach((toState) => {
            expect(allStates.has(toState)).toBe(true);
          });
        });
      }
    });

    it('should have pauseable flag or array if present', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

      if (manifest.states.pauseable !== undefined) {
        const validType = typeof manifest.states.pauseable === 'boolean' || Array.isArray(manifest.states.pauseable);
        expect(validType).toBe(true);
      }
    });
  });

  describe('cross-archetype state consistency', () => {
    it('should use similar lifecycle structure', () => {
      const deliverablePath = join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json');
      const codingPath = join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json');

      const deliverable = JSON.parse(readFileSync(deliverablePath, 'utf-8'));
      const coding = JSON.parse(readFileSync(codingPath, 'utf-8'));

      expect(deliverable.states).toHaveProperty('lifecycle');
      expect(deliverable.states).toHaveProperty('terminal');
      expect(coding.states).toHaveProperty('lifecycle');
      expect(coding.states).toHaveProperty('terminal');

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

    it('should have consistent pauseable configuration', () => {
      const manifestPaths = [
        join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json'),
        join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json'),
      ];

      manifestPaths.forEach((manifestPath) => {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        if (manifest.states.pauseable !== undefined) {
          const validType = typeof manifest.states.pauseable === 'boolean' || Array.isArray(manifest.states.pauseable);
          expect(validType).toBe(true);
        }
      });
    });
  });
});
