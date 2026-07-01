// @ts-nocheck
"use client";

/**
 * The reading desk — Paperhall's real-book reader.
 *
 * Content arrives as an <article> HTML string (loaded server-side). We parse it
 * into "atoms" (headings + paragraphs, verse-aware), paginate by measuring real
 * content against a page-sized box (splitting paragraphs at word boundaries so
 * text flows like print), and lay it out as a two-page book spread. Turning a
 * page runs a 3D page-curl animation that carries real content on the leaf.
 *
 * Features: page-flip, paper/sepia/night palettes, S/M/L type, serif toggle,
 * chapter TOC, multi-colour highlighting (saved per-book), shelf + reading
 * progress + recently-opened (shared with the rest of the site via localStorage).
 */

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  addRecentlyOpened, getProgress, setProgress,
  addToShelf, removeFromShelf, isOnShelf,
} from "@/lib/storage/shelf";

type Seg = { t: string; em: boolean; br?: boolean };
type Atom = { type: "h2" | "p"; id?: string; segs: Seg[]; text: string; verse?: boolean };
type Frag = { ai: number; start: number; end: number };
type Hl = { atomIndex: number; start: number; end: number; color: string | null };
type Book = { id: string; title: string; author: string; category: string; wordCount?: number };
type Toc = { id: string; label: string }[];

type Palette = "paper" | "sepia" | "night";
type Size = "s" | "m" | "l";

const PALETTES: Record<Palette, { bg: string; bg2: string; fg: string; accent: string; muted: string; edge: string; label: string }> = {
  paper: { bg: "#faf6ec", bg2: "#f1e9d6", fg: "#2b2419", accent: "#8a5a2b", muted: "#9a8f79", edge: "#e7dcc5", label: "Paper" },
  sepia: { bg: "#f3e4c8", bg2: "#ecd9b6", fg: "#3a2c17", accent: "#7c4a1e", muted: "#9c8155", edge: "#dcc59a", label: "Sepia" },
  night: { bg: "#1d1813", bg2: "#171310", fg: "#e7dccb", accent: "#e0a64e", muted: "#8c8473", edge: "#2a2118", label: "Night" },
};
const SIZES: Record<Size, number> = { s: 16.5, m: 18.5, l: 21 };
const HL_COLORS = [
  { key: "yellow", css: "#ffe27a" },
  { key: "green", css: "#aef0bd" },
  { key: "pink", css: "#ffc0d6" },
  { key: "blue", css: "#b6dcff" },
  { key: "purple", css: "#dcc2ff" },
];
const FLIP_MS = 720;
// Book text is served from object storage (Vercel Blob) in production; falls back
// to local /public/books in dev when the env var is unset.
const CONTENT_BASE = process.env.NEXT_PUBLIC_CONTENT_BASE || "";

/* ── text helpers ── */
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function segsFromNode(el: Element): Seg[] {
  const out: Seg[] = [];
  el.childNodes.forEach((n) => {
    if (n.nodeType === 3) out.push({ t: n.nodeValue || "", em: false });
    else if (n.nodeType === 1) {
      const e = n as Element;
      if (e.tagName === "BR") out.push({ t: "", em: false, br: true });
      else out.push({ t: e.textContent || "", em: true });
    }
  });
  return out;
}

function parseAtoms(html: string): Atom[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const art = doc.querySelector("article") || doc.body;
  const atoms: Atom[] = [];
  art.querySelectorAll(":scope > h2, :scope > p, :scope > pre").forEach((el) => {
    if (el.tagName === "H2") {
      if (el.classList.contains("toc-entry")) return;
      const segs = segsFromNode(el);
      atoms.push({ type: "h2", id: el.id || undefined, segs, text: segs.map((s) => s.t).join("") });
    } else {
      // <p> or legacy <pre class="verse">
      const verse = el.classList.contains("verse") || el.tagName === "PRE";
      let segs = segsFromNode(el);
      // a legacy <pre> keeps newlines as text — convert to <br> segments
      if (el.tagName === "PRE") {
        const lines = (el.textContent || "").split("\n");
        segs = [];
        lines.forEach((ln, i) => {
          if (i) segs.push({ t: "", em: false, br: true });
          segs.push({ t: ln, em: false });
        });
      }
      const text = segs.map((s) => s.t).join("");
      if (!text.trim()) return;
      atoms.push({ type: "p", segs, text, verse });
    }
  });
  return atoms;
}

