// upload-blob.mjs — upload public/books/<slug>/content.html to the Vercel Blob
// store at pathname books/<slug>/content.html (public, deterministic URL).
// Usage: BLOB_READ_WRITE_TOKEN=... node scripts/upload-blob.mjs [only-new]
//   pass "only-new" to skip slugs already present in the store (for incremental
//   uploads when adding books).
import { put, list } from "@vercel/blob";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BOOKS = join(ROOT, "public", "books");
const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) { console.error("Missing BLOB_READ_WRITE_TOKEN"); process.exit(1); }
const onlyNew = process.argv.includes("only-new");

const slugs = readdirSync(BOOKS).filter(
  (d) => statSync(join(BOOKS, d)).isDirectory() && existsSync(join(BOOKS, d, "content.html")),
);

let existing = new Set();
if (onlyNew) {
  let cursor;
  do {
    const r = await list({ token, prefix: "books/", cursor, limit: 1000 });
    for (const b of r.blobs) {
      const m = b.pathname.match(/^books\/(.+)\/content\.html$/);
      if (m) existing.add(m[1]);
    }
    cursor = r.cursor;
  } while (cursor);
  console.log(`store already has ${existing.size} books`);
}

const todo = slugs.filter((s) => !existing.has(s));
console.log(`uploading ${todo.length} / ${slugs.length} books…`);

let i = 0, done = 0;
const failed = [];
const CONC = 24;
async function worker() {
  while (i < todo.length) {
    const slug = todo[i++];
    try {
      await put(`books/${slug}/content.html`, readFileSync(join(BOOKS, slug, "content.html")), {
        access: "public", token, addRandomSuffix: false, allowOverwrite: true, contentType: "text/html",
      });
      if (++done % 50 === 0) console.log(`  ${done}/${todo.length}`);
    } catch (e) {
      failed.push([slug, String(e.message || e)]);
    }
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
console.log(`DONE: uploaded ${done}/${todo.length}, failed ${failed.length}`);
if (failed.length) console.log(failed.slice(0, 15));
