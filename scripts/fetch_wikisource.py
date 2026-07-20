#!/usr/bin/env python3
"""fetch_wikisource.py — import public-domain Hindi classics from hi.wikisource.org.

Discovers an author's works from their लेखक: (author) page, resolves redirects,
assembles multi-subpage works (numbered chapters -> one book; titled story
collections -> one book per story), extracts clean verse-aware Devanagari text,
and writes content.html + a partial JSON entry per book.

Text on Hindi Wikisource is public-domain / CC-BY-SA. Only genuinely PD authors
should be passed (life+60 expired in India). Content HTML matches the reader:
in-flow <h2 id> = chapter (drawer + heading), <p class="verse"> w/ <br> = verse,
<p> = prose.

  python3 scripts/fetch_wikisource.py --author "प्रेमचंद" --author-en "Premchand" \
      --out data/_partials/hindi_premchand.json --exclude data/_existing.json --limit 40
"""
import argparse, json, os, re, sys, time, html, urllib.parse, urllib.request

API = "https://hi.wikisource.org/w/api.php"
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
PUB = os.path.join(ROOT, "public", "books")
UA = {"User-Agent": "PaperhallImporter/1.0 (+https://paperhall.in; PD library, educational)"}
TAG = re.compile(r"<[^>]+>")

# --- Devanagari -> ASCII (Hunterian-ish; used only to make clean URL slugs) ---
CONS = {'क':'k','ख':'kh','ग':'g','घ':'gh','ङ':'n','च':'ch','छ':'chh','ज':'j','झ':'jh','ञ':'n',
 'ट':'t','ठ':'th','ड':'d','ढ':'dh','ण':'n','त':'t','थ':'th','द':'d','ध':'dh','न':'n',
 'प':'p','फ':'ph','ब':'b','भ':'bh','म':'m','य':'y','र':'r','ल':'l','व':'v','श':'sh',
 'ष':'sh','स':'s','ह':'h','क़':'q','ख़':'kh','ग़':'g','ज़':'z','ड़':'r','ढ़':'rh','फ़':'f'}
MATRA = {'ा':'a','ि':'i','ी':'i','ु':'u','ू':'u','ृ':'ri','े':'e','ै':'ai','ो':'o','ौ':'au',
 'ं':'n','ँ':'n','ः':'h','ॉ':'o','ॅ':'e','़':''}
IVOW = {'अ':'a','आ':'aa','इ':'i','ई':'i','उ':'u','ऊ':'u','ऋ':'ri','ए':'e','ऐ':'ai','ओ':'o','औ':'au','ऑ':'o'}
DIG = {'०':'0','१':'1','२':'2','३':'3','४':'4','५':'5','६':'6','७':'7','८':'8','९':'9'}
HAL = '्'


def translit(s):
    out = []; i = 0; n = len(s)
    while i < n:
        c = s[i]
        if c in CONS:
            out.append(CONS[c]); nx = s[i + 1] if i + 1 < n else ''
            if nx == HAL: i += 2; continue
            if nx in MATRA: out.append(MATRA[nx]); i += 2; continue
            out.append('a'); i += 1; continue
        if c in IVOW: out.append(IVOW[c])
        elif c in MATRA: out.append(MATRA[c])
        elif c in DIG: out.append(DIG[c])
        elif c in ' -_/': out.append(' ')
        i += 1
    return ''.join(out)


def slugify(title, used):
    base = re.sub(r'[^a-z0-9]+', '-', translit(title).lower()).strip('-')
    base = '-'.join(base.split('-')[:6])[:42].strip('-') or 'hindi'
    s, k = base, 2
    while s in used:
        s = f"{base}-{k}"; k += 1
    used.add(s); return s


def api(params):
    url = API + '?' + urllib.parse.urlencode({**params, 'format': 'json'})
    for _ in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45) as r:
                return json.load(r)
        except Exception:
            time.sleep(2.0)
    return None


def resolve(title):
    d = api({'action': 'query', 'titles': title, 'redirects': 1})
    r = (d or {}).get('query', {}).get('redirects', [])
    return r[-1]['to'] if r else title


def author_links(author):
    """Links from the author's लेखक: page; fall back to a ns-100 search if the
    exact title doesn't resolve (name spelling/matra variants)."""
    d = api({'action': 'parse', 'page': f'लेखक:{author}', 'prop': 'links'})
    links = (d or {}).get('parse', {}).get('links', [])
    if links:
        return links
    s = api({'action': 'query', 'list': 'search', 'srsearch': author,
             'srnamespace': 100, 'srlimit': 1})
    hits = (s or {}).get('query', {}).get('search', [])
    if hits:
        d = api({'action': 'parse', 'page': hits[0]['title'], 'prop': 'links'})
        return (d or {}).get('parse', {}).get('links', [])
    return []


