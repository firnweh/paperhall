#!/usr/bin/env python3
"""
build_paperhall_books.py — the Paperhall import pipeline.

Reproducibly builds the bundled Paperhall library from Project Gutenberg.
For each book id in ADDITIONS it:
  1. Fetches canonical title/author from the Gutendex API (gutendex.com).
  2. Downloads the full UTF-8 plain text, trying several Gutenberg URL
     layouts (cache/epub, /files/<id>-0, /files/<id>-8, ebooks/.txt.utf-8,
     and the Gutendex-listed text/plain format) — skipping README stubs.
  3. Strips the Project Gutenberg header/license boilerplate.
  4. Detects chapter/part headings and wraps prose in <p>…</p>.
  5. Writes frontend/public/paperhall-books/<slug>/content.html in the exact
     shape the reader (/paperhall/[bookId]) expects.
  6. Appends metadata to frontend/public/paperhall-books/books.json.

Exact-id based (not fuzzy search) so the catalogue is deterministic.
Idempotent + resumable: a book whose gutenbergId already exists in books.json
is skipped, and an existing non-trivial content.html is not re-downloaded.

Usage:  python3 scripts/build_paperhall_books.py
"""
import html, json, os, re, time, unicodedata, urllib.parse, urllib.request

ROOT = os.path.abspath(os.path.join(
    os.path.dirname(__file__), "..", "public", "books"))
BOOKS_JSON = os.path.join(ROOT, "books.json")
UA = {"User-Agent": "PaperhallImporter/1.0 (+https://lably.in)"}

