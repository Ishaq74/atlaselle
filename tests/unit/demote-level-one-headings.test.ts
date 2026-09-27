import { describe, it, expect } from 'vitest';
import { demoteLevelOneHeadings, renderEditorialHtml } from '@/components/pages/cms/demote-level-one-headings';
import { sanitizeHtml } from '@lib/sanitize';

/**
 * Render-time demotion of the level 1 headings carried by a CMS section body.
 *
 * CmsPage already exposes exactly one level 1 heading — the page title it
 * renders itself. The shared filter `sanitizeHtml` must keep allowing `h1`,
 * because a blog article body legitimately carries one, so the duplicate is
 * removed where the editorial body is rendered (SectionRenderer.astro, `text`
 * and `custom` sections) and not inside the filter. The last test of this file
 * is the one that keeps that reason from being quietly reversed.
 *
 * The rewrite renames the tag name `h1` to `h2` and copies every other byte
 * verbatim, so the contract tested here is not "the output looks right" but
 * "the output differs from the input by the tag name, and by nothing else".
 *
 * Neither `@/components/pages/cms/demote-level-one-headings` nor `@lib/sanitize`
 * reads an environment variable, so there is nothing to anchor in this file.
 */

/** Number of `<` and of `>` in a fragment. */
function chevrons(html: string): { lt: number; gt: number } {
  return {
    lt: (html.match(/</g) ?? []).length,
    gt: (html.match(/>/g) ?? []).length,
  };
}

/**
 * The one and only rewrite `demoteLevelOneHeadings` is allowed to perform on a
 * body: the tag name `h1` becomes `h2`. The lookahead keeps `h10`, `h1-2` and
 * `xh1` out, and the two patterns cover start and end tags.
 */
function renameLevelOneHeadings(html: string): string {
  return html
    .replace(/<h1(?=[\s/>])/gi, '<h2')
    .replace(/<\/h1(?=[\s>])/gi, '</h2');
}

/** Bodies that carry no level 1 heading: the result must be the input itself. */
const BODIES_WITHOUT_LEVEL_ONE: ReadonlyArray<string> = [
  '<h2>Deux</h2>\n<h3>Trois</h3>\n<p>Paragraphe</p>',
  '<h2\n  class="titre"\n  id="ancre">\n  Deux\n</h2>',
  // The string "h1" in a text node is not a heading: the scanner runs and must
  // still leave the text alone.
  '<p>Voir le chapitre h1 du guide</p>',
  // Same, inside an attribute value.
  '<p title="h1">x</p>',
];

/** A `<` that does not open a named tag, and what the scan does next. */
const STRAY_LT: ReadonlyArray<readonly [string, string]> = [
  ['a < b and 3<4 with h1', 'a < b and 3<4 with h1'],
  ['< /h1><h1>x</h1>', '< /h1><h2>x</h2>'],
  // `</ ` does not open an end tag in HTML5: it is text, so no name is renamed
  // there — only the start tag of the heading is.
  ['<h1>x</ h1>', '<h2>x</ h1>'],
];

/** A tag left unterminated: the scanner cannot resolve it, so it is copied whole. */
const UNTERMINATED_TAG: ReadonlyArray<readonly [string, string]> = [
  ['<p>before</p><h1 class="unclosed', '<p>before</p><h1 class="unclosed'],
  // Unterminated at the end of input, with no attribute value to resolve.
  ['<h1 class=unclosed', '<h1 class=unclosed'],
  ['<h1 class="unclosed<p>after</p>', '<h1 class="unclosed<p>after</p>'],
  // The unterminated region stays inert, and the scan resumes on the next
  // well-formed heading.
  ['<h1 class="unclosed<p>after</p><h1>real</h1>', '<h1 class="unclosed<p>after</p><h2>real</h2>'],
];