def author_works(author):
    """Top-level mainspace work titles linked from the author page."""
    links = author_links(author)
    works = []
    seen = set()
    for l in links:
        if l.get('ns') != 0:
            continue
        t = l.get('*', '')
        if not t or '/' in t or ':' in t or t in seen:
            continue
        seen.add(t); works.append(t)
    return works


def subpages(title):
    out, cont = [], None
    while True:
        p = {'action': 'query', 'list': 'allpages', 'apprefix': title + '/',
             'apnamespace': 0, 'aplimit': 300}
        if cont: p['apcontinue'] = cont
        d = api(p)
        if not d: break
        out += [x['title'] for x in d.get('query', {}).get('allpages', [])]
        cont = d.get('continue', {}).get('apcontinue')
        if not cont: break
    return out


def page_blocks(title):
    """Fetch a page, return ordered blocks: ('v', 'line\\nline') verse or ('p', text) prose."""
    d = api({'action': 'parse', 'page': title, 'prop': 'text', 'redirects': 1,
             'disablelimitreport': 1, 'disableeditsection': 1})
    h = (d or {}).get('parse', {}).get('text', {}).get('*', '')
    if not h:
        return []
    # drop any leaked redirect-page markup ("अनुप्रेषण का लक्ष्य")
    h = re.sub(r'(?s)<div class="redirectMsg">.*?</ul>', ' ', h)
    h = re.sub(r'(?s)<p>[^<]*अनुप्रेषण[^<]*</p>', ' ', h)
    h = re.sub(r'(?s)<table.*?</table>', ' ', h)
    h = re.sub(r'(?s)<style.*?</style>', ' ', h)
    h = re.sub(r'(?s)<div class="[^"]*(navigation|noprint|ws-noexport|dc_|header_notes)[^"]*".*?</div>', ' ', h)
    h = re.sub(r'(?s)<sup[^>]*reference[^>]*>.*?</sup>', ' ', h)
    blocks, order = [], []
    # verse: <div class="poem"> ... </div>
    def take_verse(seg):
        seg = re.sub(r'(?i)<br\s*/?>', '\n', seg)
        lines = [html.unescape(TAG.sub('', x)).replace('​', '').strip() for x in seg.split('\n')]
        lines = [x for x in lines if x]
        return lines
    poem_spans = []
    for m in re.finditer(r'(?s)<div class="poem">(.*?)</div>', h):
        lines = take_verse(m.group(1))
        if lines:
            poem_spans.append((m.start(), ('v', '\n'.join(lines))))
    h2 = re.sub(r'(?s)<div class="poem">.*?</div>', lambda _m: ' ' * (_m.end() - _m.start()), h)
    para_spans = []
    for m in re.finditer(r'(?s)<p>(.*?)</p>', h2):
        seg = m.group(1)
        if re.search(r'(?i)<br\s*/?>', seg):
            lines = take_verse(seg)
            if lines:
                para_spans.append((m.start(), ('v', '\n'.join(lines))))
        else:
            t = html.unescape(TAG.sub('', seg)).replace('​', '').strip()
            if t:
                para_spans.append((m.start(), ('p', t)))
    for pos, b in sorted(poem_spans + para_spans):
        blocks.append(b)
    return blocks


def dev_int(t):
    tn = ''.join(DIG.get(c, c) for c in t)
    m = re.search(r'\d+', tn)
    return int(m.group()) if m else None


# Structural-division words: a work split by these is ONE book (acts, cantos,
# kands, chapters, parts), NOT a story collection.
STRUCT = ('अंक', 'काण्ड', 'कांड', 'सर्ग', 'अध्याय', 'भाग', 'खण्ड', 'खंड', 'प्रकरण',
          'परिच्छेद', 'पर्व', 'उल्लास', 'तरंग', 'प्रस्ताव', 'दृश्य', 'सोपान', 'स्कन्ध',
          'पटल', 'कथानक', 'पात्र', 'प्रस्तावना', 'भूमिका', 'विषय', 'परिशिष्ट')


def ordered_subpages(canon):
    """Subpage titles in parent-page reading order; fall back to allpages/numeric."""
    allsubs = [s for s in subpages(canon) if s != canon]
    if not allsubs:
        return []
    prefix = canon + '/'
    d = api({'action': 'parse', 'page': canon, 'prop': 'text', 'disableeditsection': 1})
    h = (d or {}).get('parse', {}).get('text', {}).get('*', '')
    ordered, seen = [], set()
    for m in re.finditer(r'<a href="/wiki/([^"#?]+)"', h):
        t = urllib.parse.unquote(m.group(1)).replace('_', ' ')
        if t.startswith(prefix) and t in allsubs and t not in seen:
            seen.add(t); ordered.append(t)
    rest = [s for s in allsubs if s not in seen]
    rest.sort(key=lambda s: (dev_int(s[len(prefix):]) if dev_int(s[len(prefix):]) is not None else 9999, s))
    return ordered + rest