# ── Catalogue additions: (gutenbergId, category, featured[, title_override]) ──
# Dostoevsky + Kafka lead; then the wider public-domain canon. Anything whose
# gutenbergId is already in books.json is skipped, so this list is the full,
# reproducible set of the 100 books added on top of the original 100.
ADDITIONS = [
    # ── Dostoevsky ──
    (28054, "Fiction", True),                       # The Brothers Karamazov
    (2638, "Fiction", False),                       # The Idiot
    (8117, "Fiction", False),                       # The Possessed (Devils)
    (2197, "Fiction", False),                       # The Gambler
    (37536, "Fiction", False, "The House of the Dead"),
    (2302, "Fiction", False),                       # Poor Folk
    (36034, "Fiction", False),                      # White Nights & other stories
    # ── Kafka ──
    (7849, "Fiction", True),                        # The Trial
    # ── Russian / continental ──
    (47935, "Fiction", False),                      # Fathers and Sons — Turgenev
    (1081, "Fiction", False),                       # Dead Souls — Gogol
    (1938, "Fiction", False),                       # Resurrection — Tolstoy
    (689, "Fiction", False),                        # The Kreutzer Sonata — Tolstoy
    (7986, "Drama", False, "Plays by Anton Chekhov"),
    (135, "Fiction", True, "Les Misérables"),       # Hugo
    (2610, "Fiction", False),                        # Notre-Dame de Paris — Hugo
    (2413, "Fiction", False),                        # Madame Bovary — Flaubert
    (1237, "Fiction", False),                        # Father Goriot — Balzac
    (1715, "Fiction", False),                        # Eugénie Grandet — Balzac
    (44747, "Fiction", False, "The Red and the Black"),  # Stendhal
    (56528, "Fiction", False),                       # Germinal — Zola
    (19942, "Fiction", False),                       # Candide — Voltaire
    # ── English novels ──
    (145, "Fiction", False),                         # Middlemarch
    (550, "Fiction", False),                         # Silas Marner
    (6688, "Fiction", False),                        # The Mill on the Floss
    (110, "Fiction", False),                         # Tess of the d'Urbervilles
    (107, "Fiction", False),                         # Far from the Madding Crowd
    (143, "Fiction", False),                         # The Mayor of Casterbridge
    (153, "Fiction", False),                         # Jude the Obscure
    (599, "Fiction", False),                         # Vanity Fair
    (1023, "Fiction", False),                        # Bleak House
    (46, "Fiction", True),                           # A Christmas Carol
    (786, "Fiction", False),                         # Hard Times
    (580, "Fiction", False),                         # The Pickwick Papers
    (967, "Fiction", False),                         # Nicholas Nickleby
    (105, "Fiction", False),                         # Persuasion
    (121, "Fiction", False),                         # Northanger Abbey
    (969, "Fiction", False),                         # The Tenant of Wildfell Hall
    (394, "Fiction", False),                         # Cranford
    (4276, "Fiction", False),                        # North and South
    (2641, "Fiction", False),                        # A Room with a View
    (541, "Fiction", False),                         # The Age of Innocence
    (4517, "Fiction", False),                        # Ethan Frome
    (284, "Fiction", False),                         # The House of Mirth
    (160, "Fiction", False),                         # The Awakening
    (2870, "Fiction", False),                        # Washington Square
    (233, "Fiction", False),                         # Sister Carrie
    (242, "Fiction", False),                         # My Ántonia
    (543, "Fiction", False),                         # Main Street
    (805, "Fiction", False),                         # This Side of Paradise
    (219, "Fiction", True),                          # Heart of Darkness
    (974, "Fiction", False),                         # The Secret Agent
    (217, "Fiction", False),                         # Sons and Lovers
    # ── American classics ──
    (76, "Adventure", True),                         # Huckleberry Finn
    (74, "Adventure", False),                        # Tom Sawyer
    (86, "Adventure", False),                        # A Connecticut Yankee…
    (1837, "Adventure", False),                      # The Prince and the Pauper
    (73, "Fiction", False),                          # The Red Badge of Courage
    (940, "Adventure", False),                       # The Last of the Mohicans
    (203, "Fiction", False),                         # Uncle Tom's Cabin
    # ── Sci-Fi / adventure ──
    (36, "Sci-Fi", True, "The War of the Worlds"),
    (159, "Sci-Fi", False),                          # The Island of Doctor Moreau
    (1013, "Sci-Fi", False),                         # The First Men in the Moon
    (62, "Sci-Fi", False),                           # A Princess of Mars
    (1268, "Adventure", False),                      # The Mysterious Island
    (83, "Sci-Fi", False),                           # From the Earth to the Moon
    (139, "Adventure", False),                       # The Lost World
    (244, "Mystery", False),                         # A Study in Scarlet
    (2097, "Mystery", False),                        # The Sign of the Four
    (108, "Mystery", False),                         # The Return of Sherlock Holmes
    (3289, "Mystery", False),                        # The Valley of Fear
    (583, "Mystery", False),                         # The Woman in White
    (155, "Mystery", False),                         # The Moonstone
    (421, "Adventure", False),                       # Kidnapped
    (82, "Adventure", False),                        # Ivanhoe
    (965, "Adventure", False, "The Black Tulip"),    # Dumas (1259 was a multi-volume bundle)
    (2759, "Adventure", False),                      # The Man in the Iron Mask
    # ── Children ──
    (45, "Children", False),                         # Anne of Green Gables
    (146, "Children", False),                        # A Little Princess
    (55, "Children", True),                          # The Wonderful Wizard of Oz
    (27805, "Children", False),                      # The Wind in the Willows
    (271, "Children", False),                        # Black Beauty
    (500, "Children", False),                        # Pinocchio
    (2591, "Children", False),                       # Grimms' Fairy Tales
    (1597, "Children", False),                       # Andersen's Fairy Tales
    (11339, "Children", False),                      # Aesop's Fables
    # ── Philosophy / ideas ──
    (51356, "Philosophy", False),                    # The Birth of Tragedy
    (18269, "Philosophy", False, "Pensées"),         # Pascal (52319 was a collected-works volume)
    (46333, "Philosophy", False, "The Social Contract"),  # Rousseau (52263 bundled two works)
    (59, "Philosophy", False),                        # Discourse on Method
    (61, "Philosophy", False),                        # The Communist Manifesto
    (3600, "Essays", False),                          # Essays — Montaigne
    (216, "Global", False, "Tao Te Ching"),           # The Tao Teh King
    (3330, "Global", False),                          # The Analects of Confucius
    # ── Memoir / history ──
    (23, "Memoir", False),                            # Frederick Douglass
    (2376, "Memoir", False),                          # Up from Slavery
    (148, "Memoir", False),                           # Autobiography of Ben Franklin
    (11030, "Memoir", False),                         # Incidents…Slave Girl
    (45631, "Memoir", False),                         # Twelve Years a Slave
    (308, "Fiction", False, "Three Men in a Boat"),   # Jerome K. Jerome
    (7164, "Poetry", True),                           # Gitanjali — Tagore
]


