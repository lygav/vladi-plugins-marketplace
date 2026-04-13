/**
 * Contract tests for archetype manifest validation
 * Validates that all archetype.json files conform to ArchetypeManifestSchema
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArchetypeManifestSchema } from '../../../sdk/schemas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '../../../..');

describe('archetype-manifest.contract.test.ts', () => {
  describe('squad-archetype-deliverable', () => {
    it('should have valid root archetype.json', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-deliverable/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      // The root archetype.json is a simple catalog structure (not a full manifest)
      expect(manifest).toHaveProperty('name');
      expect(manifest).toHaveProperty('version');
      expect(manifest).toHaveProperty('description');
      expect(manifest.name).toBe('squad-archetype-deliverable');
    });

    it('should have valid team/archetype.json conforming to schema', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      // Validate against schema
      const result = ArchetypeManifestSchema.safeParse(manifest);
      if (!result.success) {
        console.error('Validation errors:', result.error.errors);
      }

      expect(result.success).toBe(true);
      expect(manifest.id).toBe('deliverable');
      expect(manifest.name).toBe('Deliverable');
    });

    it('should have required state machine definition', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      expect(manifest).toHaveProperty('states');
      expect(manifest.states).toHaveProperty('lifecycle');
      expect(manifest.states).toHaveProperty('terminal');
      expect(Array.isArray(manifest.states.lifecycle)).toBe(true);
      expect(Array.isArray(manifest.states.terminal)).toBe(true);
      expect(manifest.states.lifecycle.length).toBeGreaterThan(0);
      expect(manifest.states.terminal.length).toBeGreaterThan(0);
    });

    it('should have required monitor configuration', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      expect(manifest).toHaveProperty('monitor');
      expect(manifest.monitor).toHaveProperty('display');
      expect(manifest.monitor.display).toHaveProperty('sectionTitle');
      expect(manifest.monitor.display).toHaveProperty('stateProgressFormat');
      expect(manifest.monitor.display).toHaveProperty('groupByArchetype');
    });

    it('should have valid semver version', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('squad-archetype-coding', () => {
    it('should have valid root archetype.json', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-coding/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      expect(manifest).toHaveProperty('name');
      expect(manifest).toHaveProperty('version');
      expect(manifest).toHaveProperty('description');
      expect(manifest.name).toBe('squad-archetype-coding');
    });

    it('should have valid team/archetype.json conforming to schema', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      // Validate against schema
      const result = ArchetypeManifestSchema.safeParse(manifest);
      if (!result.success) {
        console.error('Validation errors:', result.error.errors);
      }

      expect(result.success).toBe(true);
      expect(manifest.id).toBe('coding');
      expect(manifest.name).toBe('Coding');
    });

    it('should have required state machine definition', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      expect(manifest).toHaveProperty('states');
      expect(manifest.states).toHaveProperty('lifecycle');
      expect(manifest.states).toHaveProperty('terminal');
      expect(Array.isArray(manifest.states.lifecycle)).toBe(true);
      expect(Array.isArray(manifest.states.terminal)).toBe(true);
      expect(manifest.states.lifecycle.length).toBeGreaterThan(0);
      expect(manifest.states.terminal.length).toBeGreaterThan(0);
    });

    it('should have required monitor configuration', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      expect(manifest).toHaveProperty('monitor');
      expect(manifest.monitor).toHaveProperty('display');
      expect(manifest.monitor.display).toHaveProperty('sectionTitle');
      expect(manifest.monitor.display).toHaveProperty('stateProgressFormat');
      expect(manifest.monitor.display).toHaveProperty('groupByArchetype');
    });

    it('should have valid semver version', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('cross-archetype consistency', () => {
    it('should use consistent schema structure', () => {
      const deliverablePath = join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json');
      const codingPath = join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json');

      const deliverable = JSON.parse(readFileSync(deliverablePath, 'utf-8'));
      const coding = JSON.parse(readFileSync(codingPath, 'utf-8'));

      // Both should have the same required top-level keys
      const deliverableKeys = new Set(Object.keys(deliverable));
      const codingKeys = new Set(Object.keys(coding));

      const requiredKeys = ['id', 'name', 'description', 'version', 'states', 'monitor'];
      requiredKeys.forEach((key) => {
        expect(deliverableKeys.has(key)).toBe(true);
        expect(codingKeys.has(key)).toBe(true);
      });
    });

    it('should have unique archetype IDs', () => {
      const deliverablePath = join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json');
      const codingPath = join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json');

      const deliverable = JSON.parse(readFileSync(deliverablePath, 'utf-8'));
      const coding = JSON.parse(readFileSync(codingPath, 'utf-8'));

      expect(deliverable.id).not.toBe(coding.id);
      expect(deliverable.id).toBe('deliverable');
      expect(coding.id).toBe('coding');
    });

    it('should have valid monitor display configurations', () => {
      const deliverablePath = join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json');
      const codingPath = join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json');

      const deliverable = JSON.parse(readFileSync(deliverablePath, 'utf-8'));
      const coding = JSON.parse(readFileSync(codingPath, 'utf-8'));

      const validFormats = ['percentage', 'step', 'custom'];

      expect(validFormats).toContain(deliverable.monitor.display.stateProgressFormat);
      expect(validFormats).toContain(coding.monitor.display.stateProgressFormat);
      expect(typeof deliverable.monitor.display.groupByArchetype).toBe('boolean');
      expect(typeof coding.monitor.display.groupByArchetype).toBe('boolean');
    });
  });
});