function bakeSegs(segs: Seg[], hls: Hl[], rStart = 0, rEnd = Infinity): string {
  const len = segs.reduce((n, s) => n + s.t.length, 0);
  if (rEnd === Infinity) rEnd = len;
  const colors: (string | null)[] = new Array(len).fill(null);
  for (const h of hls) {
    const a = Math.max(0, h.start), b = Math.min(len, h.end);
    for (let i = a; i < b; i++) colors[i] = h.color;
  }
  let out = "", gi = 0;
  for (const seg of segs) {
    if (seg.br) { if (gi >= rStart && gi <= rEnd) out += "<br>"; continue; }
    const segEnd = gi + seg.t.length;
    if (segEnd <= rStart || gi >= rEnd) { gi = segEnd; continue; }
    const lo = Math.max(0, rStart - gi), hi = Math.min(seg.t.length, rEnd - gi);
    if (seg.em) out += "<em>";
    let j = lo;
    while (j < hi) {
      const c = colors[gi + j];
      let k = j; while (k < hi && colors[gi + k] === c) k++;
      const chunk = escapeHtml(seg.t.slice(j, k));
      out += c ? `<mark class="bk-hl" data-c="${c}">${chunk}</mark>` : chunk;
      j = k;
    }
    if (seg.em) out += "</em>";
    gi = segEnd;
  }
  return out;
}

function wordEnds(text: string, off: number): number[] {
  const ends: number[] = [];
  let i = off; const n = text.length;
  while (i < n) {
    while (i < n && /\s/.test(text[i])) i++;
    while (i < n && !/\s/.test(text[i])) i++;
    ends.push(i);
  }
  if (!ends.length || ends[ends.length - 1] !== n) ends.push(n);
  return ends;
}

function paginate(atoms: Atom[], m: HTMLElement, contentH: number): Frag[][] {
  const pages: Frag[][] = [];
  let ai = 0, off = 0, guard = 0;
  while (ai < atoms.length && guard++ < 30000) {
    m.innerHTML = "";
    const frags: Frag[] = [];
    while (ai < atoms.length) {
      const atom = atoms[ai];
      const el = document.createElement(atom.type === "h2" ? "h2" : "p");
      el.className = "bk-" + atom.type + (off > 0 ? " cont" : "") + (atom.verse ? " verse" : "");
      el.innerHTML = bakeSegs(atom.segs, [], off, atom.text.length) || "​";
      m.appendChild(el);
      if (m.scrollHeight <= contentH) {
        frags.push({ ai, start: off, end: atom.text.length });
        ai++; off = 0; continue;
      }
      if (frags.length === 0 && atom.type === "h2") {
        frags.push({ ai, start: off, end: atom.text.length }); ai++; off = 0; break;
      }
      const ends = wordEnds(atom.text, off);
      let lo = 0, hi = ends.length - 1, best = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        el.innerHTML = bakeSegs(atom.segs, [], off, ends[mid]) || "​";
        if (m.scrollHeight <= contentH) { best = mid; lo = mid + 1; } else hi = mid - 1;
      }
      if (best >= 0) {
        frags.push({ ai, start: off, end: ends[best] }); off = ends[best];
        if (off >= atom.text.length) { ai++; off = 0; }
      } else if (frags.length > 0) {
        m.removeChild(el);
      } else {
        const e0 = ends[0] ?? atom.text.length;
        frags.push({ ai, start: off, end: e0 }); off = e0;
        if (off >= atom.text.length) { ai++; off = 0; }
      }
      break;
    }
    if (frags.length) pages.push(frags);
  }
  return pages;
}

