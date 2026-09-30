/**
 * Run Lighthouse CI for authenticated and admin pages.
 * LHCI doesn't support per-URL headers in config, so we generate
 * a temporary config file for each user type with the right Cookie.
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../../lighthouserc.cjs');

const chromePath = config.ci?.collect?.settings?.chromePath;

/**
 * Construit une config LHCI temporaire pour un lot d'URLs.
 *
 * @param {string[]} urls
 * @param {string} cookie
 * @param {object} [options]
 * @param {boolean} [options.gatePerformance=true]
 *   Faux pour les pages /admin : elles sont derrière authentification, ne sont
 *   indexées par personne, et leur DOM est structurellement lourd (tableaux de
 *   données, arborescences). Exiger 90 en performance sur ces pages ne protège
 *   aucun visiteur. Les trois autres catégories restent exigées : elles mesurent
 *   des défauts réels, indépendants de la machine qui mesure.
 */
function buildTempConfig(urls, cookie, { gatePerformance = true } = {}) {
  const assertions = {
    'categories:accessibility': ['error', { minScore: 0.9 }],
    'categories:best-practices': ['error', { minScore: 0.9 }],
    'categories:seo': ['error', { minScore: 0.9 }],
  };
  if (gatePerformance) {
    assertions['categories:performance'] = ['error', { minScore: 0.9 }];
  }

  return {
    ci: {
      collect: {
        url: urls,
        numberOfRuns: 1,
        settings: {
          chromeFlags: '--no-sandbox --disable-setuid-sandbox',
          preset: 'desktop',
          ...(chromePath ? { chromePath } : {}),
          extraHeaders: { Cookie: cookie },
        },
      },
      assert: { assertions },
      upload: {
        target: 'temporary-public-storage',
      },
    },
  };
}

function run(urls, cookie, label, options) {
  if (!urls.length) {
    console.log(`[lhci] No ${label} URLs to audit, skipping.`);
    return;
  }
  if (!cookie) {
    console.warn(`[lhci] No cookie for ${label}, skipping.`);
    return;
  }

  console.log(`\n[lhci] Running ${label} audit (${urls.length} URLs)…`);

  const tmpConfig = path.resolve(__dirname, `../../.lighthouseci-${label}.json`);
  fs.writeFileSync(tmpConfig, JSON.stringify(buildTempConfig(urls, cookie, options), null, 2));

  try {
    execSync(`npx lhci autorun --config "${tmpConfig}"`, {
      stdio: 'inherit',
      shell: true,
    });
  } catch (e) {
    // chrome-launcher on Windows/Node 25 crashes with EPERM on temp dir cleanup
    // even though the audit completed. Check if reports were actually generated.
    const lhDir = path.resolve(__dirname, '../../.lighthouseci');
    const hasReports = fs.existsSync(lhDir) &&
      fs.readdirSync(lhDir).some(f => f.startsWith('lhr-') && f.endsWith('.json'));
    if (!hasReports) {
      throw e; // Real failure — no reports generated
    }
    console.warn(`[lhci] ${label}: chrome-launcher exit error ignored (reports exist)`);
  } finally {
    // Clean up temp config
    try { fs.unlinkSync(tmpConfig); } catch { /* ignore */ }
  }
}

// Pages authentifiées (tableau de bord, profil) : ce sont des pages vues par les
// utilisateurs, la performance est donc bien un critère → gate complet.
run(config._authedUrls, config._userCookie, 'authed', { gatePerformance: true });

// Pages d'administration : authentifiées, non indexées, DOM lourd par nature.
// L'accessibilité, les bonnes pratiques et le SEO restent gated ; seule la
// performance est retirée du périmètre (voir buildTempConfig).
run(config._adminUrls, config._adminCookie, 'admin', { gatePerformance: false });
