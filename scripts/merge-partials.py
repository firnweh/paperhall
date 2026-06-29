#!/usr/bin/env python3
"""
merge-partials.py — fold data/_partials/*.json into data/books.json with global
dedup (by gutenbergId, then work identity, then slug), drop orphan content dirs,
and report integrity + category spread.
"""
import json, os, re, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BOOKS = os.path.join(ROOT, "data", "books.json")
PART = os.path.join(ROOT, "data", "_partials")
PUB = os.path.join(ROOT, "public", "books")

STOP = {"the","a","an","of","and","or","in","to","on","with","for","de","la","le",
        "vol","part","book","volume","complete","selected"}


def wkey(title, author):
    a = (author or "").lower()
    anon = any(x in a for x in ("anon", "unknown", "various", "traditional"))
    parts = re.sub(r"[^a-z ]", "", a).split()
    surname = "" if anon or not parts else parts[-1]
    kws = tuple(sorted(w for w in re.sub(r"[^a-z0-9 ]", " ", title.lower()).split()
                       if len(w) > 3 and w not in STOP)[:3])
    return (surname, kws)


def main():
    existing = json.load(open(BOOKS))
    seen_ids = {b["gutenbergId"] for b in existing if b.get("gutenbergId")}
    seen_slugs = {b["id"] for b in existing}
    seen_works = {wkey(b["title"], b["author"]) for b in existing}

    added, dup_id, dup_work, dup_slug = [], 0, 0, 0
    from collections import Counter
    per_cat = Counter()
    for pf in sorted(os.listdir(PART)):
        if not pf.endswith(".json"):
            continue
        for e in json.load(open(os.path.join(PART, pf))):
            gid, slug = e.get("gutenbergId"), e["id"]
            wk = wkey(e["title"], e["author"])
            if gid in seen_ids:
                dup_id += 1; continue
            if wk in seen_works:
                dup_work += 1; continue
            if slug in seen_slugs:
                dup_slug += 1; continue
            seen_ids.add(gid); seen_slugs.add(slug); seen_works.add(wk)
            added.append(e); per_cat[e["category"]] += 1

    merged = existing + added
    json.dump(merged, open(BOOKS, "w"), ensure_ascii=False, indent=2)

    # drop orphan content dirs (not referenced by the merged catalogue)
    referenced = {b["id"] for b in merged}
    orphans = 0
    for d in os.listdir(PUB):
        p = os.path.join(PUB, d)
        if os.path.isdir(p) and d not in referenced:
            shutil.rmtree(p); orphans += 1

    # integrity
    ids = [b["gutenbergId"] for b in merged]
    slugs = [b["id"] for b in merged]
    missing = [b["id"] for b in merged if not os.path.exists(os.path.join(PUB, b["id"], "content.html"))]

    print(f"Existing: {len(existing)} | new unique added: {len(added)} | total: {len(merged)}")
    print(f"Skipped dups — sameId: {dup_id}, sameWork: {dup_work}, sameSlug: {dup_slug}")
    print(f"Orphan dirs removed: {orphans}")
    print(f"dup gutenbergIds: {len(ids)-len(set(ids))} | dup slugs: {len(slugs)-len(set(slugs))} | missing content: {len(missing)}")
    print(f"New by category: {dict(per_cat)}")
    print(f"Full category spread: {dict(sorted(Counter(b['category'] for b in merged).items(), key=lambda x:-x[1]))}")


if __name__ == "__main__":
    main()
