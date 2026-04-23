/**
 * Turn a raw Project Gutenberg plain-text file into clean HTML that the
 * reader can render gently. The pipeline:
 *
 *   1. Strip the PG legal header + footer
 *   2. Strip `[Illustration: …]` blocks (multi-line, balanced brackets)
 *   3. Skip leading front-matter (illustrator credits, publisher info,
 *      table of contents) until we find the first real "CHAPTER" /
 *      "PREFACE" / "INTRODUCTION" / "BOOK" heading, OR until we run
 *      into a clear paragraph of running prose.
 *   4. Detect chapter headings → <h2 id="…">…</h2>
 *   5. Detect scene breaks ("* * *", "***") → <hr class="break" />
 *   6. Detect indented stanza groups → <pre class="verse">
 *   7. Wrap remaining text into <p> paragraphs (blank-line separated)
 *
 * Best-effort. Each rule has a graceful fallback.
 */

const PG_START_RE = /\*\*\*\s*START OF (?:THE|THIS)? PROJECT GUTENBERG EBOOK[^*]+\*\*\*/i;
const PG_END_RE   = /\*\*\*\s*END OF (?:THE|THIS)? PROJECT GUTENBERG EBOOK[^*]+\*\*\*/i;

// Chapter headings — accept many forms PG uses in real books.
const CHAPTER_RE = /^\s*(?:(CHAPTER|BOOK|PART|VOLUME|CANTO|SECTION)\s+(?:[IVXLC]+|[\dOZ]+|[A-Z][A-Z\s\-']+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)\.?(?:\s*[—:.\-]?\s*(.*))?|(PREFACE|INTRODUCTION|PROLOGUE|EPILOGUE|FOREWORD|APPENDIX|CONTENTS)\.?\s*$|([IVXLC]{1,5})\.?\s*$)/;

const SCENE_BREAK = /^\s*(\*\s*\*\s*\*|\*\*\*|—\s*—\s*—|·\s*·\s*·)\s*$/;

export function formatText(raw: string): { html: string; wordCount: number } {
  let body = stripPGWrapper(raw);
  body = stripIllustrations(body);
  body = stripContentsBlock(body);

  const lines = body.split(/\r?\n/);

  // Find the first "real" content line. Either:
  //   (a) a chapter heading
  //   (b) the first long-enough paragraph of prose
  let startIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 200); i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (CHAPTER_RE.test(t) && t.length < 100 && isLikelyHeading(t)) { startIdx = i; break; }
    if (looksLikeProse(t)) { startIdx = i; break; }
  }
  // Drop everything before that to skip "Chiswick Press / Charles Whittingham" front-matter
  const slice = lines.slice(startIdx);

  const blocks: string[] = [];
  let buffer: string[] = [];
  let inVerse = false;

  const flushParagraph = () => {
    const text = buffer.join(" ").trim();
    buffer = [];
    if (!text) return;
    if (text.length < 3) return;
    blocks.push(`<p>${escape(text)}</p>`);
  };

  const flushVerse = () => {
    const text = buffer.join("\n").trimEnd();
    buffer = [];
    inVerse = false;
    if (!text.trim()) return;
    blocks.push(`<pre class="verse">${escape(text)}</pre>`);
  };

  for (let i = 0; i < slice.length; i++) {
    const line  = slice[i];
    const trim  = line.trim();

    // Scene breaks
    if (SCENE_BREAK.test(trim)) {
      if (inVerse) flushVerse(); else flushParagraph();
      blocks.push('<hr class="break" />');
      continue;
    }

    // Chapter heading
    if (trim.length < 100 && CHAPTER_RE.test(trim) && isLikelyHeading(trim)) {
      if (inVerse) flushVerse(); else flushParagraph();
      const id = slugifyHeading(trim);
      blocks.push(`<h2 id="${id}">${escape(prettyHeading(trim))}</h2>`);
      // Skip a possible secondary title line (italic chapter subtitle)
      continue;
    }

    // Verse — 4+ leading spaces and at least 3 consecutive verse-like lines
    if (/^\s{4,}\S/.test(line) && verseSurroundings(slice, i)) {
      if (!inVerse) { flushParagraph(); inVerse = true; }
      buffer.push(line);
      continue;
    }

    // Blank → paragraph break
    if (!trim) {
      if (inVerse) flushVerse(); else flushParagraph();
      continue;
    }

    if (inVerse) flushVerse();

    // Skip stray lone bracket / underscore divider lines
    if (/^[\[\]_*\-=]{1,4}$/.test(trim)) continue;

    buffer.push(trim);
  }
  if (inVerse) flushVerse(); else flushParagraph();

  // ── Post-process: dedupe headings (PG often lists every chapter in
  // a "Contents" block before the actual chapters; both produce the
  // same h2 id). Last-write-wins so the actual chapter takes the
  // anchor — TOC entries become inert text styled as headings.
  const headingIds = new Map<number, string>();
  blocks.forEach((b, i) => {
    const m = b.match(/^<h2 id="([^"]+)">/);
    if (m) headingIds.set(i, m[1]);
  });
  const lastIdx = new Map<string, number>();
  for (const [i, id] of headingIds) lastIdx.set(id, i);
  const cleaned = blocks.map((b, i) => {
    const id = headingIds.get(i);
    if (!id) return b;
    if (lastIdx.get(id) === i) return b;
    // Strip the id off this duplicate so anchors stay unique.
    return b.replace(/<h2 id="[^"]+">/, '<h2 class="toc-entry">');
  });

  const html = cleaned.join("\n");
  const wordCount = body.split(/\s+/).filter(Boolean).length;

  return { html, wordCount };
}

