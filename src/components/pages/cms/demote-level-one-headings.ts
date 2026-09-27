/**
 * Render-time demotion of level 1 headings carried by a CMS section body.
 *
 * The page already exposes exactly one level 1 heading — its own title, rendered
 * by CmsPage. The shared sanitizer (`@lib/sanitize`) must keep `h1` allowed
 * because a blog article body legitimately carries it, so the duplicate has to
 * be removed where the editorial body is rendered, not in the filter.
 *
 * The rewrite renames the tag name `h1` to `h2` and copies every other byte of
 * the document verbatim: attributes, classes, text, order and nesting are
 * untouched, nothing is removed, and no byte is introduced that the input did
 * not already hold. Because the token stream is preserved and only the name
 * changes, the operation is idempotent and structurally incapable of opening a
 * new tag, an attribute, a comment or a raw-text context, hence incapable of
 * letting any input escape its element or the document.
 */
import { sanitizeHtml } from "@lib/sanitize";

/** Level 1 is the only heading level this module touches. */
const TARGET_TAG_NAME = "h1";

/** The level a demoted heading lands on: one step down, so no level is skipped. */
const DEMOTED_LEVEL = "h2";

/**
 * Elements whose content the HTML parser reads as raw text rather than markup.
 * Sanitized output contains none of them, but copying their content verbatim
 * keeps the scanner from rewriting a tag name that is only text there, which
 * is what makes the guarantee hold for any input, not only for a clean one.
 */
const RAW_TEXT_ELEMENTS = new Set([
  "iframe",
  "noembed",
  "noframes",
  "noscript",
  "plaintext",
  "script",
  "style",
  "textarea",
  "title",
  "xmp",
]);

/** Fast path guard: nothing to rename when the substring is absent. */
const LEVEL_ONE_PRESENT = /h1/i;

const CHAR_TAB = 9;
const CHAR_LF = 10;
const CHAR_FF = 12;
const CHAR_CR = 13;
const CHAR_SPACE = 32;
const CHAR_BANG = 33;
const CHAR_DOUBLE_QUOTE = 34;
const CHAR_SINGLE_QUOTE = 39;
const CHAR_COLON = 58;
const CHAR_LT = 60;
const CHAR_GT = 62;
const CHAR_DASH = 45;
const CHAR_UNDERSCORE = 95;
const CHAR_SLASH = 47;

interface Tag {
  /** Index just past the closing `>` — the first byte after the tag. */
  end: number;
  isEndTag: boolean;
  /** Index of the first byte of the tag name. */
  nameStart: number;
  /** Index just past the last byte of the tag name. */
  nameEnd: number;
  selfClosing: boolean;
  /** Index of the `<`. */
  start: number;
}

