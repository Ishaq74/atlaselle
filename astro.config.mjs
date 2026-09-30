import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import Icon from "astro-icon";
import sitemap from '@astrojs/sitemap';

import node from '@astrojs/node';

import { config as loadDotenv } from 'dotenv';
import path from 'node:path';

// Charge `.env` en fallback (même pattern que src/database/env.ts et
// src/smtp/env.ts). `process.env` reste prioritaire (override: false par
// défaut) : les jobs CI qui pinnent SITE_URL par job gardent leur origine,
// le dev local lit simplement son `.env` sans export manuel.
loadDotenv({ path: path.resolve(process.cwd(), '.env') });

// Single source of truth for the public origin: `site`, `security.allowedDomains`
// and `customSitemaps` are all derived from it. It is fail-closed on purpose — a
// missing or malformed SITE_URL is an infrastructure error, and degrading it to
// http://localhost:4321 silently ships localhost absolute URLs in the sitemaps,
// canonicals and emails, and pins every mutating form to a 403 in production.
const SITE_URL_ENV = 'SITE_URL';
const LOOPBACK_HOSTNAMES = new Set(['localhost', '::1', '[::1]', '0:0:0:0:0:0:0:1']);

function isLoopbackHostname(hostname) {
  const host = hostname.toLowerCase();
  if (LOOPBACK_HOSTNAMES.has(host)) return true;
  if (host.endsWith('.localhost')) return true;
  if (!/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return false;
  return host.split('.').every((octet) => Number(octet) <= 255);
}

function resolveSiteUrl() {
  const raw = process.env[SITE_URL_ENV];
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(
      `[ASTRO] ${SITE_URL_ENV} is required but is not set (received: ${raw === undefined ? 'undefined' : 'an empty string'}). ` +
      `Set ${SITE_URL_ENV} to the public origin of the site (e.g. ${SITE_URL_ENV}="https://example.com") for builds, ` +
      `or to an explicit loopback origin (e.g. ${SITE_URL_ENV}="http://localhost:4321") for local development. ` +
      `It is resolved once and drives "site", "security.allowedDomains" and the sitemap index.`
    );
  }

  const value = raw.trim();
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `[ASTRO] ${SITE_URL_ENV} is invalid: "${value}". Expected an absolute http(s) origin such as "https://example.com".`
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `[ASTRO] ${SITE_URL_ENV} uses an unsupported protocol: "${value}" (parsed protocol: "${parsed.protocol}"). ` +
      `Only "https:" and "http:" are accepted.`
    );
  }

  if (parsed.protocol === 'http:' && !isLoopbackHostname(parsed.hostname)) {
    throw new Error(
      `[ASTRO] ${SITE_URL_ENV} must use https: for a non-loopback host: "${value}" (host: "${parsed.hostname}"). ` +
      `Plain http is only accepted for loopback hosts (localhost, *.localhost, 127.0.0.0/8, ::1) because the CSP is ` +
      `served over TLS: an http origin here would emit http absolute URLs and downgrade the canonical origin.`
    );
  }

  if (parsed.pathname !== '/') {
    throw new Error(
      `[ASTRO] ${SITE_URL_ENV} must be a bare origin without a path: "${value}" (path: "${parsed.pathname}"). ` +
      `Serve the site from the root and use the Astro "base" option for a sub-path deployment.`
    );
  }

  return parsed;
}

const siteUrl = resolveSiteUrl();

