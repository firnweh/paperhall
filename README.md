# Paperhall

A quiet, curated personal library where reading feels like opening a real book at a library table.

## What it is

- **100 curated public-domain books** across Fiction, Philosophy, Science, History, Poetry, Drama, Essays, Children, Adventure, Mystery, Global Classics, Self & Stoic, Sci-Fi, and Memoir.
- All content stored locally — no network calls at runtime.
- An immersive reader with three themes (paper / sepia / night), adjustable typography, progress tracking, and a TOC.
- Shelf + bookmarks + recently-opened kept in the browser's localStorage.

## Stack

Next.js (App Router, RSC) · TypeScript · Tailwind CSS · Prisma + SQLite · Zod.

## Quick start

```bash
cd paperhall
npm install
npm run db:setup          # creates prisma/paperhall.db and generates client
npm run import:books      # downloads + cleans the 100 books into storage/ (one-time)
npm run dev               # http://localhost:3080
```

The first `import:books` run takes ~5–10 minutes depending on network; subsequent runs are instant (cached under `data/cache/`).

## CLI commands

```bash
npm run db:setup                           # initialise SQLite + generate client
npm run db:reset                           # wipe + recreate (destructive)
npm run db:studio                          # open Prisma Studio
npm run import:books                       # import all 100 books
npm run import:books -- --limit=10         # first 10 only (quick smoke test)
npm run import:books:refresh               # ignore local cache + re-fetch from Gutenberg
npm run import:books -- --only=alice-wonderland,hamlet  # just these ids
```

## Project layout

```
paperhall/
├── app/                         # Next.js App Router
│   ├── api/search/route.ts      # local DB search endpoint
│   ├── book/[id]/               # book detail + catalog card
│   ├── browse/                  # all shelves + all books
│   ├── category/[id]/           # category shelf page
│   ├── my-shelf/                # saved books + currently reading + finished
│   ├── read/[id]/               # ★ the reading desk
│   ├── about/
│   ├── layout.tsx
│   ├── page.tsx                 # library lobby (home)
│   └── globals.css              # library typography + reader themes
├── components/                  # Navbar, SearchBar, BookCard, ShelfSection,
│                                # CategoryCard, CatalogCard, ContinueReading, etc.
├── data/
│   ├── books.json               # 100-book curated manifest
│   ├── summaries.ts             # hand-written librarian summaries
│   └── cache/                   # raw .txt downloads from Gutenberg (gitignored)
├── lib/
│   ├── db.ts                    # Prisma singleton
│   ├── library/
│   │   ├── books.ts             # query helpers (featured, popular, by category, search)
│   │   ├── categories.ts        # category metadata (colors, blurbs, emoji)
│   │   └── formatter.ts         # PG plain-text → clean HTML (TOC, scene breaks, verse)
│   └── storage/
│       └── shelf.ts             # client-side shelf + progress + recents (localStorage)
├── prisma/
│   └── schema.prisma            # Book + ReadingProgress models
├── scripts/
│   └── import-books.ts          # ingestion pipeline (idempotent, resumable, logged)
└── storage/books/<id>/content.html   # cleaned book content (gitignored)
```

## The reading experience

The reader (`/read/<book-id>`) is designed to recede:

- A **printed title page** opens every book — italic display serif, category, word count, estimated read time, ornament divider.
- The prose uses **Cormorant Garamond** at `1.125rem / 1.85` with drop-cap first letters, indented paragraphs, scene-break ornaments (`· · ·`), and verse preserved as centred stanzas.
- **Three themes**: Paper (off-white), Sepia (warm library paper), Night (dark + warm text). Press `1` / `2` / `3` to switch.
- **Adjustable type**: font size + line-height sliders live in a quiet popover.
- **Auto-hiding toolbar** slides up when you scroll down, reappears when you scroll up.
- **Focus mode** (`f`) removes everything but the page and the bottom progress rail.
- **Reading progress** saves to localStorage every 1.5 s; reopening the book scrolls back to your last position.
- **Table of contents** (`t`) slides in from the right with chapter markers detected by the formatter.
- **Bookmark** button on the toolbar adds the book to your shelf.
- A subtle **progress rail** at the very bottom of the viewport — no loud numbers, just a thin lamp-amber line.

## How the ingestion works

1. Reads `data/books.json`.
2. For each book, tries three URL shapes on Project Gutenberg (`/cache/epub/<id>/pg<id>.txt`, `/files/<id>/<id>-0.txt`, `/files/<id>/<id>.txt`) until one succeeds.
3. Caches the raw text under `data/cache/<id>.txt`.
4. Strips the PG header/footer boilerplate, detects chapter headings + scene breaks + verse, and wraps paragraphs.
5. Writes `storage/books/<id>/content.html` — a tiny standalone HTML envelope with `<article data-book-id="…">…</article>`.
6. Upserts metadata into SQLite (title, author, category, language, word count, summary, cover URL, `isFeatured`).

The pipeline is **idempotent** (existing books are skipped unless `--refresh`), **resumable** (re-run any time), and **logged** (per-book ✓ / ⤳ / ✗ status + final tally).

## Assumptions & limits

- **English only** — every book in the manifest is `en`. The DB schema supports other languages, but the ingestion + formatter currently target English PG texts.
- **Cover art** — we try to use Project Gutenberg's cover image (`pg<id>.cover.medium.jpg`); if missing, the `BookCard` falls back to a hand-made gradient cover with the title + author rendered directly on the spine.
- **Search** — MVP scan + in-memory match against a ~100-row table. FTS5 is a sensible upgrade when the library grows.
- **Single user** — no auth, no sync; shelf/progress stays on-device.
- **No AI / chat / social** — per the product brief.

## Future improvements

- Full-text search via SQLite FTS5 (`Book` virtual table + BM25 ranking).
- Optional `epub` / `pdf` ingestion (not just PG `.txt`).
- Per-chapter bookmarks + highlights with a minimal colour palette.
- PWA offline + home-screen install.
- Optional sync (only if a user explicitly opts in — default remains fully local).