function isAsciiLetter(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isTagNameByte(code: number): boolean {
  return (
    isAsciiLetter(code) ||
    (code >= 48 && code <= 57) ||
    code === CHAR_DASH ||
    code === CHAR_UNDERSCORE ||
    code === CHAR_COLON
  );
}

function isSpaceByte(code: number): boolean {
  return (
    code === CHAR_SPACE ||
    code === CHAR_TAB ||
    code === CHAR_LF ||
    code === CHAR_FF ||
    code === CHAR_CR
  );
}

function toLowerCode(code: number): number {
  return code >= 65 && code <= 90 ? code + 32 : code;
}

/**
 * Reads the tag opening at `start`, honouring quoted attribute values so that a
 * `>` inside an attribute value does not close the tag early and a `>` inside
 * the name of a later element is never mistaken for this element's end.
 * Returns null when the `<` does not open a named tag, or when the tag is left
 * unterminated: both are copied byte for byte by the caller.
 */
function readTag(html: string, start: number): Tag | null {
  let i = start + 1;
  let isEndTag = false;
  if (html.charCodeAt(i) === CHAR_SLASH) {
    isEndTag = true;
    i += 1;
  }
  const nameStart = i;
  if (!isAsciiLetter(html.charCodeAt(i))) return null;
  i += 1;
  while (isTagNameByte(html.charCodeAt(i))) i += 1;
  const nameEnd = i;
  const length = html.length;

  while (i < length) {
    const code = html.charCodeAt(i);
    if (code === CHAR_GT) {
      return { end: i + 1, isEndTag, nameStart, nameEnd, selfClosing: false, start };
    }
    if (code === CHAR_SLASH && html.charCodeAt(i + 1) === CHAR_GT) {
      return { end: i + 2, isEndTag, nameStart, nameEnd, selfClosing: true, start };
    }
    if (code === CHAR_DOUBLE_QUOTE || code === CHAR_SINGLE_QUOTE) {
      const close = html.indexOf(code === CHAR_DOUBLE_QUOTE ? '"' : "'", i + 1);
      if (close === -1) return null;
      i = close + 1;
      continue;
    }
    i += 1;
  }
  return null;
}

/** Index of the `</name` that closes a raw-text element, or the end of input. */
function indexOfRawTextEnd(html: string, name: string, from: number): number {
  const length = html.length;
  for (let i = from; i < length; i += 1) {
    if (html.charCodeAt(i) !== CHAR_LT) continue;
    if (html.charCodeAt(i + 1) !== CHAR_SLASH) continue;
    let matches = true;
    for (let k = 0; k < name.length; k += 1) {
      if (toLowerCode(html.charCodeAt(i + 2 + k)) !== name.charCodeAt(k)) {
        matches = false;
        break;
      }
    }
    if (!matches) continue;
    const after = html.charCodeAt(i + 2 + name.length);
    if (after === CHAR_GT || after === CHAR_SLASH || isSpaceByte(after)) return i;
  }
  return length;
}

/**
 * Renames every level 1 heading start and end tag to level 2. Attribute lists,
 * class lists, text, document order and nesting are reproduced exactly, and no
 * other heading level is altered. A string that contains no level 1 heading is
 * returned unchanged, so a second pass is a no-op.
 */
export function demoteLevelOneHeadings(html: string): string {
  if (typeof html !== "string" || html === "") return html;
  if (!LEVEL_ONE_PRESENT.test(html)) return html;

  const length = html.length;
  const out: string[] = [];
  let i = 0;

  while (i < length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      out.push(html.slice(i));
      break;
    }
    out.push(html.slice(i, lt));

    // A comment is copied whole: its content is inert and must stay byte exact.
    if (
      html.charCodeAt(lt + 1) === CHAR_BANG &&
      html.charCodeAt(lt + 2) === CHAR_DASH &&
      html.charCodeAt(lt + 3) === CHAR_DASH
    ) {
      const close = html.indexOf("-->", lt + 4);
      const end = close === -1 ? length : close + 3;
      out.push(html.slice(lt, end));
      i = end;
      continue;
    }

    const tag = readTag(html, lt);
    if (!tag) {
      out.push("<");
      i = lt + 1;
      continue;
    }

    const name = html.slice(tag.nameStart, tag.nameEnd).toLowerCase();
    i = tag.end;

    if (name === TARGET_TAG_NAME) {
      out.push(html.slice(lt, tag.nameStart), DEMOTED_LEVEL, html.slice(tag.nameEnd, tag.end));
    } else {
      out.push(html.slice(lt, tag.end));
    }

    if (!tag.isEndTag && !tag.selfClosing && RAW_TEXT_ELEMENTS.has(name)) {
      const close = indexOfRawTextEnd(html, name, tag.end);
      const closeTag = readTag(html, close);
      const end = closeTag ? closeTag.end : length;
      out.push(html.slice(tag.end, end));
      i = end;
    }
  }

  return out.join("");
}

/**
 * Entry point for the CMS section types whose body is editorial HTML. The value
 * is sanitized first, so the demotion below only ever rewrites a tag name that
 * the filter has already allowed: the raw, unfiltered string is never inspected.
 */
export function renderEditorialHtml(value: unknown): string {
  return demoteLevelOneHeadings(sanitizeHtml(value));
}
