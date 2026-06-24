#!/usr/bin/env python3
"""
regenerate_paperhall.py — re-download + re-convert existing Paperhall books with
the current converter (verse-aware). Keeps each book's slug/title/author/category
from books.json; only rewrites content.html.

Usage:
  python3 scripts/regenerate_paperhall.py            # all books
  python3 scripts/regenerate_paperhall.py <slug>...  # only these slugs
"""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
import build_paperhall_books as B

books = json.load(open(B.BOOKS_JSON))
only = set(sys.argv[1:])
todo = [b for b in books if not only or b["id"] in only]
print(f"Regenerating {len(todo)} book(s)…\n")

ok, fail = 0, []
for b in todo:
    slug, gid, cat = b["id"], b["gutenbergId"], b.get("category", "")
    verse = cat in B.VERSE_CATEGORIES
    try:
        raw = B.download(gid)
        if not raw:
            raise ValueError("no text")
        doc, ch = B.to_html(raw, slug, b["title"], b["author"], verse_mode=verse)
        if len(doc) < 4000:
            raise ValueError("too small")
        d = os.path.join(B.ROOT, slug)
        os.makedirs(d, exist_ok=True)
        open(os.path.join(d, "content.html"), "w").write(doc)
        nbr = doc.count("<br>")
        ok += 1
        print(f"  ✓ {slug:34} id={gid:<6} {('VERSE' if verse else 'prose'):5} {len(doc)//1024:>4}KB ch={ch:<4} br={nbr}")
    except Exception as e:
        fail.append((slug, str(e)))
        print(f"  ✗ {slug:34} id={gid:<6} {e}")
    time.sleep(0.25)

print(f"\nDone: {ok} ok, {len(fail)} failed")
if fail:
    for s, e in fail:
        print(f"   - {s}: {e}")
