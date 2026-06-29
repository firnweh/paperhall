#!/usr/bin/env python3
"""
fill-books.py — top up under-filled categories to reach the 500-new target.

Single sequential process: loads data/books.json, dedups live against the whole
growing catalogue (so categories don't re-duplicate each other), and for each
(category, topic, deficit) pulls more popular books from Gutendex, converts +
cleans + writes content, and appends enriched entries directly to data/books.json
(checkpointing as it goes).
"""
import json, os, re, sys, time, urllib.parse, urllib.request, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PUB = os.path.join(ROOT, "public", "books")
BOOKS = os.path.join(ROOT, "data", "books.json")
sys.path.insert(0, HERE)
import build_paperhall_books as B
_spec = importlib.util.spec_from_file_location("cg", os.path.join(HERE, "clean-gutenberg.py"))
cg = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(cg)

STOP = {"the","a","an","of","and","or","in","to","on","with","for","de","la","le",
        "vol","part","book","volume","complete","selected"}
TAG_RE = re.compile(r"<[^>]+>")
BUNDLE_RE = re.compile(r"index of|complete works|collected works|^works of", re.I)
UA = {"User-Agent": "PaperhallImporter/1.0 (+https://paperhall.in)"}

# (category, gutendex topic, deficit)
FILL = [
    ("Fiction", "fiction", 41), ("Mystery", "detective", 25), ("Science", "science", 24),
    ("Sci-Fi", "science fiction", 18), ("Memoir", "biography", 12), ("Poetry", "poetry", 12),
    ("History", "history", 9), ("Philosophy", "philosophy", 8), ("Children", "children", 2),
    ("Essays", "essays", 1),
]


def norm_title(t):
    t = re.sub(r"[^a-z0-9 ]", " ", t.lower()); t = re.sub(r"\b(the|a|an|of|and|or|in|to)\b", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def wkey(title, author):
    a = (author or "").lower(); anon = any(x in a for x in ("anon", "unknown", "various", "traditional"))
    parts = re.sub(r"[^a-z ]", "", a).split(); surname = "" if anon or not parts else parts[-1]
    kws = tuple(sorted(w for w in re.sub(r"[^a-z0-9 ]", " ", title.lower()).split() if len(w) > 3 and w not in STOP)[:3])
    return (surname, kws)


def wc(html): return len(re.sub(r"&[a-z]+;", " ", TAG_RE.sub(" ", html)).split())
def is_en(b): return "en" in (b.get("languages") or [])


def gj(url):
    for _ in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45) as r:
                return json.load(r)
        except Exception:
            time.sleep(2.5)
    return None


def main():
    books = json.load(open(BOOKS))
    used_ids = {b["gutenbergId"] for b in books if b.get("gutenbergId")}
    used_slugs = {b["id"] for b in books}
    used_titles = {norm_title(b["title"]) for b in books}
    used_works = {wkey(b["title"], b["author"]) for b in books}
    start = len(books)

    for cat, topic, target in FILL:
        verse = cat in B.VERSE_CATEGORIES
        added = 0
        url = "https://gutendex.com/books/?" + urllib.parse.urlencode({"topic": topic, "languages": "en"})
        while url and added < target:
            d = gj(url)
            if not d:
                break
            for b in d.get("results", []):
                if added >= target:
                    break
                gid = b["id"]
                if gid in used_ids or not is_en(b):
                    continue
                rtitle = b["title"].split(" : ")[0].split(" — ")[0].strip()
                if BUNDLE_RE.search(rtitle.lower()):
                    continue
                author = B.clean_author(b["authors"][0]["name"]) if b.get("authors") else "Unknown"
                nt, wk = norm_title(rtitle), wkey(rtitle, author)
                if nt in used_titles or wk in used_works:
                    continue
                slug = B.slugify(rtitle, used_slugs)
                try:
                    raw = B.download(gid)
                    if not raw or "LINKED INDEX OF PROJECT GUTENBERG" in raw[:6000].upper():
                        continue
                    doc, _ = B.to_html(raw, slug, rtitle, author, verse_mode=verse)
                    doc, _, _ = cg.clean_html(doc)
                    if len(doc) < 2500:
                        continue
                    dd = os.path.join(PUB, slug); os.makedirs(dd, exist_ok=True)
                    open(os.path.join(dd, "content.html"), "w", encoding="utf-8").write(doc)
                except Exception:
                    continue
                used_ids.add(gid); used_slugs.add(slug); used_titles.add(nt); used_works.add(wk)
                books.append({
                    "id": slug, "title": rtitle, "author": author, "language": "en", "category": cat,
                    "subjectsCsv": ", ".join(b.get("subjects", [])[:6]), "summary": None, "coverUrl": None,
                    "contentPath": f"{slug}/content.html", "wordCount": wc(doc), "isFeatured": False,
                    "source": "gutenberg", "sourceId": str(gid), "gutenbergId": gid,
                })
                added += 1
                if len(books) % 5 == 0:
                    json.dump(books, open(BOOKS, "w"), ensure_ascii=False, indent=2)
                time.sleep(0.4)
            url = d.get("next")
        json.dump(books, open(BOOKS, "w"), ensure_ascii=False, indent=2)
        print(f"[fill {cat}] +{added}/{target} (catalogue {len(books)})", flush=True)

    json.dump(books, open(BOOKS, "w"), ensure_ascii=False, indent=2)
    print(f"DONE fill: catalogue {start} -> {len(books)} (+{len(books)-start})", flush=True)


if __name__ == "__main__":
    main()
