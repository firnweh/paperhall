#!/usr/bin/env python3
"""
add-books.py — import popular public-domain books for ONE category from Gutendex.

Resolves books for a category topic (sorted by popularity), downloads + converts
(verse-aware) + strips Gutenberg branding, writes content to public/books/<slug>/,
and appends enriched entries to a per-category partial JSON file. Deduplicates
against an exclude snapshot (the existing catalogue) and its own progress.

Resumable (re-run continues the same partial). Designed to be run by several
parallel agents at once — each owns distinct categories + partial files, so there
is no write contention; a separate merge step folds the partials into books.json.

  python3 scripts/add-books.py --category Poetry --topic poetry --target 35 \
      --out data/_partials/poetry.json --exclude data/_existing.json
"""
import argparse, json, os, re, sys, time, urllib.parse, urllib.request, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PUB = os.path.join(ROOT, "public", "books")
sys.path.insert(0, HERE)
import build_paperhall_books as B  # noqa: E402
_spec = importlib.util.spec_from_file_location("cg", os.path.join(HERE, "clean-gutenberg.py"))
cg = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(cg)  # noqa: E402

STOP = {"the","a","an","of","and","or","in","to","on","with","for","de","la","le",
        "vol","part","book","volume","complete","selected"}
TAG_RE = re.compile(r"<[^>]+>")
BUNDLE_RE = re.compile(r"index of|complete works|collected works|^works of", re.I)
UA = {"User-Agent": "PaperhallImporter/1.0 (+https://paperhall.in)"}


def norm_title(t):
    t = re.sub(r"[^a-z0-9 ]", " ", t.lower())
    t = re.sub(r"\b(the|a|an|of|and|or|in|to)\b", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def wkey(title, author):
    a = (author or "").lower()
    anon = any(x in a for x in ("anon", "unknown", "various", "traditional"))
    parts = re.sub(r"[^a-z ]", "", a).split()
    surname = "" if anon or not parts else parts[-1]
    kws = tuple(sorted(w for w in re.sub(r"[^a-z0-9 ]", " ", title.lower()).split()
                       if len(w) > 3 and w not in STOP)[:3])
    return (surname, kws)


def word_count(html):
    return len(re.sub(r"&[a-z]+;", " ", TAG_RE.sub(" ", html)).split())


def is_en(b):
    return "en" in (b.get("languages") or [])


def gj(url):
    for _ in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45) as r:
                return json.load(r)
        except Exception:
            time.sleep(2.5)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--category", required=True)
    ap.add_argument("--topic", required=True)
    ap.add_argument("--target", type=int, required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--exclude", required=True)
    a = ap.parse_args()

    ex = json.load(open(a.exclude))
    used_ids = set(ex["ids"]); used_titles = set(ex["titles"]); used_slugs = set(ex["slugs"])
    used_works = set((s, tuple(k)) for s, k in ex["works"])

    added = []
    if os.path.exists(a.out):
        added = json.load(open(a.out))
        for e in added:
            used_ids.add(e["gutenbergId"]); used_slugs.add(e["id"])
            used_titles.add(norm_title(e["title"])); used_works.add(wkey(e["title"], e["author"]))

    verse = a.category in B.VERSE_CATEGORIES
    url = "https://gutendex.com/books/?" + urllib.parse.urlencode({"topic": a.topic, "languages": "en"})
    while url and len(added) < a.target:
        d = gj(url)
        if not d:
            break
        for b in d.get("results", []):
            if len(added) >= a.target:
                break
            gid = b["id"]
            if gid in used_ids or not is_en(b):
                continue
            rtitle = b["title"].split(" : ")[0].split(" — ")[0].strip()
            if BUNDLE_RE.search(rtitle.lower()):
                continue
            author = B.clean_author(b["authors"][0]["name"]) if b.get("authors") else "Unknown"
            nt = norm_title(rtitle); wk = wkey(rtitle, author)
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
            added.append({
                "id": slug, "title": rtitle, "author": author, "language": "en",
                "category": a.category, "subjectsCsv": ", ".join(b.get("subjects", [])[:6]),
                "summary": None, "coverUrl": None, "contentPath": f"{slug}/content.html",
                "wordCount": word_count(doc), "isFeatured": False,
                "source": "gutenberg", "sourceId": str(gid), "gutenbergId": gid,
            })
            if len(added) % 5 == 0:
                json.dump(added, open(a.out, "w"), ensure_ascii=False, indent=2)
                print(f"[{a.category}] {len(added)}/{a.target}", flush=True)
            time.sleep(0.5)
        url = d.get("next")

    json.dump(added, open(a.out, "w"), ensure_ascii=False, indent=2)
    print(f"[{a.category}] DONE {len(added)}/{a.target}", flush=True)


if __name__ == "__main__":
    main()
