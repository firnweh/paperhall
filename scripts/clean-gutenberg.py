#!/usr/bin/env python3
"""
clean-gutenberg.py — strip residual Project Gutenberg branding/artifacts from the
stored book HTML, in place.

Removes whole blocks that are boilerplate (Project Gutenberg markers, license,
Distributed-Proofreading credits, "Produced by …" front matter, standalone
Transcriber's-Note boxes) and scrubs inline artifacts ([Illustration] markers,
"(Transcriber's note …)" asides, box-drawing) from kept blocks — while leaving
ordinary prose ("a shot produced by the artillery") untouched.

Usage:
  python3 scripts/clean-gutenberg.py                 # clean ./storage/books
  python3 scripts/clean-gutenberg.py <dir> [<dir>…]  # clean other book roots
"""
import os, re, sys

BLOCK_RE = re.compile(r"<(h2|p|pre)((?:\s[^>]*)?)>(.*?)</\1>", re.S | re.I)

DROP_RE = re.compile(
    r"project gutenberg|gutenberg\.org|gutenberg-?tm|gutenberg literary archive"
    r"|distributed proofread|www\.pgdp|online distributed proofreading"
    r"|this e-?book is for the use|\*\*\*\s*(start|end) of"
    r"|end of (the|this) project|updated editions will replace"
    r"|holder of the project|set forth in the general terms",
    re.I)
TRANS_RE = re.compile(r"transcriber['’]?s?\s*note", re.I)
ORNAMENT_RE = re.compile(r"^[\s|+_=*.\-—–~#]+$")
PRODUCED_RE = re.compile(r"^\s*produced by\b", re.I)
# Gutenberg bibliographic header fields that sometimes survive in the body
HEADER_RE = re.compile(
    r"^\s*(title|author|illustrator|editor|translator|release date|posting date"
    r"|last updated|most recently updated|language|credits|character set encoding"
    r"|first published|original publication|ebook no\.?|e-?text)\s*:", re.I)

ILLUS_RE = re.compile(r"\[\s*illustration[^\]]*\]", re.I)
TRANS_INLINE_RE = re.compile(r"\(\s*transcriber['’]?s?\s*note[^)]*\)", re.I)


def strip_tags(s: str) -> str:
    return re.sub(r"<[^>]+>", "", s)


def is_drop(text: str) -> bool:
    t = text.strip()
    if not t:
        return True
    if DROP_RE.search(t):
        return True
    if PRODUCED_RE.match(t) and len(t) < 240:
        return True
    if HEADER_RE.match(t) and len(t) < 160:
        return True
    if TRANS_RE.search(t):
        # standalone transcriber notes (short, boxed, or leading) — not inline footnotes
        if len(t) < 260 or re.search(r"[|]{1,}|\+[-]{3,}", t) or t.lower().lstrip("*").startswith("transcriber"):
            return True
    if ORNAMENT_RE.match(t):
        return True
    return False


def clean_inner(inner: str) -> str:
    inner = ILLUS_RE.sub("", inner)
    inner = TRANS_INLINE_RE.sub("", inner)
    inner = inner.replace("​", "")
    inner = re.sub(r"[ \t]{2,}", " ", inner)
    return inner.strip()


def clean_html(html: str):
    m = re.search(r"(<article[^>]*>)(.*)(</article>)", html, re.S | re.I)
    if not m:
        return html, 0, 0
    head, open_tag, body, close_tag = html[:m.start()], m.group(1), m.group(2), m.group(3)
    tail = html[m.end():]
    out, dropped, scrubbed = [], 0, 0
    for bm in BLOCK_RE.finditer(body):
        tag, attrs, inner = bm.group(1), bm.group(2), bm.group(3)
        if is_drop(strip_tags(inner)):
            dropped += 1
            continue
        cleaned = clean_inner(inner)
        if cleaned != inner.strip():
            scrubbed += 1
        if not strip_tags(cleaned).strip():
            dropped += 1
            continue
        out.append(f"<{tag}{attrs}>{cleaned}</{tag}>")
    return head + open_tag + "\n" + "\n".join(out) + "\n" + close_tag + tail, dropped, scrubbed


def main():
    roots = sys.argv[1:] or [os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "books")]
    total_files = total_drop = total_scrub = 0
    for root in roots:
        if not os.path.isdir(root):
            print(f"  ! not a dir: {root}"); continue
        for d in sorted(os.listdir(root)):
            f = os.path.join(root, d, "content.html")
            if not os.path.isfile(f):
                continue
            html = open(f, encoding="utf-8").read()
            new, drop, scrub = clean_html(html)
            if new != html:
                open(f, "w", encoding="utf-8").write(new)
                total_files += 1
                total_drop += drop
                total_scrub += scrub
        print(f"cleaned root: {root}")
    print(f"\nFiles changed: {total_files} | blocks dropped: {total_drop} | blocks scrubbed: {total_scrub}")


if __name__ == "__main__":
    main()