/** A `>` inside a quoted attribute value does not close the tag. */
const CHEVRON_IN_ATTRIBUTE: ReadonlyArray<readonly [string, string]> = [
  ['<h1 class="a>b" data-x="c>d">T</h1>', '<h2 class="a>b" data-x="c>d">T</h2>'],
  ['<h1 title=\'a>b\'>T</h1>', '<h2 title=\'a>b\'>T</h2>'],
  // The decisive one: a tag-shaped "h1" inside the attribute value is part of
  // the value, not a tag, and must survive byte for byte.
  ['<h1 title="a><h1>b">T</h1>', '<h2 title="a><h1>b">T</h2>'],
  // Same, with the whole attribute list on the far side of the chevron.
  ['<h1 class="a>b <h1" data-x="c">T</h1>', '<h2 class="a>b <h1" data-x="c">T</h2>'],
];

/** A comment is inert: it is copied whole, and the scan resumes after it. */
const COMMENTS: ReadonlyArray<readonly [string, string]> = [
  ['<!-- <h1>dans un commentaire</h1> --><h1>reel</h1>', '<!-- <h1>dans un commentaire</h1> --><h2>reel</h2>'],
  ['<!--[if IE]><h1>x</h1><![endif]--><h1>reel</h1>', '<!--[if IE]><h1>x</h1><![endif]--><h2>reel</h2>'],
  ['<h1>a<!-- <h1> -->b</h1>', '<h2>a<!-- <h1> -->b</h2>'],
  ['<!-- <h1>jamais termine', '<!-- <h1>jamais termine'],
];

/**
 * Elements whose content the HTML parser reads as raw text rather than as
 * markup. Sanitized output contains none of them, so the direct export is the
 * only place where the guarantee is observable.
 */
const RAW_TEXT_ELEMENTS: ReadonlyArray<string> = [
  'iframe', 'noembed', 'noframes', 'noscript', 'plaintext',
  'script', 'style', 'textarea', 'title', 'xmp',
];

/** Hostile bodies, run through the full filter-then-render chain. */
const HOSTILE_PAYLOADS: ReadonlyArray<readonly [string, string]> = [
  ['a script element', '<h1><script>alert(1)</script></h1>'],
  ['an event handler attribute', '<h1 onmouseover="alert(1)" class="k">x</h1>'],
  ['an image error handler', '<h1><img src="x" onerror="alert(1)"></h1>'],
  ['a stray end tag before the heading', '</h1><h1>x</h1>'],
  ['an end tag smuggled in an attribute value', '<h1 title="</h1><script>alert(1)</script>">x</h1>'],
  ['a javascript: href', '<h1><a href="javascript:alert(1)">x</a></h1>'],
  ['an svg payload with a style element', '<h1><svg><style><h1></h1></style></svg></h1>'],
  ['escaped heading text', '<h1>&lt;h1&gt;</h1>'],
  ['a mutation through noscript', '<h1><noscript><p title="</noscript><img src=x onerror=alert(1)>">'],
  ['nested headings', '<div><h1>A</h1><div><h1>B</h1></div></div>'],
  ['an iframe smuggling a heading', '<h1><iframe src="https://evil.com"><h1>x</h1></iframe></h1>'],
  ['an inline style attribute', '<h1 style="color:red">x</h1>'],
  ['a form and an input', '<h1><form action="https://evil.com"><input name="a"></form></h1>'],
  ['a heading inside a table cell', '<h1><table><tbody><tr><td><h1>cell</h1></td></tr></tbody></table></h1>'],
  ['a comment inside the heading', '<h1><!-- c --></h1>'],
  ['an uppercase heading', '<H1 CLASS="k">X</H1>'],
  ['a CDATA section', '<h1><![CDATA[</h1><img src=x onerror=alert(1)>]]></h1>'],
  ['a processing instruction', '<h1><?php echo "<h1>" ?></h1>'],
  ['a text node mentioning h1', '<p>h1</p>'],
];

describe('demoteLevelOneHeadings — a body with no level 1 heading', () => {
  it.each(BODIES_WITHOUT_LEVEL_ONE)('returns %j unchanged', (body) => {
    expect(demoteLevelOneHeadings(body)).toBe(body);
  });
});

