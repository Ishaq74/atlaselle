import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const contentEditorSource = readFileSync(
  resolve(process.cwd(), 'src/components/content/ContentEditor.astro'),
  'utf8',
);
// Le script du formulaire a été extrait vers `modules/blog/client/` : c'est
// là que vivent les garde-fous testés ici. `AdminPostForm.astro` ne fait plus
// qu'importer ce module.
const adminPostFormSource = readFileSync(
  resolve(process.cwd(), 'src/modules/blog/client/admin-post-form.ts'),
  'utf8',
);
const adminFormShellSource = readFileSync(
  resolve(process.cwd(), 'src/components/organisms/AdminFormShell.astro'),
  'utf8',
);
const dirtyGuardSource = readFileSync(
  resolve(process.cwd(), 'src/core/admin/dirty-guard.ts'),
  'utf8',
);

describe('editor DOM safety guards', () => {
  it('wires heading and list toolbar commands to HTML formatters', () => {
    expect(contentEditorSource).toContain('formatHeadingSelection(val, s, e)');
    expect(contentEditorSource).toContain('formatUnorderedListSelection(val, s, e)');
    expect(contentEditorSource).not.toContain("prefixLines(val, s, e, '## ')");
    expect(contentEditorSource).not.toContain("prefixLines(val, s, e, '- ')");
  });

  it('renders internal-link search statuses and API labels as text nodes', () => {
    expect(contentEditorSource).not.toMatch(/resultsEl\.innerHTML/);
    expect(contentEditorSource).toContain('resultsEl.replaceChildren');
    expect(contentEditorSource).toContain('status.textContent = message');
    expect(contentEditorSource).toContain('item.textContent = r.label');
  });

  it('renders the admin dead-link report without innerHTML assembly', () => {
    expect(adminPostFormSource).not.toMatch(/reportEl\.innerHTML/);
    expect(adminPostFormSource).toContain('reportEl.replaceChildren');
    expect(adminPostFormSource).toContain('item.textContent = text');
  });

  it('guards dirty forms and marks successful saves clean', () => {
    // Single beforeunload owner: src/core/admin/dirty-guard.ts. Every screen
    // (AdminFormShell included) delegates to it — a second `beforeunload`
    // listener would double-prompt on leave.
    expect(dirtyGuardSource).toContain('window.addEventListener("beforeunload"');
    expect(adminFormShellSource).toContain('registerAdminDirtyGuard(');
    expect(adminFormShellSource).not.toMatch(
      /window\.addEventListener\(\s*['"]beforeunload/,
    );
    expect(adminPostFormSource).not.toMatch(/window\.addEventListener\(\s*['"]beforeunload/);
    expect(adminPostFormSource).toContain('if (!isDirty) return');
    expect(adminPostFormSource).toMatch(
      /if \(result\.error\)[\s\S]+?return;[\s\S]+?isDirty = false;[\s\S]+?toast\.success/,
    );
  });
});
