/**
 * Unit tests for learning-log.ts — learning log operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockCommunication } from '../helpers/mock-communication.js';
import { createTestLearning } from '../helpers/test-fixtures.js';

describe('learning-log.ts', () => {
  let communication: MockTransport;

  beforeEach(() => {
    communication = new MockCommunication();
  });

  describe('append operations', () => {
    it('should append single learning entry', async () => {
      const entry = createTestLearning({ content: 'Test learning' });

      await communication.appendLearning('team-alpha', entry);
      const entries = await communication.readLearningLog('team-alpha');

      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual(entry);
    });

    it('should append multiple entries in order', async () => {
      const entries = [
        createTestLearning({ id: 'entry-1', content: 'First' }),
        createTestLearning({ id: 'entry-2', content: 'Second' }),
        createTestLearning({ id: 'entry-3', content: 'Third' }),
      ];

      for (const entry of entries) {
        await communication.appendLearning('team-alpha', entry);
      }

      const result = await communication.readLearningLog('team-alpha');
      expect(result).toHaveLength(3);
      expect(result.map((e) => e.id)).toEqual(['entry-1', 'entry-2', 'entry-3']);
    });

    it('should preserve entry metadata', async () => {
      const entry = createTestLearning({
        type: 'pattern',
        confidence: 'high',
        tags: ['performance', 'optimization'],
        graduated: true,
        graduated_to: 'shared-skills',
      });

      await communication.appendLearning('team-alpha', entry);
      const result = await communication.readLearningLog('team-alpha');

      expect(result[0].type).toBe('pattern');
      expect(result[0].confidence).toBe('high');
      expect(result[0].tags).toEqual(['performance', 'optimization']);
      expect(result[0].graduated).toBe(true);
      expect(result[0].graduated_to).toBe('shared-skills');
    });
  });

  describe('read operations', () => {
    it('should return empty array for new log', async () => {
      const entries = await communication.readLearningLog('team-alpha');
      expect(entries).toEqual([]);
    });

    it('should read all entries', async () => {
      const testEntries = [
        createTestLearning({ content: 'Learning 1' }),
        createTestLearning({ content: 'Learning 2' }),
        createTestLearning({ content: 'Learning 3' }),
      ];

      for (const entry of testEntries) {
        await communication.appendLearning('team-alpha', entry);
      }

      const result = await communication.readLearningLog('team-alpha');
      expect(result).toHaveLength(3);
    });

    it('should parse JSONL format correctly', async () => {
      const entries = [
        createTestLearning({ content: 'Entry 1' }),
        createTestLearning({ content: 'Entry 2' }),
      ];

      for (const entry of entries) {
        await communication.appendLearning('team-alpha', entry);
      }

      const result = await communication.readLearningLog('team-alpha');
      expect(result.every((e) => typeof e === 'object')).toBe(true);
      expect(result.every((e) => e.hasOwnProperty('id'))).toBe(true);
      expect(result.every((e) => e.hasOwnProperty('content'))).toBe(true);
    });
  });

  describe('learning types', () => {
    const types: Array<'discovery' | 'correction' | 'pattern' | 'technique' | 'gotcha'> = [
      'discovery',
      'correction',
      'pattern',
      'technique',
      'gotcha',
    ];

    types.forEach((type) => {
      it(`should support ${type} learning type`, async () => {
        const entry = createTestLearning({ type, content: `Test ${type}` });

        await communication.appendLearning('team-alpha', entry);
        const result = await communication.readLearningLog('team-alpha');

        expect(result[0].type).toBe(type);
      });
    });

    it('should handle mixed learning types', async () => {
      for (const type of types) {
        await communication.appendLearning('team-alpha', createTestLearning({ type }));
      }

      const result = await communication.readLearningLog('team-alpha');
      const resultTypes = new Set(result.map((e) => e.type));
      expect(resultTypes).toEqual(new Set(types));
    });
  });

  describe('confidence levels', () => {
    const levels: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

    levels.forEach((confidence) => {
      it(`should support ${confidence} confidence level`, async () => {
        const entry = createTestLearning({ confidence });

        await communication.appendLearning('team-alpha', entry);
        const result = await communication.readLearningLog('team-alpha');

        expect(result[0].confidence).toBe(confidence);
      });
    });

    it('should track confidence across entries', async () => {
      for (const confidence of levels) {
        await communication.appendLearning('team-alpha', createTestLearning({ confidence }));
      }

      const result = await communication.readLearningLog('team-alpha');
      expect(result.map((e) => e.confidence)).toEqual(levels);
    });
  });

  describe('graduation workflow', () => {
    it('should mark learning as graduated', async () => {
      const entry = createTestLearning({
        content: 'Valuable pattern',
        graduated: true,
        graduated_to: 'shared-skills',
      });

      await communication.appendLearning('team-alpha', entry);
      const result = await communication.readLearningLog('team-alpha');

      expect(result[0].graduated).toBe(true);
      expect(result[0].graduated_to).toBe('shared-skills');
    });

    it('should track superseded entries', async () => {
      const oldEntry = createTestLearning({
        id: 'old-pattern',
        content: 'Old pattern',
      });

      const newEntry = createTestLearning({
        id: 'new-pattern',
        content: 'Improved pattern',
        supersedes: 'old-pattern',
      });

      await communication.appendLearning('team-alpha', oldEntry);
      await communication.appendLearning('team-alpha', newEntry);

      const result = await communication.readLearningLog('team-alpha');
      const improved = result.find((e) => e.id === 'new-pattern');
      expect(improved?.supersedes).toBe('old-pattern');
    });

    it('should support graduation without explicit target', async () => {
      const entry = createTestLearning({
        content: 'Graduated learning',
        graduated: true,
      });

      await communication.appendLearning('team-alpha', entry);
      const result = await communication.readLearningLog('team-alpha');

      expect(result[0].graduated).toBe(true);
      expect(result[0].graduated_to).toBeUndefined();
    });
  });

  describe('tagging system', () => {
    it('should support tags', async () => {
      const entry = createTestLearning({
        content: 'Tagged learning',
        tags: ['tag1', 'tag2', 'tag3'],
      });

      await communication.appendLearning('team-alpha', entry);
      const result = await communication.readLearningLog('team-alpha');

      expect(result[0].tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should handle entries without tags', async () => {
      const entry = createTestLearning({ content: 'Untagged' });

      await communication.appendLearning('team-alpha', entry);
      const result = await communication.readLearningLog('team-alpha');

      expect(result[0].tags).toBeUndefined();
    });

    it('should support empty tag arrays', async () => {
      const entry = createTestLearning({
        content: 'Empty tags',
        tags: [],
      });

      await communication.appendLearning('team-alpha', entry);
      const result = await communication.readLearningLog('team-alpha');

      expect(result[0].tags).toEqual([]);
    });
  });

  describe('cross-team isolation', () => {
    it('should isolate logs between teams', async () => {
      await communication.appendLearning('team-alpha', createTestLearning({ content: 'Alpha learning' }));
      await communication.appendLearning('team-beta', createTestLearning({ content: 'Beta learning' }));

      const alphaLog = await communication.readLearningLog('team-alpha');
      const betaLog = await communication.readLearningLog('team-beta');

      expect(alphaLog).toHaveLength(1);
      expect(betaLog).toHaveLength(1);
      expect(alphaLog[0].content).toBe('Alpha learning');
      expect(betaLog[0].content).toBe('Beta learning');
    });

    it('should not share entries across teams', async () => {
      await communication.appendLearning('team-alpha', createTestLearning({ content: 'Private' }));

      const betaLog = await communication.readLearningLog('team-beta');
      expect(betaLog).toEqual([]);
    });
  });

  describe('JSONL format validation', () => {
    it('should handle single-line entries', async () => {
      const entry = createTestLearning({ content: 'Single line' });

      await communication.appendLearning('team-alpha', entry);
      const raw = await communication.readFile('team-alpha', '.squad/learning.jsonl');

      expect(raw).not.toBeNull();
      expect(raw?.split('\n').filter((l) => l.trim()).length).toBe(1);
    });

    it('should handle multi-line content in entries', async () => {
      const entry = createTestLearning({
        content: 'Line 1\nLine 2\nLine 3',
      });

      await communication.appendLearning('team-alpha', entry);
      const result = await communication.readLearningLog('team-alpha');

      expect(result[0].content).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should preserve entry order in JSONL', async () => {
      const entries = [
        createTestLearning({ id: '1' }),
        createTestLearning({ id: '2' }),
        createTestLearning({ id: '3' }),
      ];

      for (const entry of entries) {
        await communication.appendLearning('team-alpha', entry);
      }

      const result = await communication.readLearningLog('team-alpha');
      expect(result.map((e) => e.id)).toEqual(['1', '2', '3']);
    });
  });
});
