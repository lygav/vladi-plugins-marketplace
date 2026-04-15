import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@squad/federation-core/sdk': path.resolve(__dirname, '../sdk'),
      '@squad/federation-core/sdk/types.js': path.resolve(__dirname, '../sdk/types.ts'),
    }
  },
  root: path.resolve(__dirname, '../..'),
  test: {
    globals: true,
    environment: 'node',
    include: [
      'squad-federation-core/**/__tests__/**/*.test.ts',
      'squad-federation-core/**/*.test.ts',
      'squad-archetype-*/__tests__/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['lib/**', 'sdk/**'],
      exclude: ['**/__tests__/**', '**/node_modules/**', '**/dist/**'],
      // Thresholds will be enforced once lib/ and sdk/ are created in Phase 2+
      // For Phase 1, we're establishing the test infrastructure itself
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
      }
    }
  }
});
