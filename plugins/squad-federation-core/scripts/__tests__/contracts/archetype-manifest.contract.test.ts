/**
 * Contract tests for archetype manifest validation
 * Validates that all archetype.json files conform to expected schemas
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StateSchemaSchema } from '../../../sdk/schemas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '../../../../..');

describe('archetype-manifest.contract.test.ts', () => {
  describe('squad-archetype-deliverable', () => {
    it('should have valid root archetype.json', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-deliverable/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      // The root archetype.json is a plugin catalog manifest
      expect(manifest).toHaveProperty('name');
      expect(manifest).toHaveProperty('version');
      expect(manifest).toHaveProperty('description');
      expect(manifest.name).toBe('squad-archetype-deliverable');
    });

    it('should have valid team/archetype.json with state machine', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      // team/archetype.json is a runtime state machine definition
      expect(manifest).toHaveProperty('states');
      expect(manifest.states).toHaveProperty('lifecycle');
      expect(manifest.states).toHaveProperty('terminal');
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

    it('should have valid root manifest version', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-deliverable/archetype.json');
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

    it('should have valid team/archetype.json with state machine', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      // team/archetype.json is a runtime state machine definition
      expect(manifest).toHaveProperty('states');
      expect(manifest.states).toHaveProperty('lifecycle');
      expect(manifest.states).toHaveProperty('terminal');
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

    it('should have valid root manifest version', () => {
      const manifestPath = join(repoRoot, 'plugins/squad-archetype-coding/archetype.json');
      const manifestRaw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('cross-archetype consistency', () => {
    it('should use consistent state schema structure', () => {
      const deliverablePath = join(repoRoot, 'plugins/squad-archetype-deliverable/team/archetype.json');
      const codingPath = join(repoRoot, 'plugins/squad-archetype-coding/team/archetype.json');

      const deliverable = JSON.parse(readFileSync(deliverablePath, 'utf-8'));
      const coding = JSON.parse(readFileSync(codingPath, 'utf-8'));

      // Both should have states with lifecycle and terminal
      expect(deliverable.states).toHaveProperty('lifecycle');
      expect(deliverable.states).toHaveProperty('terminal');
      expect(coding.states).toHaveProperty('lifecycle');
      expect(coding.states).toHaveProperty('terminal');
    });

    it('should have unique archetype names in root manifests', () => {
      const deliverablePath = join(repoRoot, 'plugins/squad-archetype-deliverable/archetype.json');
      const codingPath = join(repoRoot, 'plugins/squad-archetype-coding/archetype.json');

      const deliverable = JSON.parse(readFileSync(deliverablePath, 'utf-8'));
      const coding = JSON.parse(readFileSync(codingPath, 'utf-8'));

      expect(deliverable.name).not.toBe(coding.name);
      expect(deliverable.name).toBe('squad-archetype-deliverable');
      expect(coding.name).toBe('squad-archetype-coding');
    });
  });
});
