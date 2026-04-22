#!/usr/bin/env tsx
/**
 * Paperhall — book ingestion pipeline.
 *
 * Reads /data/books.json (the curated 100), fetches each book's plain-text
 * body from Project Gutenberg (https://www.gutenberg.org/cache/epub/<id>/pg<id>.txt),
 * cleans it into reader-ready HTML, and stores:
 *
 *   - metadata  → SQLite via Prisma (Book table)
 *   - content   → storage/books/<id>/content.html
 *   - raw cache → data/cache/<id>.txt  (for re-runs without re-download)
 *
 * Flags:
 *   --limit=N        only import the first N from books.json
 *   --refresh        ignore the local cache + re-fetch from Gutenberg
 *   --only=<id,id>   only import the given ids (for debugging)
 *
 * Idempotent. Resumable. Logged.
 */

import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";
import { formatText, stripPGWrapper } from "../lib/library/formatter";
import { SUMMARIES } from "../data/summaries";

type BookSpec = {
  id: string;
  title: string;
  author: string;
  category: string;
  language: string;
  gutenbergId: number;
  isFeatured?: boolean;
};

const prisma = new PrismaClient();
const CACHE_DIR    = path.join(process.cwd(), "data", "cache");
const STORAGE_DIR  = path.join(process.cwd(), "storage", "books");

const args = parseArgs();
const log  = (msg: string) => console.log(`[paperhall] ${msg}`);
const warn = (msg: string) => console.warn(`[paperhall] ⚠ ${msg}`);

async function main() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.mkdir(STORAGE_DIR, { recursive: true });

  const raw = await fs.readFile(path.join(process.cwd(), "data", "books.json"), "utf8");
  let specs = JSON.parse(raw) as BookSpec[];

  if (args.only.length) specs = specs.filter((s) => args.only.includes(s.id));
  if (args.limit)       specs = specs.slice(0, args.limit);

  log(`Importing ${specs.length} book${specs.length === 1 ? "" : "s"}…`);

  let ok = 0, skipped = 0, failed = 0;
  for (const spec of specs) {
    try {
      const r = await importOne(spec);
      if (r === "ok")       ok++;
      if (r === "skipped")  skipped++;
      if (r === "failed")   failed++;
    } catch (err) {
      failed++;
      warn(`${spec.id}: ${(err as Error).message}`);
    }
  }

  log(`Done. ✓ ${ok} imported · ⤳ ${skipped} cached · ✗ ${failed} failed.`);
  await prisma.$disconnect();
}

async function importOne(spec: BookSpec): Promise<"ok" | "skipped" | "failed"> {
  const contentPath = path.join("books", spec.id, "content.html");
  const absContent  = path.join(STORAGE_DIR, spec.id, "content.html");

  // Fast-path: if content exists + DB row exists + not --refresh → skip.
  if (!args.refresh && await exists(absContent)) {
    const existing = await prisma.book.findUnique({ where: { id: spec.id } });
    if (existing) {
      process.stdout.write(`  ⤳ ${spec.id}\n`);
      return "skipped";
    }
  }

  // 1. Fetch or load cached raw text
  const raw = await fetchOrCache(spec);
  if (!raw) {
    warn(`${spec.id}: empty body`);
    return "failed";
  }

  // 2. Format + clean
  const { html, wordCount } = formatText(raw);
  if (html.length < 400) {
    warn(`${spec.id}: formatted HTML too short (${html.length} bytes)`);
    return "failed";
  }

  // 3. Write to /storage/books/<id>/content.html
  await fs.mkdir(path.dirname(absContent), { recursive: true });
  await fs.writeFile(absContent, wrapStandalone(html, spec), "utf8");

  // 4. Upsert metadata
  await prisma.book.upsert({
    where: { id: spec.id },
    update: {
      title: spec.title, author: spec.author, language: spec.language, category: spec.category,
      summary: SUMMARIES[spec.id] ?? null,
      coverUrl: `https://www.gutenberg.org/cache/epub/${spec.gutenbergId}/pg${spec.gutenbergId}.cover.medium.jpg`,
      contentPath, wordCount, isFeatured: !!spec.isFeatured,
      source: "gutenberg", sourceId: String(spec.gutenbergId),
    },
    create: {
      id: spec.id, title: spec.title, author: spec.author, language: spec.language, category: spec.category,
      summary: SUMMARIES[spec.id] ?? null,
      coverUrl: `https://www.gutenberg.org/cache/epub/${spec.gutenbergId}/pg${spec.gutenbergId}.cover.medium.jpg`,
      contentPath, wordCount, isFeatured: !!spec.isFeatured,
      source: "gutenberg", sourceId: String(spec.gutenbergId),
    },
  });

  const kWords = (wordCount / 1000).toFixed(1);
  process.stdout.write(`  ✓ ${spec.id.padEnd(28)}  ${kWords}k words\n`);
  return "ok";
}

/** Fetch from Gutenberg with several URL shapes tried in order. */
async function fetchOrCache(spec: BookSpec): Promise<string | null> {
  const cacheFile = path.join(CACHE_DIR, `${spec.id}.txt`);
  if (!args.refresh && await exists(cacheFile)) {
    return fs.readFile(cacheFile, "utf8");
  }
  const urls = [
    `https://www.gutenberg.org/cache/epub/${spec.gutenbergId}/pg${spec.gutenbergId}.txt`,
    `https://www.gutenberg.org/files/${spec.gutenbergId}/${spec.gutenbergId}-0.txt`,
    `https://www.gutenberg.org/files/${spec.gutenbergId}/${spec.gutenbergId}.txt`,
  ];
  let last: Error | null = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "paperhall/0.1 (library importer)" },
        redirect: "follow",
      });
      if (!res.ok) { last = new Error(`HTTP ${res.status} on ${url}`); continue; }
      const text = await res.text();
      if (text.length < 1000) { last = new Error(`Body too short (${text.length}b)`); continue; }
      await fs.writeFile(cacheFile, text, "utf8");
      return text;
    } catch (err) {
      last = err as Error;
    }
  }
  warn(`${spec.id}: fetch failed · ${last?.message}`);
  return null;
}

/** Wrap formatted body with a tiny HTML envelope so the reader can parse it. */
function wrapStandalone(body: string, spec: BookSpec): string {
  return `<!doctype html>
<meta charset="utf-8" />
<title>${spec.title} — ${spec.author}</title>
<article data-book-id="${spec.id}" data-title="${escapeAttr(spec.title)}" data-author="${escapeAttr(spec.author)}">
${body}
</article>`;
}
function escapeAttr(s: string) { return s.replace(/"/g, "&quot;"); }

async function exists(p: string) {
  try { await fs.access(p); return true; } catch { return false; }
}

function parseArgs() {
  const out = { limit: 0, refresh: false, only: [] as string[] };
  for (const raw of process.argv.slice(2)) {
    if (raw === "--refresh") { out.refresh = true; continue; }
    if (raw.startsWith("--limit=")) { out.limit = +raw.slice("--limit=".length); continue; }
    if (raw.startsWith("--only=")) { out.only = raw.slice("--only=".length).split(",").map((s) => s.trim()); continue; }
  }
  return out;
}

main().catch((err) => { console.error(err); process.exit(1); });
