/**
 * Turn a raw Project Gutenberg plain-text file into clean HTML that the
 * reader can render gently. Rules:
 *
 *   - Strip the PG header + footer legal boilerplate
 *   - Collapse runaway whitespace
 *   - Detect chapter headings → <h2> (so the reader can build a TOC)
 *   - Detect scene breaks ("* * *", "***") → <hr class="break" />
 *   - Wrap the rest in <p> paragraphs (blank-line separated)
 *   - Preserve poem/indented stanzas as <pre class="verse">
 *
 * This is best-effort — not every PG text fits the same mould. The
 * reader has a monospace fallback if the formatter misses something.
 */

const PG_START_RE = /\*\*\*\s*START OF (?:THE|THIS)? PROJECT GUTENBERG EBOOK[^*]+\*\*\*/i;
const PG_END_RE   = /\*\*\*\s*END OF (?:THE|THIS)? PROJECT GUTENBERG EBOOK[^*]+\*\*\*/i;
const CHAPTER_RE  = /^\s*(CHAPTER\s+[IVXLC\d]+\.?|CHAPTER\s+[A-Z][A-Z\s]+|[IVXLC]+\.)\s*(.*)$/;
const SCENE_BREAK = /^\s*(\*\s*\*\s*\*|\*\*\*|—\s*—\s*—)\s*$/;

export function formatText(raw: string): { html: string; wordCount: number; title?: string; author?: string } {
  const body = stripPGWrapper(raw);
  const lines = body.split(/\r?\n/);

  const blocks: string[] = [];
  let buffer: string[] = [];
  let inVerse = false;

  const flushParagraph = () => {
    const text = buffer.join(" ").trim();
    buffer = [];
    if (!text) return;
    blocks.push(`<p>${escape(text)}</p>`);
  };

  const flushVerse = () => {
    const text = buffer.join("\n");
    buffer = [];
    inVerse = false;
    if (!text.trim()) return;
    blocks.push(`<pre class="verse">${escape(text)}</pre>`);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (SCENE_BREAK.test(trimmed)) {
      if (inVerse) flushVerse(); else flushParagraph();
      blocks.push('<hr class="break" />');
      continue;
    }

    const chapterMatch = trimmed.match(CHAPTER_RE);
    if (chapterMatch && chapterMatch[0].length < 80 && trimmed === trimmed.toUpperCase() && trimmed.length > 2) {
      if (inVerse) flushVerse(); else flushParagraph();
      const id = slugifyHeading(trimmed);
      const combined = chapterMatch[2] ? `${chapterMatch[1]} — ${chapterMatch[2]}` : chapterMatch[1];
      blocks.push(`<h2 id="${id}">${escape(combined.trim())}</h2>`);
      continue;
    }

    // Verse/indented poem detection — 4+ leading spaces and not a blank
    if (/^\s{4,}\S/.test(line)) {
      if (!inVerse) { flushParagraph(); inVerse = true; }
      buffer.push(line);
      continue;
    }

    if (!trimmed) {
      if (inVerse) flushVerse(); else flushParagraph();
      continue;
    }

    if (inVerse) flushVerse();
    buffer.push(trimmed);
  }
  if (inVerse) flushVerse(); else flushParagraph();

  const html = blocks.join("\n");
  const wordCount = body.split(/\s+/).filter(Boolean).length;

  return { html, wordCount };
}

export function stripPGWrapper(raw: string): string {
  const startMatch = raw.match(PG_START_RE);
  const endMatch   = raw.match(PG_END_RE);
  let body = raw;
  if (startMatch) body = body.slice(startMatch.index! + startMatch[0].length);
  if (endMatch)   body = body.slice(0, body.indexOf(endMatch[0]));
  // Drop any leading PG metadata paragraphs (Title, Author, Release date)
  // if they survive. We'll keep anything after the first clear paragraph
  // break beyond the metadata block.
  return body.trim();
}

function escape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function slugifyHeading(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

/**
 * Extract a Table of Contents from the formatted HTML — used by the reader.
 */
export function extractToc(html: string): { id: string; label: string }[] {
  const toc: { id: string; label: string }[] = [];
  const re = /<h2 id="([^"]+)">([^<]+)<\/h2>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) toc.push({ id: m[1], label: m[2] });
  return toc;
}
