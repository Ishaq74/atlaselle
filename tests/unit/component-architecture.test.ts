import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Garde-fou d'architecture des composants.
 *
 * Ces règles ont été établies en rangeant blog, services et voyages. Elles
 * protègent contre la régression : un `.astro` qui retourne sous `src/modules/`
 * ou qui se met à interroger la base casse la frontière
 * `modules = logique métier` / `components = présentation`, et le next
 * composant généré reintroduirait le désordre.
 */

const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const sourceFiles = walk(join(ROOT, "src"));
const astroFiles = sourceFiles.filter((f) => f.endsWith(".astro"));
const rel = (f: string) => relative(ROOT, f).replace(/\\/g, "/");

/** Domaines dont l'architecture a été alignée. */
const SCOPED_DOMAINS = ["blog", "services", "trips"] as const;

const isScopedDomainFile = (file: string): boolean => {
  const path = rel(file);
  return SCOPED_DOMAINS.some(
    (domain) =>
      path.startsWith(`src/modules/${domain}/`) || path.startsWith(`src/components/${domain}/`),
  );
};

/** Composants des 3 domaines, à l'exclusion des pages et layouts. */
const scopedAstroFiles = astroFiles.filter(isScopedDomainFile);

describe("frontière modules / components", () => {
  it("ne place aucun composant Astro sous src/modules/", () => {
    // Les modules portent la logique métier : actions, loaders, domain,
    // validation. Un `.astro` ici mixerait rendu et accès aux données.
    const offenders = scopedAstroFiles
      .filter((f) => rel(f).startsWith("src/modules/"))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("n'interroge jamais la base depuis un composant Astro", () => {
    // Les données viennent d'un loader. Un `getDrizzle()` dans un `.astro`
    // rend le composant dépendant du schéma et impossible à réutiliser.
    const offenders = scopedAstroFiles
      .filter((f) => /from\s+"@(?:\/)?database\/drizzle"/.test(readFileSync(f, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});

describe("rangement des composants par domaine", () => {
  const DOMAINS = SCOPED_DOMAINS;

  it.each(DOMAINS)("%s : admin/ est séparé du public", (domain) => {
    const dir = join(ROOT, "src/components", domain);
    expect(statSync(join(dir, "admin")).isDirectory()).toBe(true);
  });

  it.each(DOMAINS)("%s : aucun dossier vide", (domain) => {
    const dir = join(ROOT, "src/components", domain);
    const empty = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .filter((e) => readdirSync(join(dir, e.name)).length === 0)
      .map((e) => e.name);
    expect(empty).toEqual([]);
  });

  it.each(DOMAINS)("%s : l'engagement vit dans engagement/", (domain) => {
    const dir = join(ROOT, "src/components", domain, "engagement");
    expect(statSync(dir).isDirectory()).toBe(true);
  });
});

describe("scripts navigateur hors des composants", () => {
  it.each(["blog", "services", "trips"])(
    "%s : le script de la page est delegates a modules/<domaine>/client/",
    (domain) => {
      const dir = join(ROOT, "src/components", domain);
      // Un `.astro` qui declare un script inline reste toléré tant qu'il ne
      // fait qu'importer un module client : on vérifie ici l'absence
      // d'action astro appelée directement, qui est le vrai risque
      // (action non typée, sélecteur dupliqué).
      const offenders = walk(dir)
        .filter((f) => f.endsWith(".astro"))
        .filter((f) => /from\s+"astro:actions"/.test(readFileSync(f, "utf8")))
        .map(rel);
      expect(offenders).toEqual([]);
    },
  );
});
