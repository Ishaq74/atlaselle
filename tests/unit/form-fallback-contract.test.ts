/**
 * Contrat des formulaires sans JavaScript (docs/security.md §11).
 *
 * Pour chaque `<form method="post">` des fichiers `.astro` :
 *  - plus aucun `action={Astro.url.pathname}` (rejeté au rendu natif) ;
 *  - toute `formAction("nom", …)` (sur le formulaire ou un bouton `formaction`) pointe vers une
 *    action existante du registre `src/actions/index.ts` ;
 *  - chaque clé OBLIGATOIRE du schéma zod de l'action est fournie par un champ nommé
 *    (statique ou préfixe `a.b` pour les objets imbriqués). Un `name={…}` dynamique
 *    rend la vérification de ce formulaire non décidable : il est compté à part.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

vi.mock("astro:actions", () => {
  class ActionError extends Error {}
  return { ActionError, defineAction: (def: unknown) => def };
});

const SRC = resolve(__dirname, "../../src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function removeDelimited(source: string, open: string, close: string): string {
  let out = "";
  let from = 0;
  for (;;) {
    const start = source.indexOf(open, from);
    if (start === -1) return out + source.slice(from);
    out += source.slice(from, start);
    const end = source.indexOf(close, start + open.length);
    if (end === -1) return out;
    from = end + close.length;
  }
}

function stripComments(source: string): string {
  const withoutBlocks = removeDelimited(removeDelimited(source, "<!--", "-->"), "/*", "*/");
  return withoutBlocks
    .split("\n")
    .map((line) => {
      const at = line.indexOf("//");
      return at !== -1 && !/[:"'`]/.test(line[at - 1] ?? "") ? line.slice(0, at) : line;
    })
    .join("\n");
}

interface FormBlock {
  file: string;
  open: string;
  body: string;
}

/** Fin de la balise ouvrante : le premier `>` hors accolades `{…}` (expressions Astro). */
function endOfOpeningTag(source: string, from: number): number {
  let depth = 0;
  for (let i = from; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth = Math.max(0, depth - 1);
    else if (ch === ">" && depth === 0) return i;
  }
  return -1;
}

function collectForms(): FormBlock[] {
  const forms: FormBlock[] = [];
  for (const file of walk(SRC).filter((f) => f.endsWith(".astro"))) {
    const source = stripComments(readFileSync(file, "utf8"));
    const label = file.slice(SRC.length + 1).replaceAll("\\", "/");
    let cursor = 0;
    for (;;) {
      const start = source.indexOf("<form", cursor);
      if (start === -1) break;
      const next = source[start + 5];
      if (next !== undefined && !/[\s>]/.test(next)) {
        cursor = start + 5;
        continue;
      }
      const openEnd = endOfOpeningTag(source, start + 5);
      const close = openEnd === -1 ? -1 : source.indexOf("</form>", openEnd);
      if (openEnd === -1 || close === -1) break;
      forms.push({ file: label, open: source.slice(start + 5, openEnd), body: source.slice(openEnd + 1, close) });
      cursor = close + 7;
    }
  }
  return forms;
}

const forms = collectForms();
const postForms = forms.filter((f) => /method\s*=\s*["']post["']/i.test(f.open));

const registrySource = readFileSync(join(SRC, "actions/index.ts"), "utf8");
const registryBlock = registrySource.slice(registrySource.indexOf("export const server"));
const registryKeys = new Set([...registryBlock.matchAll(/\b([A-Za-z][A-Za-z0-9]*)\b\s*[,\n]/g)].map((m) => m[1]));

const actionFiles = new Map<string, string>();
for (const file of walk(join(SRC, "actions")).filter((f) => f.endsWith(".ts"))) {
  for (const m of readFileSync(file, "utf8").matchAll(/export const (\w+) = defineAction\(/g)) actionFiles.set(m[1], file);
}

function formActionNames(form: FormBlock): string[] {
  return [...(form.open + form.body).matchAll(/formAction\(\s*["']([A-Za-z0-9]+)["']/g)].map((m) => m[1]);
}

function fieldNames(form: FormBlock): { names: Set<string>; dynamic: boolean } {
  const names = new Set<string>();
  let dynamic = false;
  for (const m of form.body.matchAll(/<[A-Za-z][\w.]*\b[^>]*?\bname\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g)) {
    if (m[3] !== undefined) dynamic = true;
    else names.add((m[1] ?? m[2]) as string);
  }
  return { names, dynamic };
}

async function requiredKeys(actionName: string): Promise<string[] | null> {
  const file = actionFiles.get(actionName);
  if (!file) return null;
  const mod = (await import(/* @vite-ignore */ pathToFileURL(file).href)) as Record<string, { input?: unknown }>;
  let schema = mod[actionName]?.input as
    | { shape?: Record<string, { safeParse: (v: unknown) => { success: boolean } }>; _zod?: { def?: { in?: unknown } } }
    | undefined;
  for (let i = 0; schema && !schema.shape && i < 5; i++) schema = schema._zod?.def?.in as typeof schema;
  if (!schema?.shape) return null;
  return Object.entries(schema.shape)
    .filter(([, field]) => !field.safeParse(undefined).success)
    .map(([key]) => key);
}

describe("contrat des formulaires natifs", () => {
  it("recense les formulaires POST", () => {
    expect(postForms.length).toBeGreaterThanOrEqual(40);
  });

  it("aucun formulaire POST ne cible encore la page courante sans traitement serveur", () => {
    const offenders = postForms.filter((f) => /action\s*=\s*\{\s*Astro\.url\.pathname\s*\}/.test(f.open)).map((f) => f.file);
    expect([...new Set(offenders)]).toEqual([]);
  });

  it("chaque formAction() désigne une action du registre", () => {
    const unknown = postForms.flatMap((f) => formActionNames(f).filter((n) => !registryKeys.has(n)).map((n) => `${f.file}:${n}`));
    expect(unknown).toEqual([]);
  });

  it("chaque formulaire fournit les clés obligatoires du schéma de son action", async () => {
    const problems: string[] = [];
    for (const form of postForms) {
      const primary = /action\s*=\s*\{\s*formAction\(\s*["']([A-Za-z0-9]+)["']/.exec(form.open)?.[1];
      if (!primary) continue;
      const required = await requiredKeys(primary);
      if (required === null) {
        problems.push(`${form.file}:${primary} → schéma introuvable`);
        continue;
      }
      const { names, dynamic } = fieldNames(form);
      if (dynamic) continue;
      const provided = (key: string): boolean => names.has(key) || [...names].some((n) => n.startsWith(`${key}.`) || n.startsWith(`${key}[`));
      const missing = required.filter((key) => !provided(key));
      if (missing.length) problems.push(`${form.file}:${primary} → manque ${missing.join(", ")}`);
    }
    expect(problems).toEqual([]);
  }, 120_000);
});
