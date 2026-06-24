#!/usr/bin/env python3
"""
add_from_list.py — resolve a Title/Author list (the 1000-best-books sheet) against
Project Gutenberg and add the public-domain ones to Paperhall.

Reads /tmp/xlsx_books.json (list of {title, author, shelf, cat, core100}).
For each: strict Gutendex resolution (author surname + title-keyword match,
English, has plain text, not a bundle, not already in the catalogue), then
download + verse-aware convert + append to books.json.

Usage: python3 scripts/add_from_list.py [--limit N]
"""
import argparse, json, os, re, sys, time
sys.path.insert(0, os.path.dirname(__file__))
import build_paperhall_books as B
import urllib.parse

SRC = "/tmp/xlsx_books.json"


def norm_title(t):
    t = re.sub(r"[^a-z0-9 ]", " ", t.lower())
    t = re.sub(r"\b(the|a|an|of|and|or|in|to)\b", " ", t)
    return re.sub(r"\s+", " ", t).strip()


STOP = {"the", "a", "an", "of", "and", "or", "in", "to", "on", "with", "for",
        "de", "la", "le", "vol", "part", "book", "volume", "complete", "selected"}


def work_key(title, author):
    """A coarse identity for a work: author surname + top title keywords. Used to
    skip alternate editions of a work already in the catalogue."""
    a = (author or "").lower()
    anon = any(x in a for x in ("anon", "unknown", "various", "traditional"))
    parts = re.sub(r"[^a-z ]", "", a).split()
    surname = "" if anon or not parts else parts[-1]
    kws = tuple(sorted(w for w in re.sub(r"[^a-z0-9 ]", " ", title.lower()).split()
                       if len(w) > 3 and w not in STOP)[:3])
    return (surname, kws)


def map_category(shelf, cat):
    s, c = (shelf or "").lower(), (cat or "").lower()
    if "poetry & drama" in s or "poetry" in s:
        if any(k in c for k in ["drama", "play", "theatre", "theater", "tragedy", "comedy"]):
            return "Drama"
        return "Poetry"
    if "young readers" in s:
        return "Children"
    if "life writing" in s:
        return "Memoir" if any(k in c for k in ["memoir", "auto", "biograph", "diary", "letters", "life"]) else "Essays"
    if "science, mind" in s:
        return "Science"
    if "ideas, belief" in s:
        if any(k in c for k in ["histor"]):
            return "History"
        return "Philosophy"
    if "arts, culture" in s:
        return "Essays"
    if "foundational" in s:
        if any(k in c for k in ["epic", "myth", "premodern"]):
            return "Global"
        return "Fiction"
    if "literary & genre" in s:
        if "myster" in c or "crime" in c or "detective" in c:
            return "Mystery"
        if "science fiction" in c or "sci-fi" in c or "dystop" in c:
            return "Sci-Fi"
        if "adventure" in c:
            return "Adventure"
        return "Fiction"
    return "Fiction"


def is_english(b):
    return "en" in (b.get("languages") or [])


def gutendex_search(q):
    url = "https://gutendex.com/books/?" + urllib.parse.urlencode({"search": q, "languages": "en"})
    try:
        return B.get_json(url).get("results", [])
    except Exception:
        return []


BUNDLE_RE = re.compile(r"index of|complete works|collected works|^works of|linked", re.I)


def resolve(title, author, used_ids):
    results = gutendex_search(f"{title} {author}".strip())
    anon = (not author) or author.strip().lower() in ("anonymous", "unknown", "various", "traditional")
    surname = None if anon else re.sub(r"[^a-z]", "", author.split()[-1].lower())
    title_kw = [w for w in re.sub(r"[^a-z0-9 ]", " ", title.lower()).split() if len(w) > 2][:5]
    for b in results:
        if not is_english(b):
            continue
        rtitle = b["title"].lower()
        if BUNDLE_RE.search(rtitle):
            continue
        rauth = " ".join(a["name"] for a in b.get("authors", [])).lower()
        if surname and surname not in re.sub(r"[^a-z ]", "", rauth):
            continue
        if title_kw:
            hits = sum(1 for w in title_kw if w in rtitle)
            if hits < max(1, (len(title_kw) + 1) // 2):
                continue
        # first genuine match decides: if it's already in the catalogue, this
        # work is present — don't substitute a different edition.
        if b["id"] in used_ids:
            return None
        return b
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=100000)
    args = ap.parse_args()

    want = json.load(open(SRC))
    books = json.load(open(B.BOOKS_JSON))
    used_ids = {b["gutenbergId"] for b in books}
    used_slugs = {b["id"] for b in books}
    used_titles = {norm_title(b["title"]) for b in books}
    used_works = {work_key(b["title"], b["author"]) for b in books}
    print(f"Catalogue: {len(books)} books. Resolving {len(want)} wanted titles…\n")

    added, skipped_dup, unresolved = [], 0, 0
    for i, w in enumerate(want):
        if len(added) >= args.limit:
            break
        title, author = w["title"], w.get("author", "")
        if norm_title(title) in used_titles:
            skipped_dup += 1
            continue
        b = resolve(title, author, used_ids)
        if not b:
            unresolved += 1
            continue
        gid = b["id"]
        rtitle = b["title"].split(" : ")[0].split(" — ")[0].strip()
        author_clean = B.clean_author(b["authors"][0]["name"]) if b.get("authors") else (author or "Unknown")
        wk = work_key(rtitle, author_clean)
        if norm_title(rtitle) in used_titles or wk in used_works:
            used_ids.add(gid); skipped_dup += 1; continue
        cat = map_category(w.get("shelf"), w.get("cat"))
        slug = B.slugify(rtitle, used_slugs)
        d = os.path.join(B.ROOT, slug)
        cfile = os.path.join(d, "content.html")
        try:
            if os.path.exists(cfile) and os.path.getsize(cfile) > 8000:
                pass  # reuse already-downloaded content (resume / orphan salvage)
            else:
                raw = B.download(gid)
                if not raw:
                    raise ValueError("no text")
                if "LINKED INDEX OF PROJECT GUTENBERG" in raw[:6000].upper():
                    raise ValueError("bundle")
                doc, ch = B.to_html(raw, slug, rtitle, author_clean, verse_mode=(cat in B.VERSE_CATEGORIES))
                if len(doc) < 2500:
                    raise ValueError("too small")
                os.makedirs(d, exist_ok=True)
                open(cfile, "w").write(doc)
        except Exception as e:
            unresolved += 1
            continue
        used_ids.add(gid); used_slugs.add(slug); used_titles.add(norm_title(rtitle)); used_works.add(wk)
        entry = {"id": slug, "title": rtitle, "author": author_clean,
                 "category": cat, "language": "en", "gutenbergId": gid}
        added.append(entry)
        # checkpoint books.json frequently so a kill doesn't lose progress
        if len(added) % 8 == 0:
            json.dump(books + added, open(B.BOOKS_JSON, "w"), ensure_ascii=False, indent=2)
            print(f"  …checkpoint: {len(added)} added (at want #{i+1}/{len(want)})", flush=True)
        time.sleep(0.25)

    json.dump(books + added, open(B.BOOKS_JSON, "w"), ensure_ascii=False, indent=2)
    print(f"\n✅ Added {len(added)} new books → {len(books)+len(added)} total")
    print(f"   Skipped (already in catalogue): {skipped_dup}")
    print(f"   Not on Gutenberg / unresolved: {unresolved}")
    from collections import Counter
    print("   New by category:", dict(Counter(a["category"] for a in added)))


if __name__ == "__main__":
    main()
