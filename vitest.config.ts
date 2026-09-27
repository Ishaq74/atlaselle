import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';

// Même fallback `.env` que astro.config.mjs / src/database/env.ts.
// `process.env` reste prioritaire : `SITE_URL=... pnpm test` gagne sur `.env`.
loadDotenv({ path: resolve(process.cwd(), '.env') });

// ─── import.meta.env.SITE — the build-time public origin ───────────────────────
// `import.meta.env.SITE` is NOT a runtime lookup: Astro freezes the `site` entry
// of astro.config.mjs into it at build time (`site: siteUrl.origin`, itself
// resolved from SITE_URL). Vitest runs no Astro plugin, so nothing freezes it and
// `import.meta.env.SITE` is `undefined` for every module under test — which makes
// src/pages/sitemap-cms.xml.ts throw its fail-closed error on every call.
//
// The only correct injection reads the SAME variable the build reads and produces
// the SAME string Astro would freeze. There is deliberately no localhost fallback
// and no second constant: a misconfigured origin must fail here, loudly and
// early, rather than silently exercise a sitemap that the build would never emit.
//
// astro.config.mjs remains the authority. Any rule it gains that changes the
// frozen value (protocol, bare origin) must be mirrored below.
const SITE_URL_ENV = 'SITE_URL';

function resolveTestSiteOrigin(): string {
  const raw = process.env[SITE_URL_ENV];
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(
      `[VITEST] ${SITE_URL_ENV} is required but is not set (received: ${raw === undefined ? 'undefined' : 'an empty string'}). ` +
      `Astro freezes it into import.meta.env.SITE (as \`site\`), and src/pages/sitemap-cms.xml.ts refuses to publish without it, so the suite cannot ` +
      `run against a guessed origin. Set ${SITE_URL_ENV} to the public origin of the site (e.g. ${SITE_URL_ENV}="https://example.com"), or to an explicit ` +
      `loopback origin (e.g. ${SITE_URL_ENV}="http://localhost:4321") for local development. astro.config.mjs enforces the same contract for builds.`
    );
  }

  const value = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `[VITEST] ${SITE_URL_ENV} is invalid: "${value}". Expected an absolute http(s) origin such as "https://example.com". astro.config.mjs rejects the same value.`
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `[VITEST] ${SITE_URL_ENV} uses an unsupported protocol: "${value}" (parsed protocol: "${parsed.protocol}"). Only "https:" and "http:" are accepted, exactly as astro.config.mjs requires.`
    );
  }

  // `site` is siteUrl.origin: a path would be silently dropped by .origin, so the
  // tested value would diverge from a build that astro.config.mjs refuses to emit.
  if (parsed.pathname !== '/') {
    throw new Error(
      `[VITEST] ${SITE_URL_ENV} must be a bare origin without a path: "${value}" (path: "${parsed.pathname}"). Astro derives \`site\` from siteUrl.origin, so a path here cannot be tested faithfully.`
    );
  }

  return parsed.origin;
}

const siteOrigin = resolveTestSiteOrigin();

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
      // The single build-time constant Astro would freeze from `site`, injected
      // from SITE_URL. Consumed by src/pages/sitemap-cms.xml.ts through
      // `import.meta.env.SITE` — the same read path as the build.
      SITE: siteOrigin,
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