def get_books(work_title):
    """Return list of (display_title, [(heading_or_None, page_title), ...])."""
    canon = resolve(work_title)
    subs = ordered_subpages(canon)
    if not subs:
        return [(work_title, [(None, canon)])]
    prefix = canon + '/'
    tails = [s[len(prefix):] if s.startswith(prefix) else s for s in subs]
    numeric = sum(1 for t in tails if dev_int(t) is not None
                  and len(re.sub(r'[०-९\d\s.\-–]', '', t)) <= 2)
    structural = any(any(k in t for k in STRUCT) for t in tails)
    if structural or numeric >= max(2, len(subs) * 0.5):
        # acts / cantos / numbered chapters -> single book, in reading order
        chapters = [(t.strip(), s) for s, t in zip(subs, tails)]
        return [(work_title, chapters)]
    # independent titled parts -> one book per story (clean leading "१-" numbering)
    def clean_part(t):
        t = t.replace('⁠', '').replace('​', '').strip()
        return re.sub(r'^[०-९\d]+\s*[-–—.)]\s*', '', t).strip()
    return [(clean_part(t) or work_title, [(None, s)]) for s, t in zip(subs, tails)]


def build_html(slug, title, author, chapters):
    p = ['<!doctype html>', '<meta charset="utf-8" />',
         f'<title>{html.escape(title)} — {html.escape(author)}</title>',
         f'<article lang="hi" data-book-id="{slug}" data-title="{html.escape(title)}" '
         f'data-author="{html.escape(author)}">']
    words = 0; ci = 0; got = False
    multi = len(chapters) > 1
    for heading, page in chapters:
        blocks = page_blocks(page)
        time.sleep(0.3)
        if not blocks:
            continue
        head = heading if heading else None
        if multi and head:
            ci += 1
            p.append(f'<h2 id="ch-{ci}">{html.escape(head)}</h2>')
        for kind, text in blocks:
            if kind == 'v':
                lines = [html.escape(l) for l in text.split('\n')]
                p.append('<p class="verse">' + '<br>\n'.join(lines) + '</p>')
                words += sum(len(l.split()) for l in lines)
            else:
                p.append('<p>' + html.escape(text) + '</p>')
                words += len(text.split())
        got = True
    p.append('</article>')
    return ('\n'.join(p), words) if got else (None, 0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--author', required=True, help='Devanagari author name (लेखक: page)')
    ap.add_argument('--author-en', default='', help='romanized author name (for search)')
    ap.add_argument('--out', required=True)
    ap.add_argument('--exclude', required=True)
    ap.add_argument('--limit', type=int, default=40)
    ap.add_argument('--works', default='', help='optional ||-separated explicit work titles')
    a = ap.parse_args()

    ex = json.load(open(a.exclude))
    used_slugs = set(ex.get('slugs', []))
    added = []
    if os.path.exists(a.out):
        added = json.load(open(a.out))
        for e in added:
            used_slugs.add(e['id'])
    done_pages = {e.get('sourceId') for e in added}

    works = [w for w in a.works.split('||') if w] if a.works else author_works(a.author)
    print(f"[{a.author}] {len(works)} work roots", flush=True)

    for wt in works:
        if len(added) >= a.limit:
            break
        try:
            books = get_books(wt)
        except Exception as e:
            print(f"[{a.author}] ! {wt}: {e}", flush=True); continue
        for title, chapters in books:
            if len(added) >= a.limit:
                break
            src = chapters[0][1] if len(chapters) == 1 else wt
            if src in done_pages:
                continue
            slug = slugify(title, used_slugs)
            try:
                doc, wc = build_html(slug, title, a.author, chapters)
            except Exception as e:
                print(f"[{a.author}] ! {title}: {e}", flush=True); continue
            if not doc or wc < 60 or len(doc) < 400:
                continue
            dd = os.path.join(PUB, slug); os.makedirs(dd, exist_ok=True)
            open(os.path.join(dd, 'content.html'), 'w', encoding='utf-8').write(doc)
            done_pages.add(src)
            added.append({
                'id': slug, 'title': title, 'author': a.author, 'language': 'hi',
                'category': 'Hindi',
                'subjectsCsv': ', '.join(filter(None, [a.author_en, translit(title).strip(),
                                                        'Hindi literature'])),
                'summary': None, 'coverUrl': None, 'contentPath': f'{slug}/content.html',
                'wordCount': wc, 'isFeatured': False,
                'source': 'wikisource', 'sourceId': src, 'gutenbergId': None,
            })
            print(f"[{a.author}] + {title}  ({wc}w)", flush=True)
            if len(added) % 5 == 0:
                json.dump(added, open(a.out, 'w'), ensure_ascii=False, indent=2)

    json.dump(added, open(a.out, 'w'), ensure_ascii=False, indent=2)
    print(f"[{a.author}] DONE {len(added)}", flush=True)


if __name__ == '__main__':
    main()