def get_json(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
        return json.load(r)


def fetch_text(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
            return r.read().decode("utf-8", "replace")
    except Exception:
        return ""


def _accept(t):
    low = t.lower()
    # Accept real Gutenberg texts (they carry the START marker) — this lets short
    # works (poems, essays) through while rejecting README stubs that lack it.
    return len(t) > 1500 and ("start of the project gutenberg" in low
                              or (len(t) > 40000 and "gutenberg" in low[:4000]))


def download(bid):
    """Try several Gutenberg layouts; return real book text or ''. """
    for u in (f"https://www.gutenberg.org/cache/epub/{bid}/pg{bid}.txt",
              f"https://www.gutenberg.org/files/{bid}/{bid}-0.txt",
              f"https://www.gutenberg.org/files/{bid}/{bid}-8.txt",
              f"https://www.gutenberg.org/ebooks/{bid}.txt.utf-8"):
        t = fetch_text(u)
        if _accept(t):
            return t
    # Fall back to the Gutendex-listed plain-text format only if the guesses miss.
    try:
        for mime, link in get_json(f"https://gutendex.com/books/{bid}/").get("formats", {}).items():
            if mime.startswith("text/plain") and "readme" not in link.lower() and not link.endswith(".zip"):
                t = fetch_text(link)
                if _accept(t):
                    return t
    except Exception:
        pass
    return ""


def clean_author(name):
    name = re.sub(r"\([^)]*\)", "", name).strip()  # drop "(Herbert George)" etc.
    if "," in name:
        parts = [p.strip() for p in name.split(",") if p.strip()]
        if len(parts) >= 2:
            name = f"{parts[1]} {parts[0]}"
        else:
            name = parts[0]
    return re.sub(r"\s+", " ", name).strip()


def meta(bid):
    d = get_json(f"https://gutendex.com/books/{bid}/")
    title = d["title"].split(" : ")[0].split(" — ")[0].strip()
    author = clean_author(d["authors"][0]["name"]) if d.get("authors") else "Unknown"
    return title, author


def slugify(title, used):
    # transliterate accents (é→e, á→a, …) so slugs stay clean ASCII
    s = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode()
    s = re.sub(r"&", " and ", s.lower())
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    s = "-".join(s.split("-")[:6])[:42].strip("-")
    base, n = s, 2
    while s in used:
        s = f"{base}-{n}"; n += 1
    return s


GUT_START = re.compile(r"\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG.*?\*\*\*", re.I | re.S)
GUT_END = re.compile(r"\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG.*?\*\*\*", re.I | re.S)
HEADING = re.compile(
    r"^(chapter|chap\.|letter|book|part|volume|vol\.|act|scene|canto|stave|"
    r"section|epilogue|prologue|introduction|preface|prelude|finale|foreword|"
    r"afterword|conclusion|postscript|appendix|argument|sonnet|hymn|ode|psalm)\b", re.I)
ROMAN = re.compile(r"^[IVXLCDM]{1,7}\.?$")
ARABIC = re.compile(r"^\d{1,3}\.?$")
# Books in these categories get whole-book verse mode (line breaks preserved).
VERSE_CATEGORIES = {"Poetry", "Drama"}


def strip_boilerplate(text):
    m = GUT_START.search(text)
    if m:
        text = text[m.end():]
    m = GUT_END.search(text)
    if m:
        text = text[:m.start()]
    text = re.sub(r"^\s*Produced by[^\n]*\n", "", text, count=1, flags=re.I)
    return text.strip()


def is_heading(lines):
    if len(lines) > 2:
        return None
    t = " ".join(l.strip() for l in lines).strip()
    if not t or len(t) > 64:
        return None
    if t[0] in "\"'“‘":  # opening quote → dialogue, not a heading
        return None
    if HEADING.match(t) or ROMAN.match(t) or ARABIC.match(t):
        return t
    # generic all-caps heading: require ≥2 words, no run-on sentence punctuation
    if (t.isupper() and 2 <= len(t.split()) <= 8 and any(c.isalpha() for c in t)
            and not re.search(r"[.?!],?\s+\S", t)):
        return t
    return None


def is_verse_block(lines):
    """Conservative embedded-verse check for prose books (avg line clearly short)."""
    if len(lines) < 2:
        return False
    nonlast = [l.rstrip() for l in lines[:-1] if l.strip()]
    if not nonlast:
        return False
    return sum(len(l) for l in nonlast) / len(nonlast) < 48


def esc(s):
    s = html.escape(s, quote=False)
    return re.sub(r"_([^_\n]{1,120}?)_", r"<em>\1</em>", s)


def verse_para(lines):
    vl = [esc(re.sub(r"[ \t]+", " ", l.strip())) for l in lines if l.strip()]
    return '<p class="verse">' + "<br>".join(vl) + "</p>"


def to_html(text, slug, title, author, verse_mode=False):
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = strip_boilerplate(text)
    headings, body, hid = [], [], 0
    for blk in re.split(r"\n[ \t]*\n", text):
        lines = blk.split("\n")
        if not "".join(lines).strip():
            continue
        h = is_heading(lines)
        if h:
            hid += 1
            label = re.sub(r"\s+", " ", h).strip()
            headings.append((f"sec-{hid}", label))
            body.append(f'<h2 id="sec-{hid}">{esc(label)}</h2>')
        elif verse_mode or is_verse_block(lines):
            body.append(verse_para(lines))
        else:
            para = re.sub(r"\s+", " ", " ".join(l.strip() for l in lines)).strip()
            body.append(f"<p>{esc(para)}</p>")
    toc = "\n".join(f'<h2 class="toc-entry">{esc(l)}</h2>' for _, l in headings)
    doc = ("<!doctype html>\n<meta charset=\"utf-8\" />\n"
           f"<title>{esc(title)} — {esc(author)}</title>\n"
           f'<article data-book-id="{slug}" data-title="{esc(title)}" data-author="{esc(author)}">\n'
           + (toc + "\n" if toc else "") + "\n".join(body) + "\n</article>\n")
    return doc, len(headings)


def main():
    books = json.load(open(BOOKS_JSON))
    used_ids = {b["gutenbergId"] for b in books}
    used_slugs = {b["id"] for b in books}
    print(f"Existing: {len(books)} books.\n")

    added, failures = [], []
    for entry in ADDITIONS:
        bid, cat, feat = entry[0], entry[1], entry[2]
        override = entry[3] if len(entry) > 3 else None
        if bid in used_ids:
            continue
        print(f"  id={bid:<6}", end="  ")
        try:
            title, author = meta(bid)
            if override:
                title = override
            slug = slugify(title, used_slugs)
            out_dir = os.path.join(ROOT, slug)
            out_file = os.path.join(out_dir, "content.html")
            if os.path.exists(out_file) and os.path.getsize(out_file) > 8000:
                size, ch = os.path.getsize(out_file), -1
            else:
                raw = download(bid)
                if not raw:
                    raise ValueError("no usable plain text")
                if "LINKED INDEX OF PROJECT GUTENBERG" in raw[:6000].upper():
                    raise ValueError("multi-volume bundle — pick a standalone edition")
                doc, ch = to_html(raw, slug, title, author, verse_mode=(cat in VERSE_CATEGORIES))
                if len(doc) < 6000:
                    raise ValueError("converted doc too small")
                os.makedirs(out_dir, exist_ok=True)
                open(out_file, "w").write(doc)
                size = len(doc)
        except Exception as e:
            print(f"✗ {e}")
            failures.append((bid, str(e)))
            continue
        used_ids.add(bid)
        used_slugs.add(slug)
        e = {"id": slug, "title": title, "author": author,
             "category": cat, "language": "en", "gutenbergId": bid}
        if feat:
            e["isFeatured"] = True
        added.append(e)
        print(f"✓ {size//1024:>4}KB ch={ch:<4} {title[:40]} — {author}")
        time.sleep(0.3)

    if added:
        json.dump(books + added, open(BOOKS_JSON, "w"), ensure_ascii=False, indent=2)
        print(f"\n✅ Added {len(added)} → {len(books)+len(added)} total in books.json")
    else:
        print("\nNothing to add — catalogue already complete.")
    if failures:
        print(f"\n⚠️  {len(failures)} failures: {failures}")


if __name__ == "__main__":
    main()