export function Reader({ book }: { book: Book }) {
  const [atoms, setAtoms] = useState<Atom[] | null>(null);
  const [err, setErr] = useState(false);

  const [palette, setPalette] = useState<Palette>("paper");
  const [size, setSize] = useState<Size>("m");
  const [serif, setSerif] = useState(true);
  const [tocOpen, setTocOpen] = useState(false);
  const [shelved, setShelved] = useState(false);

  const [dims, setDims] = useState({ spread: true, pageW: 440, pageH: 640, contentW: 380, contentH: 568 });
  const [pages, setPages] = useState<Frag[][]>([]);
  const [cursor, setCursor] = useState(0);
  const [flip, setFlip] = useState<{ dir: "next" | "prev" } | null>(null);
  const [rot, setRot] = useState(0);

  const [highlights, setHighlights] = useState<Hl[]>([]);
  const [sel, setSel] = useState<{ ranges: Hl[]; x: number; y: number } | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const leafRef = useRef<HTMLDivElement | null>(null);
  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const resumePct = useRef<number | null>(null);
  const didResume = useRef(false);

  const fontStack = serif
    ? "'Lora','Iowan Old Style','Times New Roman',Georgia,serif"
    : "'Inter','Helvetica Neue',Arial,sans-serif";
  const fontSize = SIZES[size];
  const pal = PALETTES[palette];

  /* fetch the book text (static CDN asset) + parse to atoms; shelf/resume state */
  useEffect(() => {
    let alive = true;
    setAtoms(null); setErr(false);
    fetch(`${CONTENT_BASE}/books/${book.id}/content.html`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((text) => {
        if (!alive) return;
        const m = text.match(/<article[\s\S]*<\/article>/);
        setAtoms(parseAtoms(m ? m[0] : text));
      })
      .catch(() => { if (alive) setErr(true); });
    addRecentlyOpened(book.id);
    setShelved(isOnShelf(book.id));
    resumePct.current = getProgress(book.id)?.percent ?? null;
    didResume.current = false;
    try {
      const raw = localStorage.getItem(`paperhall_hl_${book.id}`);
      setHighlights(raw ? JSON.parse(raw) : []);
    } catch { setHighlights([]); }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  useEffect(() => {
    if (!book.id) return;
    try { localStorage.setItem(`paperhall_hl_${book.id}`, JSON.stringify(highlights)); } catch {}
  }, [highlights, book.id]);

  /* responsive geometry (debounced) */
  useLayoutEffect(() => {
    let t: any;
    const compute = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const sw = stage.clientWidth, sh = stage.clientHeight;
      const spread = sw >= 820;
      const padX = 30, padY = 36;
      const pageH = Math.max(380, Math.min(740, sh - 28));
      let pageW = spread ? Math.min(470, Math.floor((sw - 48) / 2)) : Math.min(560, sw - 28);
      pageW = Math.max(260, pageW);
      setDims((d) => {
        const nd = { spread, pageW, pageH, contentW: pageW - 2 * padX, contentH: pageH - 2 * padY };
        return (d.spread === nd.spread && d.pageW === nd.pageW && d.pageH === nd.pageH) ? d : nd;
      });
    };
    const debounced = () => { clearTimeout(t); t = setTimeout(compute, 120); };
    compute();
    const ro = new ResizeObserver(debounced);
    if (stageRef.current) ro.observe(stageRef.current);
    window.addEventListener("resize", debounced);
    return () => { clearTimeout(t); ro.disconnect(); window.removeEventListener("resize", debounced); };
  }, [atoms]);

  /* paginate (measure-based, splits paragraphs) */
  useLayoutEffect(() => {
    if (!atoms || !measureRef.current || dims.contentW <= 0) return;
    const m = measureRef.current;
    m.style.width = dims.contentW + "px";
    m.style.fontSize = fontSize + "px";
    m.style.fontFamily = fontStack;
    const anchorAi = pages[cursor]?.[0]?.ai ?? 0;
    const out = paginate(atoms, m, dims.contentH);
    m.innerHTML = "";
    let nc: number;
    if (!didResume.current && resumePct.current != null && out.length) {
      nc = Math.min(out.length - 1, Math.max(0, Math.round((resumePct.current / 100) * out.length)));
      didResume.current = true;
    } else {
      nc = out.findIndex((pg) => pg.some((fr) => fr.ai === anchorAi));
      if (nc < 0) nc = 0;
    }
    if (dims.spread) nc -= nc % 2;
    setPages(out);
    setCursor(nc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atoms, dims.contentW, dims.contentH, dims.spread, fontSize, fontStack]);

  const total = pages.length;
  const step = dims.spread ? 2 : 1;
  const hlByAtom = useMemo(() => {
    const map = new Map<number, Hl[]>();
    for (const h of highlights) {
      if (!map.has(h.atomIndex)) map.set(h.atomIndex, []);
      map.get(h.atomIndex)!.push(h);
    }
    return map;
  }, [highlights]);

  const pageHTML = useCallback((idx: number): string => {
    if (idx < 0 || idx >= pages.length || !atoms) return "";
    return pages[idx].map((fr) => {
      const a = atoms[fr.ai];
      const cls = (fr.start > 0 ? " cont" : "") + (a.verse ? " verse" : "");
      return `<${a.type} class="bk-${a.type}${cls}" data-i="${fr.ai}" data-s="${fr.start}">${bakeSegs(a.segs, hlByAtom.get(fr.ai) || [], fr.start, fr.end)}</${a.type}>`;
    }).join("");
  }, [pages, atoms, hlByAtom]);

  /* persist reading progress as the page turns */
  useEffect(() => {
    if (!total) return;
    const pct = Math.round(Math.min(1, (cursor + step) / total) * 100);
    setProgress(book.id, { percent: pct, updatedAt: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, total]);

  const baseIdx = (side: "left" | "right" | "single"): number => {
    if (!dims.spread) {
      if (!flip) return cursor;
      return flip.dir === "next" ? cursor + 1 : cursor - 1;
    }
    if (!flip) return side === "left" ? cursor : cursor + 1;
    if (flip.dir === "next") return side === "left" ? cursor : cursor + 3;
    return side === "left" ? cursor - 2 : cursor + 1;
  };

  const turn = (dir: "next" | "prev") => {
    if (flip) return;
    if (dir === "next" && cursor + step >= total) return;
    if (dir === "prev" && cursor <= 0) return;
    setSel(null);
    setRot(0);
    setFlip({ dir });
  };
  useEffect(() => {
    if (!flip) return;
    if (leafRef.current) void leafRef.current.offsetWidth;
    const raf = requestAnimationFrame(() => setRot(1));
    const t = setTimeout(() => {
      setCursor((c) => (flip.dir === "next" ? c + step : Math.max(0, c - step)));
      setFlip(null);
      setRot(0);
    }, FLIP_MS + 60);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flip]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") turn("next");
      else if (e.key === "ArrowLeft") turn("prev");
      else if (e.key === "Escape") { setSel(null); setTocOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flip, cursor, total, step, dims.spread]);

  /* selection → highlight */
  const charOffset = (atomEl: Element, node: Node, offset: number): number => {
    const walker = document.createTreeWalker(atomEl, NodeFilter.SHOW_TEXT, null);
    let count = 0, cur: Node | null;
    while ((cur = walker.nextNode())) {
      if (cur === node) return count + offset;
      count += (cur.nodeValue || "").length;
    }
    return count;
  };
  const closestAtom = (node: Node | null): HTMLElement | null => {
    let el: any = node && node.nodeType === 3 ? node.parentElement : node;
    while (el && !(el.dataset && el.dataset.i !== undefined)) el = el.parentElement;
    return el && stageRef.current?.contains(el) ? el : null;
  };

  const captureSelection = () => {
    if (flip) return;
    const s = window.getSelection();
    if (!s || s.isCollapsed || s.rangeCount === 0) { setSel(null); return; }
    const range = s.getRangeAt(0);
    const sEl = closestAtom(range.startContainer), eEl = closestAtom(range.endContainer);
    if (!sEl || !eEl) { setSel(null); return; }
    let sIdx = +sEl.dataset.i!, sOff = (+sEl.dataset.s! || 0) + charOffset(sEl, range.startContainer, range.startOffset);
    let eIdx = +eEl.dataset.i!, eOff = (+eEl.dataset.s! || 0) + charOffset(eEl, range.endContainer, range.endOffset);
    if (sIdx > eIdx || (sIdx === eIdx && sOff > eOff)) { [sIdx, eIdx] = [eIdx, sIdx]; [sOff, eOff] = [eOff, sOff]; }
    const ranges: Hl[] = [];
    if (sIdx === eIdx) {
      if (eOff > sOff) ranges.push({ atomIndex: sIdx, start: sOff, end: eOff, color: null });
    } else {
      for (let k = sIdx; k <= eIdx; k++) {
        const len = atoms![k].text.length;
        const a = k === sIdx ? sOff : 0;
        const b = k === eIdx ? eOff : len;
        if (b > a) ranges.push({ atomIndex: k, start: a, end: b, color: null });
      }
    }
    if (!ranges.length) { setSel(null); return; }
    const r = range.getBoundingClientRect();
    setSel({ ranges, x: r.left + r.width / 2, y: r.top });
  };

  const applyColor = (color: string | null) => {
    if (!sel) return;
    setHighlights((prev) => {
      let next = prev;
      for (const r of sel.ranges) {
        next = next.filter((h) => !(h.atomIndex === r.atomIndex && h.start >= r.start && h.end <= r.end));
        next = [...next, { ...r, color }];
      }
      return next;
    });
    setSel(null);
    window.getSelection()?.removeAllRanges();
  };

  /* touch: swipe to turn pages (long-press to select still works) */
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchRef.current; touchRef.current = null;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) { captureSelection(); return; }
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y, dt = Date.now() - s.t;
    if (dt < 700 && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      turn(dx < 0 ? "next" : "prev");
    }
  };

  /* TOC (built from id'd headings) */
  const toc = useMemo(() => {
    if (!atoms) return [] as { i: number; label: string }[];
    return atoms.map((a, i) => ({ a, i })).filter((x) => x.a.type === "h2" && x.a.id)
      .map((x) => ({ i: x.i, label: x.a.text.trim() }));
  }, [atoms]);
  const jumpToAtom = (ai: number) => {
    let pg = pages.findIndex((p) => p.some((fr) => fr.ai === ai));
    if (pg < 0) return;
    if (dims.spread) pg -= pg % 2;
    setFlip(null); setRot(0); setCursor(pg); setTocOpen(false); setSel(null);
  };

  const toggleShelf = () => {
    if (shelved) { removeFromShelf(book.id); setShelved(false); }
    else { addToShelf(book.id); setShelved(true); }
  };

  const progress = total > 1 ? Math.min(1, (cursor + step) / total) : 1;
  const leafTransform = !flip ? "" : `rotateY(${rot ? (flip.dir === "next" ? -180 : 180) : 0}deg)`;
  const frontIdx = flip ? (dims.spread ? (flip.dir === "next" ? cursor + 1 : cursor) : cursor) : 0;
  const backIdx = flip ? (dims.spread ? (flip.dir === "next" ? cursor + 2 : cursor - 1) : (flip.dir === "next" ? cursor + 1 : cursor - 1)) : 0;

  return (
    <div className="bk-root" style={{
      ["--bg" as any]: pal.bg, ["--bg2" as any]: pal.bg2, ["--fg" as any]: pal.fg,
      ["--accent" as any]: pal.accent, ["--muted" as any]: pal.muted, ["--edge" as any]: pal.edge,
      ["--fs" as any]: fontSize + "px", ["--ff" as any]: fontStack,
    }}>
      <nav className="bk-top">
        <Link href="/" className="bk-brand">Paperhall</Link>
        <span className="bk-sep">›</span>
        <span className="bk-title">{book.title}</span>
        <span className="bk-author">{book.author}</span>
        <div className="bk-controls">
          <button onClick={toggleShelf} className={"bk-chip wide" + (shelved ? " on" : "")} title="Save to shelf">
            {shelved ? "★ Shelved" : "☆ Shelf"}
          </button>
          <div className="bk-chiprow">
            {(["paper", "sepia", "night"] as Palette[]).map((k) => (
              <button key={k} onClick={() => setPalette(k)} className={"bk-chip" + (palette === k ? " on" : "")} title={PALETTES[k].label}>
                <span className="bk-sw" style={{ background: PALETTES[k].bg, borderColor: PALETTES[k].accent }} />
              </button>
            ))}
          </div>
          <div className="bk-chiprow">
            {(["s", "m", "l"] as Size[]).map((k) => (
              <button key={k} onClick={() => setSize(k)} className={"bk-chip" + (size === k ? " on" : "")}>{k.toUpperCase()}</button>
            ))}
            <button onClick={() => setSerif((v) => !v)} className={"bk-chip" + (serif ? " on" : "")}>{serif ? "Serif" : "Sans"}</button>
          </div>
          <button onClick={() => setTocOpen(true)} className="bk-tocbtn" disabled={toc.length === 0}>≡ Chapters</button>
        </div>
      </nav>

      <div className="bk-progress"><div className="bk-progress-fill" style={{ width: `${progress * 100}%` }} /></div>

      <div className="bk-stage" ref={stageRef} onMouseUp={captureSelection} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {atoms && pages.length > 0 ? (
          <div className={"bk-book" + (dims.spread ? " spread" : " single")}
               style={{ width: dims.spread ? dims.pageW * 2 : dims.pageW, height: dims.pageH }}>
            {dims.spread ? (
              <>
                <div className="bk-page bk-left" style={{ width: dims.pageW, height: dims.pageH }}>
                  <div className="bk-content" dangerouslySetInnerHTML={{ __html: pageHTML(baseIdx("left")) }} />
                  <div className="bk-folio">{baseIdx("left") + 1}</div>
                </div>
                <div className="bk-page bk-right" style={{ width: dims.pageW, height: dims.pageH }}>
                  <div className="bk-content" dangerouslySetInnerHTML={{ __html: pageHTML(baseIdx("right")) }} />
                  <div className="bk-folio">{baseIdx("right") + 1}</div>
                </div>
                <div className="bk-spine" />
              </>
            ) : (
              <div className="bk-page bk-single" style={{ width: dims.pageW, height: dims.pageH }}>
                <div className="bk-content" dangerouslySetInnerHTML={{ __html: pageHTML(baseIdx("single")) }} />
                <div className="bk-folio">{baseIdx("single") + 1}</div>
              </div>
            )}

            {flip && (
              <div ref={leafRef} className={"bk-leaf " + flip.dir + (dims.spread ? " spread" : " single")}
                   style={{ width: dims.pageW, height: dims.pageH, transform: leafTransform, transition: rot ? `transform ${FLIP_MS}ms cubic-bezier(.4,.16,.2,1)` : "none" }}>
                <div className="bk-face bk-front" style={{ width: dims.pageW, height: dims.pageH }}>
                  <div className="bk-content" dangerouslySetInnerHTML={{ __html: pageHTML(frontIdx) }} />
                  <div className="bk-curl" />
                </div>
                <div className="bk-face bk-back" style={{ width: dims.pageW, height: dims.pageH }}>
                  <div className="bk-content" dangerouslySetInnerHTML={{ __html: pageHTML(backIdx) }} />
                  <div className="bk-curl back" />
                </div>
              </div>
            )}

            <button className="bk-nav prev" onClick={() => turn("prev")} disabled={cursor <= 0 || !!flip} aria-label="Previous page">‹</button>
            <button className="bk-nav next" onClick={() => turn("next")} disabled={cursor + step >= total || !!flip} aria-label="Next page">›</button>
          </div>
        ) : err ? (
          <div className="bk-loading">Couldn’t open this book. <Link href="/" style={{ color: "var(--accent)" }}>← Library</Link></div>
        ) : (
          <div className="bk-loading">Opening the book…</div>
        )}

        {sel && (
          <div className="bk-hltool" style={{ left: sel.x, top: sel.y }} onMouseDown={(e) => e.preventDefault()}>
            {HL_COLORS.map((c) => (
              <button key={c.key} className="bk-hlswatch" style={{ background: c.css }} onClick={() => applyColor(c.key)} aria-label={`Highlight ${c.key}`} />
            ))}
            <button className="bk-hlerase" onClick={() => applyColor(null)} title="Remove highlight">⌫</button>
          </div>
        )}
      </div>

      <div ref={measureRef} className="bk-measure bk-content" aria-hidden />

      {tocOpen && (
        <div className="bk-tocbg" onClick={() => setTocOpen(false)}>
          <aside className="bk-toc" onClick={(e) => e.stopPropagation()}>
            <div className="bk-toc-head"><span>Chapters</span><button onClick={() => setTocOpen(false)}>✕</button></div>
            <div className="bk-toc-list">
              {toc.map((t) => (<button key={t.i} className="bk-toc-item" onClick={() => jumpToAtom(t.i)}>{t.label}</button>))}
              {toc.length === 0 && <div className="bk-toc-empty">No chapters detected.</div>}
            </div>
          </aside>
        </div>
      )}

      <Styles />
    </div>
  );
}

function Styles() {
  return (
    <style jsx global>{`
      .bk-root { min-height: 100vh; height: 100vh; display: flex; flex-direction: column; background: #161310; color: #e8dfd1; font-family: 'Inter', sans-serif; }
      .bk-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 18px; min-height: 54px;
        background: rgba(18,15,12,.97); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(140,90,40,.35); position: sticky; top: 0; z-index: 30; }
      .bk-brand { color: #fff; text-decoration: none; font-family: 'Orbitron', monospace; font-weight: 900; font-size: 15px; letter-spacing: .5px; }
      .bk-brand:hover { color: #e0a64e; }
      .bk-sep { color: #5a4f44; }
      .bk-title { color: #e0a64e; font-size: 14px; font-weight: 800; max-width: 230px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .bk-author { color: #8c8473; font-size: 12px; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
      .bk-controls { margin-left: auto; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .bk-chiprow { display: flex; gap: 3px; padding: 2px; background: rgba(255,255,255,.05); border-radius: 999px; border: 1px solid rgba(255,255,255,.1); }
      .bk-chip { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 999px; border: none; cursor: pointer; background: transparent; color: #cbbfa9; font-size: 11px; font-weight: 700; }
      .bk-chip.wide { padding: 6px 12px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); }
      .bk-chip:hover { color: #fff; }
      .bk-chip.on { background: #e0a64e; color: #1a1410; }
      .bk-sw { width: 14px; height: 14px; border-radius: 50%; border: 1px solid; display: inline-block; }
      .bk-tocbtn { padding: 6px 12px; border-radius: 9px; cursor: pointer; background: rgba(224,166,78,.15); border: 1px solid rgba(224,166,78,.4); color: #e0a64e; font-size: 12px; font-weight: 800; }
      .bk-tocbtn:disabled { opacity: .4; cursor: not-allowed; }
      .bk-tocbtn:not(:disabled):hover { background: rgba(224,166,78,.25); }

      .bk-progress { height: 3px; background: rgba(255,255,255,.05); position: sticky; top: 54px; z-index: 25; }
      .bk-progress-fill { height: 100%; background: linear-gradient(90deg,#8a5a2b,#e0a64e); transition: width .3s; }

      .bk-stage { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 14px; perspective: 2600px; position: relative;
        background: radial-gradient(ellipse at 50% 0%, rgba(140,90,40,.16) 0%, transparent 60%),
          radial-gradient(ellipse at 50% 120%, rgba(224,166,78,.08) 0%, transparent 55%),
          linear-gradient(180deg,#1a1612 0%,#13100d 100%); }

      .bk-book { position: relative; transform-style: preserve-3d; display: flex; filter: drop-shadow(0 30px 60px rgba(0,0,0,.55)); }
      .bk-book.spread::before, .bk-book.spread::after { content: ""; position: absolute; top: 6px; bottom: 6px; width: 7px; z-index: 0; }
      .bk-book.spread::before { left: -7px; background: linear-gradient(90deg, rgba(0,0,0,.4), var(--edge)); border-radius: 3px 0 0 3px; box-shadow: -2px 0 6px rgba(0,0,0,.4); }
      .bk-book.spread::after { right: -7px; background: linear-gradient(270deg, rgba(0,0,0,.4), var(--edge)); border-radius: 0 3px 3px 0; box-shadow: 2px 0 6px rgba(0,0,0,.4); }

      .bk-page { position: relative; background: var(--bg); overflow: hidden; }
      .bk-page.bk-left { border-radius: 4px 0 0 4px; background: linear-gradient(90deg, var(--bg2) 0%, var(--bg) 14%); box-shadow: inset -22px 0 34px -26px rgba(0,0,0,.5); }
      .bk-page.bk-right { border-radius: 0 4px 4px 0; background: linear-gradient(270deg, var(--bg2) 0%, var(--bg) 14%); box-shadow: inset 22px 0 34px -26px rgba(0,0,0,.5); }
      .bk-page.bk-single { border-radius: 5px; background: var(--bg); box-shadow: inset 0 0 40px -30px rgba(0,0,0,.5); }
      .bk-spine { position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; transform: translateX(-1px); z-index: 3; pointer-events: none;
        background: linear-gradient(90deg, rgba(0,0,0,.28), rgba(0,0,0,.06) 40%, rgba(0,0,0,.06) 60%, rgba(0,0,0,.28)); }

      .bk-content { position: absolute; inset: 0; padding: 36px 30px; color: var(--fg); font-size: var(--fs); font-family: var(--ff); line-height: 1.72; overflow: hidden; }
      .bk-content .bk-p { margin: 0 0 .25em; text-indent: 1.3em; text-align: justify; hyphens: auto; -webkit-hyphens: auto; }
      .bk-content .bk-p.cont { text-indent: 0; }
      .bk-content .bk-p.verse { text-indent: 0; text-align: left; hyphens: none; -webkit-hyphens: none; margin: 0 0 1.1em; padding-left: 1.1em; line-height: 1.5; }
      .bk-content .bk-p.verse.cont { margin-top: 0; }
      .bk-content .bk-h2 { font-size: 1.18em; font-weight: 700; line-height: 1.3; margin: .2em 0 .7em; font-family: 'Lora',Georgia,serif; color: var(--fg); }
      .bk-content .bk-h2 + .bk-p { text-indent: 0; }
      .bk-content em { font-style: italic; color: var(--accent); }
      .bk-content .bk-hl { color: #241c0f; border-radius: 2px; padding: 0 1px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
      .bk-hl[data-c="yellow"] { background: #ffe27a; } .bk-hl[data-c="green"] { background: #aef0bd; }
      .bk-hl[data-c="pink"] { background: #ffc0d6; } .bk-hl[data-c="blue"] { background: #b6dcff; }
      .bk-hl[data-c="purple"] { background: #dcc2ff; }
      .bk-folio { position: absolute; bottom: 12px; left: 0; right: 0; text-align: center; font-size: 11px; color: var(--muted); font-family: var(--ff); pointer-events: none; }

      .bk-leaf { position: absolute; top: 0; z-index: 5; transform-style: preserve-3d; will-change: transform; }
      .bk-leaf.spread.next { left: 50%; transform-origin: left center; }
      .bk-leaf.spread.prev { right: 50%; transform-origin: right center; }
      .bk-leaf.single.next, .bk-leaf.single.prev { left: 0; transform-origin: left center; }
      .bk-face { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; overflow: hidden; background: var(--bg); }
      .bk-face.bk-front { border-radius: 0 4px 4px 0; box-shadow: inset 22px 0 34px -26px rgba(0,0,0,.5); }
      .bk-face.bk-back { transform: rotateY(180deg); border-radius: 4px 0 0 4px; box-shadow: inset -22px 0 34px -26px rgba(0,0,0,.5); }
      .bk-curl { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(90deg, rgba(0,0,0,.16) 0%, rgba(0,0,0,0) 22%, rgba(255,255,255,.05) 88%, rgba(0,0,0,.14) 100%); }
      .bk-curl.back { background: linear-gradient(270deg, rgba(0,0,0,.16) 0%, rgba(0,0,0,0) 22%, rgba(255,255,255,.05) 88%, rgba(0,0,0,.14) 100%); }

      .bk-nav { position: absolute; top: 50%; transform: translateY(-50%); z-index: 8; width: 40px; height: 64px; border: none; cursor: pointer;
        background: transparent; color: var(--accent); font-size: 34px; line-height: 1; opacity: .5; transition: opacity .15s; }
      .bk-nav:hover:not(:disabled) { opacity: 1; }
      .bk-nav:disabled { opacity: 0; cursor: default; }
      .bk-nav.prev { left: -46px; } .bk-nav.next { right: -46px; }
      .bk-loading { color: #b8a890; font-style: italic; }

      .bk-hltool { position: fixed; z-index: 60; transform: translate(-50%, calc(-100% - 10px)); display: flex; align-items: center; gap: 6px;
        padding: 6px 8px; border-radius: 999px; background: #221b14; border: 1px solid rgba(224,166,78,.45); box-shadow: 0 10px 30px rgba(0,0,0,.5); }
      .bk-hltool::after { content: ""; position: absolute; left: 50%; bottom: -6px; transform: translateX(-50%) rotate(45deg); width: 10px; height: 10px; background: #221b14; border-right: 1px solid rgba(224,166,78,.45); border-bottom: 1px solid rgba(224,166,78,.45); }
      .bk-hlswatch { width: 22px; height: 22px; border-radius: 50%; border: 2px solid rgba(255,255,255,.25); cursor: pointer; padding: 0; }
      .bk-hlswatch:hover { transform: scale(1.12); border-color: #fff; }
      .bk-hlerase { width: 24px; height: 24px; border-radius: 50%; border: 1px solid rgba(255,255,255,.2); background: #3a2e22; color: #e8dfd1; cursor: pointer; font-size: 12px; }
      .bk-hlerase:hover { background: #4a3a2a; }

      .bk-measure { position: fixed !important; left: -99999px !important; top: 0; visibility: hidden; padding: 0 !important; inset: auto; height: auto !important; overflow: visible !important; }

      .bk-tocbg { position: fixed; inset: 0; z-index: 70; background: rgba(6,5,4,.66); backdrop-filter: blur(7px); display: flex; justify-content: flex-end; }
      .bk-toc { width: min(360px,100%); height: 100%; background: #1b1611; border-left: 1px solid rgba(140,90,40,.4); padding: 18px; overflow-y: auto; animation: bkToc .24s cubic-bezier(.34,1.2,.32,1) both; }
      @keyframes bkToc { from { transform: translateX(28px); opacity: 0; } to { transform: none; opacity: 1; } }
      .bk-toc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .bk-toc-head span { font-family: 'Orbitron', monospace; font-size: 14px; font-weight: 900; color: #e0a64e; letter-spacing: 1px; text-transform: uppercase; }
      .bk-toc-head button { background: none; border: none; color: #b8a890; cursor: pointer; font-size: 15px; }
      .bk-toc-list { display: flex; flex-direction: column; gap: 2px; }
      .bk-toc-item { text-align: left; padding: 9px 11px; background: none; border: none; cursor: pointer; color: #cbbfa9; font-size: 13px; border-radius: 8px; line-height: 1.35; }
      .bk-toc-item:hover { background: rgba(224,166,78,.12); color: #fff; }
      .bk-toc-empty { font-size: 12px; color: #7d756a; padding: 10px; font-style: italic; }

      /* ── Mobile: single page, compact bar, swipe + edge taps ── */
      @media (max-width: 760px) {
        .bk-top { gap: 6px; padding: 8px 12px; min-height: 0; }
        .bk-author { display: none; }
        .bk-title { max-width: 46vw; font-size: 13px; }
        .bk-controls { order: 3; width: 100%; margin-left: 0; margin-top: 6px; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; padding-bottom: 1px; }
        .bk-controls::-webkit-scrollbar { display: none; }
        .bk-chip { padding: 6px 9px; }
        .bk-chip.wide { white-space: nowrap; }
        .bk-tocbtn { white-space: nowrap; }
        .bk-progress { top: 0; }
        .bk-stage { padding: 8px; }
        /* page-turn taps live on the dark margins; swipe works anywhere */
        .bk-nav { width: 30px; height: 56px; left: auto; right: auto; opacity: .55;
          background: rgba(20,16,12,.45); border-radius: 8px; backdrop-filter: blur(3px); }
        .bk-nav.prev { left: 4px; } .bk-nav.next { right: 4px; }
        .bk-hltool { transform: translate(-50%, calc(-100% - 10px)) scale(1.1); }
      }
      @media (max-width: 380px) {
        .bk-brand { font-size: 13px; }
        .bk-title { max-width: 40vw; }
      }
    `}</style>
  );
}
