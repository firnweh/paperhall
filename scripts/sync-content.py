#!/usr/bin/env python3
"""
sync-content.py — pull the Paperhall catalogue (books.json + content.html) from
the Lably source of truth into this standalone project.

  source:  ~/lably/frontend/public/paperhall-books/<id>/content.html  (+ books.json)
  dest:    ./data/books.json   and   ./storage/books/<id>/content.html

Enriches each book with a computed wordCount + the fields the app expects.
Run after the Lably importer adds/regenerates books.
"""
import json, os, re, shutil

SRC = os.path.expanduser("~/lably/frontend/public/paperhall-books")
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST_BOOKS = os.path.join(HERE, "public", "books")
DST_JSON = os.path.join(HERE, "data", "books.json")

TAG_RE = re.compile(r"<[^>]+>")


def word_count(html: str) -> int:
    text = TAG_RE.sub(" ", html)
    text = re.sub(r"&[a-z]+;", " ", text)
    return len(text.split())


def main():
    src_books = json.load(open(os.path.join(SRC, "books.json")))
    os.makedirs(DST_BOOKS, exist_ok=True)
    out = []
    copied = 0
    for b in src_books:
        bid = b["id"]
        src_html = os.path.join(SRC, bid, "content.html")
        if not os.path.exists(src_html):
            print(f"  ! missing content: {bid}")
            continue
        dst_dir = os.path.join(DST_BOOKS, bid)
        os.makedirs(dst_dir, exist_ok=True)
        shutil.copyfile(src_html, os.path.join(dst_dir, "content.html"))
        copied += 1
        wc = word_count(open(src_html, encoding="utf-8").read())
        out.append({
            "id": bid,
            "title": b["title"],
            "author": b["author"],
            "language": b.get("language", "en"),
            "category": b["category"],
            "subjectsCsv": b.get("subjectsCsv", ""),
            "summary": b.get("summary"),
            "coverUrl": None,
            "contentPath": f"{bid}/content.html",
            "wordCount": wc,
            "isFeatured": bool(b.get("isFeatured", False)),
            "source": "gutenberg",
            "sourceId": str(b.get("gutenbergId", "")),
            "gutenbergId": b.get("gutenbergId"),
        })
    # prune dest dirs that are no longer in the catalogue
    keep = {b["id"] for b in out}
    for d in os.listdir(DST_BOOKS):
        if d not in keep and os.path.isdir(os.path.join(DST_BOOKS, d)):
            shutil.rmtree(os.path.join(DST_BOOKS, d))
    os.makedirs(os.path.dirname(DST_JSON), exist_ok=True)
    json.dump(out, open(DST_JSON, "w"), ensure_ascii=False, indent=2)
    # strip residual Project Gutenberg branding from the freshly-synced content
    os.system(f"python3 {os.path.join(os.path.dirname(__file__), 'clean-gutenberg.py')} {DST_BOOKS}")
    print(f"Synced {copied} books → {DST_BOOKS}")
    print(f"Wrote {len(out)} entries → {DST_JSON}")
    from collections import Counter
    print("Categories:", dict(sorted(Counter(b['category'] for b in out).items(), key=lambda x: -x[1])))


if __name__ == "__main__":
    main()
