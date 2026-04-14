/**
 * Unit tests for learning-log.ts — learning log operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { LearningLog } from '../../lib/learning-log.js';

const TEST_ROOT = path.join(process.cwd(), 'scripts', '__tests__', 'tmp');

describe('learning-log.ts', () => {
  let squadRoot: string;
  let log: LearningLog;

  beforeEach(async () => {
    await fs.mkdir(TEST_ROOT, { recursive: true });
    squadRoot = path.join(TEST_ROOT, `learning-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    await fs.mkdir(squadRoot, { recursive: true });
    log = new LearningLog(squadRoot);
  });

  afterEach(async () => {
    await fs.rm(squadRoot, { recursive: true, force: true });
  });

  it('should append single learning entry', () => {
    const entry = log.append({
      agent: 'tester',
      type: 'pattern',
      confidence: 'medium',
      domain: 'generalizable',
      tags: ['test'],
      title: 'Test learning',
      body: 'Details',
    });

    expect(entry.id).toBeDefined();
    expect(entry.version).toBe('1.0');
  });

  it('should query appended entries', () => {
    log.append({
      agent: 'tester',
      type: 'pattern',
      confidence: 'medium',
      domain: 'generalizable',
      tags: ['alpha'],
      title: 'First',
      body: 'First body',
    });
    log.append({
      agent: 'tester',
      type: 'discovery',
      confidence: 'high',
      domain: 'generalizable',
      tags: ['beta'],
      title: 'Second',
      body: 'Second body',
    });

    const patterns = log.query({ type: 'pattern' });
    expect(patterns).toHaveLength(1);
    expect(patterns[0].title).toBe('First');
  });
});