// https://astro.build/config
export default defineConfig({
  output: 'server',
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      noDiscovery: true,
    },
  },

  site: siteUrl.origin,

  i18n: {
    locales: ['fr', 'en', 'es', 'ar'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: true,
    },
  },

  // Le blog est stocké en HTML dans PostgreSQL : aucun fichier .md, aucune
  // content collection, aucun composant <Code>. La coloration Shiki est donc
  // activée par défaut alors qu'elle ne sert à rien — et elle est incompatible
  // avec notre CSP, qui autorise les styles inline via `styleDirective` mais
  // refuse les feuilles inline non hachées de Shiki. Astro émettait un
  // avertissement à chaque build pour signaler exactement ce conflit.
  //
  // Désactiver la coloration supprime à la fois l'avertissement et le
  // vecteur d'incohérence CSP. Si un jour on introduit du Markdown, il faudra
  // choisir explicitement `syntaxHighlight: 'prism'` (classes CSS, donc
  // compatible CSP) plutôt que de réactiver Shiki.
  markdown: {
    syntaxHighlight: false,
  },

  integrations: [
    Icon({
      include: {
        mdi: ['*'],
        'circle-flags': ['*'],
        openmoji: ['*'],
      },
    }),
    sitemap({
      // SSR mode: no pages are prerendered, so auto-discovery finds nothing.
      // All public URLs live in /sitemap-cms.xml (runtime endpoint).
      // customSitemaps adds it to the generated sitemap-index.xml.
      customSitemaps: [
        `${siteUrl.origin}/sitemap-cms.xml`,
      ],
      i18n: {
        defaultLocale: 'en',
        locales: {
          fr: 'fr-FR',
          en: 'en-US',
          es: 'es-ES',
          ar: 'ar',
        },
      },
    }),
  ],

  adapter: node({
    mode: 'standalone'
  }),

  // Astro v5+ enables security.checkOrigin by default — explicit for clarity.
  // This validates the Origin header on POST/PATCH/DELETE/PUT requests,
  // providing CSRF protection for all API endpoints and Astro Actions.
  security: {
    checkOrigin: true,
    // Only the hostname, never `protocol` and never `port`:
    // - `protocol` is matched against the socket protocol (http: behind a TLS
    //   reverse proxy), so pinning "https" makes validateHost() return undefined
    //   and clientAddress collapses to the proxy IP for every request, which
    //   breaks the audit trail and all six IP-keyed rate limits.
    // - `port` is matched by strict string equality against X-Forwarded-Port, and
    //   new URL("https://host:443").port is "", so a port in the pattern breaks
    //   forwarded-header validation silently.
    allowedDomains: [{ hostname: siteUrl.hostname }],
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self' https://api.iconify.design https://api.stripe.com",
        "frame-src https://www.google.com https://www.youtube.com https://player.vimeo.com https://js.stripe.com https://hooks.stripe.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ],
      // `style-src` est la SEULE directive relâchée, et de façon scopée :
      // `'unsafe-inline'` est autorisé pour les `<style>` générés (kind
      // "element") ET pour les attributs `style=""` (kind "attribute"), et
      // rien d'autre. La variante « stricte » n'est pas exploitable ici :
      // `unsafe-hashes` n'autorise PAS les attributs de style (il faudrait le
      // hachage de chaque valeur), et le design system en produit partout —
      // durées d'animation des dialogues, variables des carrousels, aperçu live
      // de l'éditeur de thème. Sans cela, la console se remplit de violations et
      // l'aperçu de thème s'affiche inerte.
      //
      // Le risque résiduel (exfiltration via CSS) est aujourd'hui considéré
      // comme nul : `scriptDirective` reste strict, donc aucune injection de
      // script n'est possible par ce canal. Les valeurs *dynamiques* (barre de
      // lecture, atome `Progress`) n'utilisent d'ailleurs pas ce canal : elles
      // passent par le CSSOM (`el.style.…`), que la CSP ne bloque pas — c'est
      // verrouillé par `tests/unit/csp-contract.test.ts`.
      styleDirective: {
        // Pas d'entrée `'self'` générique : dès lors que `style-src-elem` et
        // `style-src-attr` sont définis, ils REMPLACENT `style-src` pour leur
        // périmètre (les navigateurs ne retombent pas dessus — d'où l'avertissement
        // Astro `csp.styleDirective`). Toute source utile doit donc être
        // déclarée explicitement par `kind`.
        resources: [
          // `style-src-elem` remplace le `style-src` générique pour les `<style>`
          // et les `<link rel="stylesheet">` : sans `'self'` là-bas, les
          // feuilles de style compilées par Astro sont bloquées et TOUTE la
          // mise en page disparaît (on l'a vu : le bandeau cookies, masqué par
          // une classe `hidden`, restait visible).
          { resource: "'self'", kind: "element" },
          { resource: "'unsafe-inline'", kind: "element" },
          { resource: "'unsafe-inline'", kind: "attribute" },
        ],
      },
      // Stripe.js autorisé pour le module payments (script tiers éditorial : néant).
      scriptDirective: {
        // 'self' is required: without it the CSP blocks every bundled
        // /_astro/*.js (auth forms, dropdowns, toasts…) — only the Astro-managed
        // inline-script hashes were allowed.
        resources: ["'self'", 'https://js.stripe.com'],
      },
    },
  },

  // Astro manages CSP hashes for bundled scripts/styles.
  // Additional security headers are set in src/middleware.ts.
});
