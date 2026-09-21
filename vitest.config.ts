import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
      '@i18n': resolve(import.meta.dirname, 'src/i18n'),
      '@components': resolve(import.meta.dirname, 'src/components'),
      '@lib': resolve(import.meta.dirname, 'src/lib'),
      '@database': resolve(import.meta.dirname, 'src/database'),
      '@smtp': resolve(import.meta.dirname, 'src/smtp'),
      '@media': resolve(import.meta.dirname, 'src/media'),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['./tests/helpers/voyage-global-setup.ts'],
    env: {
      NODE_ENV: 'test',
    },
    testTimeout: 15_000,
    reporters: ['default', 'json'],
    outputFile: {
      json: 'tests/reports/vitest-results.json',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'tests/reports/coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/env.d.ts',
        'src/content.config.ts',
        'src/**/*.astro',
        'src/database/migrations/**',
        'src/database/data/**',
        'src/database/commands/**',
        'src/database/drizzle.ts',

        'src/components/**/index.ts',
        'src/components/**/*Types.ts',
        'src/components/**/carousel-script.ts',
        'src/components/**/toast-manager.ts',
        'src/i18n/fr/**',
        'src/i18n/en/**',
        'src/i18n/es/**',
        'src/i18n/ar/**',
        'src/actions/index.ts',
        'src/pages/**',
        'src/middleware.ts',
        'src/lib/starwind/**',
        'src/lib/auth.ts',
        'src/lib/auth-client.ts',
        'src/lib/auth-data.ts',
        'src/smtp/**',
        'src/assets/**',
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 75,
        lines: 80,
      },
    },
  },
});
