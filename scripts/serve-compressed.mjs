/**
 * Production/preview HTTP server for the Astro SSR build WITH text compression.
 *
 * Why this exists:
 * `astro preview` (and the @astrojs/node standalone entry) serve responses
 * WITHOUT gzip/brotli. Lighthouse flags "Enable text compression" on every
 * page (~200–535 KiB savable). This wrapper puts the `compression` middleware
 * in front of the adapter handler — same behaviour as putting nginx in front,
 * but self-contained for preview/CI/E2E.
 *
 * Prerequisites:
 *   pnpm add -D compression
 *
 * Usage:
 *   pnpm build && node scripts/serve-compressed.mjs
 *   HOST=localhost PORT=4322 node scripts/serve-compressed.mjs
 *
 * Wiring (apply these two edits manually):
 *   1. package.json → "preview": "node scripts/serve-compressed.mjs"
 *   2. scripts/e2e-server.mjs → spawn this file instead of the astro CLI
 *      (`node scripts/serve-compressed.mjs` with env PORT=4322).
 *
 * ASTRO_PREVIEW_BACKGROUND is irrelevant here: this process stays in the
 * foreground by construction (no astro CLI daemonization involved).
 */
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import compression from 'compression';

const entryPath = resolve(process.cwd(), 'dist/server/entry.mjs');
if (!existsSync(entryPath)) {
  console.error('[serve] dist/server/entry.mjs not found — run `pnpm build` first.');
  process.exit(1);
}

// Disable the adapter's built-in server — we provide our own (compressed).
process.env.ASTRO_NODE_AUTOSTART = 'disabled';

// pathToFileURL: Windows absolute paths are not valid ESM specifiers (c:\).
const { handler } = await import(pathToFileURL(entryPath).href);

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 4321);

// threshold: 1 KiB — compress anything worth compressing; below that the
// framing overhead outweighs the gain (Lighthouse recommendation).
const compress = compression({ threshold: 1024 });

const server = createServer((req, res) => {
  compress(req, res, (err) => {
    if (err) {
      res.statusCode = 500;
      res.end('Compression error');
      return;
    }
    handler(req, res);
  });
});

server.listen(port, host, () => {
  console.log(`[serve] Astro SSR + text compression listening on http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    // Hard-exit fallback if keep-alive sockets linger.
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