describe('demoteLevelOneHeadings — the rename', () => {
  it('renames the tag and preserves every attribute, class, text, order and nesting', () => {
    const body = [
      '<section class="section cms-text" id="bloc">',
      '  <h1 class="t1 t2" id="titre" title="T" data-internal-link="x">Titre <em>mixte</em> &amp; <strong>gras</strong></h1>',
      '  <p>Avant</p>',
      '  <div class="w"><h1>Imbrique</h1><ul><li><h1>Liste</h1></li></ul></div>',
      '</section>',
    ].join('\n');
    const expected = [
      '<section class="section cms-text" id="bloc">',
      '  <h2 class="t1 t2" id="titre" title="T" data-internal-link="x">Titre <em>mixte</em> &amp; <strong>gras</strong></h2>',
      '  <p>Avant</p>',
      '  <div class="w"><h2>Imbrique</h2><ul><li><h2>Liste</h2></li></ul></div>',
      '</section>',
    ].join('\n');

    expect(demoteLevelOneHeadings(body)).toBe(expected);
  });

  it('never touches levels 2 to 6', () => {
    const body = '<h1>1</h1><h2>2</h2><h3>3</h3><h4>4</h4><h5>5</h5><h6>6</h6>';

    expect(demoteLevelOneHeadings(body)).toBe(
      '<h2>1</h2><h2>2</h2><h3>3</h3><h4>4</h4><h5>5</h5><h6>6</h6>',
    );
  });

  it('demotes an uppercase level 1 heading whatever the case of the rest of the document', () => {
    // The demoted name is the literal "h2": the case of the replaced name is
    // what changes, nothing else in the tag is touched.
    expect(demoteLevelOneHeadings('<H1 ID="X">Upper</H1>')).toBe('<h2 ID="X">Upper</h2>');
    expect(demoteLevelOneHeadings('<H1 class="k">a</h1>')).toBe('<h2 class="k">a</h2>');
    expect(demoteLevelOneHeadings('<h1 ID="X">Upper</H1>')).toBe('<h2 ID="X">Upper</h2>');
  });

  it('leaves a tag whose name only contains the target name untouched', () => {
    for (const body of [
      '<h10>a</h10>',
      '<h1-2>b</h1-2>',
      '<xh1>c</xh1>',
      '<h1x>d</h1x>',
      '<h1:e>f</h1:e>',
      '<H1X>g</H1X>',
    ]) {
      expect(demoteLevelOneHeadings(body), body).toBe(body);
    }
  });

  it('handles a tag spread over several lines without touching its layout', () => {
    const body = '<h1\n\tid="a"\n\tclass="b c"\n  title="t"\n>\n  Titre sur\n  deux lignes\n</h1>';

    expect(demoteLevelOneHeadings(body)).toBe(
      '<h2\n\tid="a"\n\tclass="b c"\n  title="t"\n>\n  Titre sur\n  deux lignes\n</h2>',
    );
  });
});

describe('demoteLevelOneHeadings — byte-exact boundaries', () => {
  it('copies byte for byte a `<` that does not open a named tag', () => {
    for (const [body, expected] of STRAY_LT) {
      expect(demoteLevelOneHeadings(body), body).toBe(expected);
    }
  });

  it('copies byte for byte an unterminated tag', () => {
    for (const [body, expected] of UNTERMINATED_TAG) {
      expect(demoteLevelOneHeadings(body), body).toBe(expected);
    }
  });

  it('does not close a tag at a `>` inside a quoted attribute value', () => {
    for (const [body, expected] of CHEVRON_IN_ATTRIBUTE) {
      expect(demoteLevelOneHeadings(body), body).toBe(expected);
      expect(chevrons(demoteLevelOneHeadings(body)), body).toEqual(chevrons(body));
    }
  });

  it('copies a comment byte for byte and still demotes what follows', () => {
    for (const [body, expected] of COMMENTS) {
      expect(demoteLevelOneHeadings(body), body).toBe(expected);
    }
  });
});