/** Strip "[Illustration: …]" blocks. Brackets may span many lines. */
function stripIllustrations(s: string): string {
  // Multi-line balanced [Illustration: ...]
  let out = "";
  let depth = 0;
  let inIllu = false;
  let i = 0;
  while (i < s.length) {
    if (!inIllu) {
      // detect opening token "[Illustration" — consume only up to the
      // "n" so the bracket counter can still see + decrement on the
      // matching "]" (handles the common one-line "[Illustration]").
      if (s[i] === "[" && s.slice(i, i + 13).toLowerCase() === "[illustration") {
        inIllu = true; depth = 1; i += 13; continue;
      }
      out += s[i]; i++; continue;
    }
    if (s[i] === "[") depth++;
    else if (s[i] === "]") { depth--; if (depth === 0) { inIllu = false; i++; continue; } }
    i++;
  }
  return out;
}

/** Skip a leading "CONTENTS"/"TABLE OF CONTENTS" block until first chapter. */
function stripContentsBlock(s: string): string {
  const m = s.match(/^\s*(CONTENTS|TABLE OF CONTENTS)\s*$/im);
  if (!m) return s;
  const lines = s.split(/\r?\n/);
  const startLine = lineOf(s, m.index!);
  // Find next chapter heading after CONTENTS
  for (let i = startLine + 1; i < lines.length; i++) {
    if (CHAPTER_RE.test(lines[i].trim()) && isLikelyHeading(lines[i].trim()) && lines[i].length < 80) {
      return lines.slice(i).join("\n");
    }
  }
  return s;
}
function lineOf(s: string, idx: number): number {
  return s.slice(0, idx).split("\n").length - 1;
}

export function stripPGWrapper(raw: string): string {
  const startMatch = raw.match(PG_START_RE);
  const endMatch   = raw.match(PG_END_RE);
  let body = raw;
  if (startMatch) body = body.slice(startMatch.index! + startMatch[0].length);
  if (endMatch)   body = body.slice(0, body.indexOf(endMatch[0]));
  return body.trim();
}

/** Heuristic: is this trimmed line really a heading vs prose containing those words? */
function isLikelyHeading(trim: string): boolean {
  if (!trim) return false;
  if (trim.length > 80) return false;
  // Mostly uppercase / Title-case / Roman numeral
  const noBracket = trim.replace(/[\[\]\.\:,'\-]/g, "").trim();
  const isAllCaps = noBracket === noBracket.toUpperCase() && /[A-Z]/.test(noBracket);
  const startsWithChapter = /^(CHAPTER|BOOK|PART|VOLUME|CANTO|SECTION|PREFACE|INTRODUCTION|PROLOGUE|EPILOGUE|FOREWORD|APPENDIX)/i.test(trim);
  const isRomanOnly = /^[IVXLC]+\.?$/i.test(trim);
  return isAllCaps || startsWithChapter || isRomanOnly;
}

function prettyHeading(trim: string): string {
  // CHAPTER I. — Bennets become acquainted with Bingley → "Chapter I — Bennets become acquainted with Bingley"
  return trim.replace(/^(CHAPTER|BOOK|PART|VOLUME|CANTO|SECTION|PREFACE|INTRODUCTION|PROLOGUE|EPILOGUE|FOREWORD|APPENDIX)/i, (m) =>
    m.charAt(0).toUpperCase() + m.slice(1).toLowerCase()
  );
}

/** Detect a real run-on prose line — long, ends in a period or sentence punctuation. */
function looksLikeProse(line: string): boolean {
  if (line.length < 80) return false;
  if (/[.!?'"]\s*$/.test(line)) return true;
  // Or: long enough that it's clearly not boilerplate
  return line.length > 140 && !/^[A-Z\s.,'\-:]+$/.test(line);
}

/** Decide whether an indented line is part of an actual verse stanza. */
function verseSurroundings(lines: string[], i: number): boolean {
  // Look backward + forward — verse usually clusters with other indented lines.
  let near = 0;
  for (let j = Math.max(0, i - 4); j <= Math.min(lines.length - 1, i + 4); j++) {
    if (j === i) continue;
    if (/^\s{4,}\S/.test(lines[j])) near++;
  }
  return near >= 2;
}

function escape(s: string) {
  // 1. HTML-escape first (so we never inject raw < / > / &).
  // 2. Convert PG-style _italic_ markers → <em>italic</em> (Gutenberg's
  //    long-standing convention for emphasis in plain-text editions).
  //    Greedy matching is fine because we're working line-by-line so
  //    the markers don't span paragraph boundaries.
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/(^|[^\w_])_([^_]{1,8000}?)_(?=[^\w_]|$)/g, "$1<em>$2</em>");
}
function slugifyHeading(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

/** Extract the TOC from the formatted HTML — used by the reader's side-panel. */
export function extractToc(html: string): { id: string; label: string }[] {
  const toc: { id: string; label: string }[] = [];
  const re = /<h2 id="([^"]+)">([^<]+)<\/h2>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) toc.push({ id: m[1], label: m[2] });
  return toc;
}
