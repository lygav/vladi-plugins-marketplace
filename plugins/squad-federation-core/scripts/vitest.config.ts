import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
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