describe('demoteLevelOneHeadings — idempotence', () => {
  it('changes nothing on a second pass over a complex body', () => {
    const body = [
      '<div class="w" id="d">',
      '  <h1 id="a" class="x">A <em>e</em></h1>',
      '  <!-- <h1>comment</h1> -->',
      '  <h2>B</h2>',
      '  <div><h1>C</h1><h3>D</h3></div>',
      '</div>',
    ].join('\n');

    const once = demoteLevelOneHeadings(body);
    // Guard against a degenerate implementation that returns its input: the
    // idempotence assertion below would hold for it.
    expect(once).not.toBe(body);
    expect(once).toBe(demoteLevelOneHeadings(once));
    expect(demoteLevelOneHeadings(demoteLevelOneHeadings(body))).toBe(once);
  });
});

describe('demoteLevelOneHeadings — raw-text elements', () => {
  it.each(RAW_TEXT_ELEMENTS)('does not rewrite inside <%s>, whose content is read as text', (name) => {
    const body = `<${name}><h1>raw</h1></${name}><h1>real</h1>`;

    expect(demoteLevelOneHeadings(body)).toBe(`<${name}><h1>raw</h1></${name}><h2>real</h2>`);
  });

  it('copies the remainder byte for byte when a raw-text element is never closed', () => {
    const body = '<textarea><h1>raw</h1>';

    expect(demoteLevelOneHeadings(body)).toBe(body);
  });

  it('still demotes the heading that wraps a raw-text element, and the one after it', () => {
    expect(demoteLevelOneHeadings('<h1><title><h1>x</h1></title></h1>')).toBe(
      '<h2><title><h1>x</h1></title></h2>',
    );
  });
});

describe('renderEditorialHtml — full filter-then-render chain', () => {
  it('leaves the shared filter free to allow a level 1 heading, which is why the demotion happens here', () => {
    const blogArticle = '<h1 id="post">Titre du billet</h1><p>Corps du billet</p>';

    // The filter is shared with blog article bodies, where one level 1 heading
    // is legitimate. Neutralising it there would break the article, so the
    // duplicate is removed at render time instead. This is the assertion that
    // forbids moving the demotion into sanitizeHtml.
    expect(sanitizeHtml(blogArticle)).toBe(blogArticle);
    expect(sanitizeHtml(blogArticle)).toContain('<h1 id="post">');

    // The very same body, rendered as a managed page section, loses its level 1.
    expect(renderEditorialHtml(blogArticle)).toBe(
      '<h2 id="post">Titre du billet</h2><p>Corps du billet</p>',
    );
  });

  it('renders a body that is not a string as an empty string', () => {
    // The call site hands over `content.html ?? content.raw ?? ''` out of a jsonb
    // column, so the value is unknown at runtime.
    expect(renderEditorialHtml(null)).toBe('');
    expect(renderEditorialHtml(undefined)).toBe('');
    expect(renderEditorialHtml(42)).toBe('');
    expect(renderEditorialHtml({ html: '<h1>x</h1>' })).toBe('');
  });

  it.each(HOSTILE_PAYLOADS)('cannot be made to escape its element: %s', (label, payload) => {
    const filtered = sanitizeHtml(payload);
    const out = renderEditorialHtml(payload);

    // The rendering is the filtered body with the tag name renamed, and nothing
    // else: no byte added, removed or reordered.
    expect(out, label).toBe(renameLevelOneHeadings(filtered));
    // Re-filtering the result changes nothing: the rendered body is already a
    // fixed point of the filter, so a second reading cannot expose anything the
    // first one removed.
    expect(sanitizeHtml(out), `${label}: the rendered body is not a filter fixed point`).toBe(out);
    // No level 1 heading survives, and no chevron appeared or vanished.
    expect(/<\/?h1[\s/>]/i.test(out), `${label}: a level 1 heading survived the render`).toBe(false);
    expect(chevrons(out), `${label}: the chevron count changed`).toEqual(chevrons(filtered));
  });
});
