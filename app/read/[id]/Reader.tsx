"use client";

/**
 * The reading desk. This is the emotional centre of Paperhall.
 *
 *   • opens with a gentle "open-book" fade
 *   • shows a printed title page, then the prose
 *   • sticky, quiet toolbar — themes, font size, line height, TOC, bookmark
 *   • scroll position persists as reading progress in localStorage
 *   • three themes: paper / sepia / night  (body[data-theme])
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  addRecentlyOpened, getProgress, setProgress,
  addToShelf, removeFromShelf, isOnShelf,
} from "@/lib/storage/shelf";

type Book = { id: string; title: string; author: string; category: string; wordCount: number };
type Toc  = { id: string; label: string }[];
type Theme = "paper" | "sepia" | "night";

const THEME_LABEL: Record<Theme, string> = { paper: "Paper", sepia: "Sepia", night: "Night" };

export function Reader({ book, html, toc }: { book: Book; html: string; toc: Toc }) {
  const [theme, setTheme]     = useState<Theme>("paper");
  const [fontSize, setFS]     = useState(18);            // px
  const [lineHeight, setLH]   = useState(1.85);
  const [showToc, setShowToc] = useState(false);
  const [showBar, setShowBar] = useState(true);
  const [onShelf, setOnShelf] = useState(false);
  const [distraction, setDistraction] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const articleRef = useRef<HTMLDivElement>(null);
  const lastSave = useRef(0);

  // Apply theme on <body>. Cleanup when we leave the reader.
  useEffect(() => {
    document.body.dataset.theme = theme;
    return () => { delete document.body.dataset.theme; };
  }, [theme]);

  // Restore saved preferences + progress + track in recents.
  useEffect(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem("paperhall:reader-prefs") ?? "null");
      if (prefs) {
        if (prefs.theme)      setTheme(prefs.theme);
        if (prefs.fontSize)   setFS(prefs.fontSize);
        if (prefs.lineHeight) setLH(prefs.lineHeight);
      }
    } catch {}
    setOnShelf(isOnShelf(book.id));
    addRecentlyOpened(book.id);

    const saved = getProgress(book.id);
    if (saved?.lastLocation) {
      setTimeout(() => {
        const el = document.getElementById(saved.lastLocation!);
        if (el) el.scrollIntoView({ behavior: "instant" as any, block: "start" });
      }, 80);
    } else if (saved?.percent) {
      const scrollTo = (document.documentElement.scrollHeight - window.innerHeight) * (saved.percent / 100);
      window.scrollTo({ top: scrollTo, behavior: "instant" as any });
    }
  }, [book.id]);

  // Persist prefs
  useEffect(() => {
    try {
      localStorage.setItem("paperhall:reader-prefs", JSON.stringify({ theme, fontSize, lineHeight }));
    } catch {}
  }, [theme, fontSize, lineHeight]);

  // Track scroll → progress + toolbar auto-hide.
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const pct = Math.max(0, Math.min(100, (window.scrollY / Math.max(1, docH)) * 100));
      setProgressPct(pct);
      // Save at most every 1.5s
      const now = Date.now();
      if (now - lastSave.current > 1500) {
        setProgress(book.id, { percent: pct, updatedAt: now });
        lastSave.current = now;
      }
      // Auto-hide bar when scrolling down, show when scrolling up
      const dy = window.scrollY - lastY;
      if (Math.abs(dy) > 5) setShowBar(dy < 0 || window.scrollY < 80);
      lastY = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [book.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "Escape" && distraction) setDistraction(false);
      if (e.key === "t") setShowToc((v) => !v);
      if (e.key === "f") setDistraction((v) => !v);
      if (e.key === "1") setTheme("paper");
      if (e.key === "2") setTheme("sepia");
      if (e.key === "3") setTheme("night");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [distraction]);

  const toggleShelf = () => {
    if (onShelf) { removeFromShelf(book.id); setOnShelf(false); }
    else         { addToShelf(book.id);      setOnShelf(true); }
  };

  const estRead = Math.max(1, Math.round(book.wordCount / 220));
  const timeLeft = Math.max(0, Math.round(estRead * (1 - progressPct / 100)));

  return (
    <div className="reading-desk-bg relative min-h-screen">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        {theme === "night" ? (
          <div className="absolute inset-0 bg-night-hall" />
        ) : (
          <div className="absolute inset-0 bg-reading-desk" />
        )}
      </div>

      {/* Toolbar — quiet, sticky, auto-hiding */}
      {!distraction && (
        <ReaderToolbar
          book={book} theme={theme} setTheme={setTheme}
          fontSize={fontSize} setFS={setFS}
          lineHeight={lineHeight} setLH={setLH}
          showBar={showBar} onToggleToc={() => setShowToc(true)}
          onShelf={onShelf} onToggleShelf={toggleShelf}
          onFocus={() => setDistraction(true)}
          progress={progressPct} timeLeft={timeLeft}
        />
      )}
      {distraction && (
        <button onClick={() => setDistraction(false)}
                className="fixed right-6 top-6 z-40 rounded-full border border-paper-300/40 bg-black/30 px-4 py-2 text-xs tracking-widest text-paper-50 backdrop-blur hover:bg-black/50">
          EXIT FOCUS MODE
        </button>
      )}

      {/* Table of contents panel */}
      {showToc && (
        <div className="fixed inset-0 z-40 flex" onClick={() => setShowToc(false)}>
          <div className="flex-1 bg-black/40 backdrop-blur-sm" />
          <aside className="w-80 overflow-auto border-l border-paper-300 bg-paper-50 p-6 text-ink-400 shadow-2xl"
                 onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-ink-100">Contents</div>
                <div className="mt-1 font-display text-lg">{book.title}</div>
              </div>
              <button onClick={() => setShowToc(false)} className="text-lg">✕</button>
            </div>
            {toc.length === 0 ? (
              <p className="text-sm italic text-ink-100">This book has no chapter markers — scroll through the running text.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {toc.map((t) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`} onClick={() => setShowToc(false)} className="block rounded px-2 py-1.5 font-serif text-ink-300 hover:bg-paper-200">
                      {t.label}
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </div>
      )}

      {/* Main reading surface */}
      <article
        ref={articleRef}
        className="reader-surface relative mx-auto mt-16 mb-20 max-w-reader px-5 pt-12 sm:px-10 sm:pt-20"
        style={{
          // Vertical writing surface with a soft page edge.
          background: theme === "paper" ? "linear-gradient(180deg, rgba(255,255,255,0.6), rgba(246,238,218,0.9))"
                  : theme === "sepia" ? "linear-gradient(180deg, rgba(249,236,201,0.65), rgba(232,214,170,0.9))"
                  : "linear-gradient(180deg, rgba(26,19,12,0.7), rgba(20,16,11,0.95))",
          boxShadow: "0 30px 80px -40px rgba(40,25,12,0.6), 0 12px 20px -14px rgba(40,25,12,0.45)",
          borderRadius: "2px",
        }}
      >
        {/* Title page */}
        <header className="mb-20 border-b border-current/15 pb-10 text-center">
          <div className="text-[10px] uppercase tracking-[0.35em] opacity-70">Paperhall Edition · {book.category}</div>
          <h1 className="mt-6 font-display text-[clamp(34px,6vw,54px)] leading-tight" style={{ fontStyle: "italic" }}>
            {book.title}
          </h1>
          <div className="mt-4 font-serif text-base italic opacity-80">by {book.author}</div>
          <div className="mt-10 text-[11px] tracking-[0.25em] opacity-60">
            ≈ {estRead} MIN READ · {(book.wordCount / 1000).toFixed(1)}K WORDS
          </div>
          <div className="mt-12 text-[32px] opacity-30">· · ·</div>
        </header>

        {/* The book itself */}
        <div
          className="paperhall-prose"
          style={{
            // Drive prose via CSS vars so the toolbar can adjust them live.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            "--reader-font-size": `${fontSize}px`,
            "--reader-line-height": String(lineHeight),
          } as any}
          // Content comes from our own formatter; safe because we sanitise
          // and escape during ingestion.
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* End ornament */}
        <footer className="mt-24 pb-12 text-center">
          <div className="mx-auto h-px w-24 bg-current opacity-30" />
          <div className="mt-4 font-display text-[14px] italic opacity-60">FINIS</div>
        </footer>
      </article>

      {/* Subtle reading progress rail at bottom */}
      {!distraction && (
        <div className="fixed bottom-0 left-0 right-0 z-30 h-[3px] bg-current/10">
          <div className="h-full bg-lamp/80 transition-[width] duration-300" style={{ width: `${progressPct}%` }} />
        </div>
      )}
    </div>
  );
}

/* ───────────── Toolbar (client-only; quiet + unobtrusive) ───────────── */
function ReaderToolbar({
  book, theme, setTheme, fontSize, setFS, lineHeight, setLH,
  showBar, onToggleToc, onShelf, onToggleShelf, onFocus, progress, timeLeft,
}: any) {
  const [open, setOpen] = useState<null | "theme" | "type">(null);
  return (
    <div
      className={`fixed left-0 right-0 top-0 z-30 transition-transform duration-300 ${showBar ? "translate-y-0" : "-translate-y-full"}`}
    >
      <div className="mx-auto flex max-w-4xl items-center gap-3 border-b border-current/10 bg-current/0 px-4 py-3 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2 text-current/80 no-underline hover:text-current">
          <span className="text-lg">📚</span>
          <span className="hidden text-sm font-medium tracking-wide sm:inline">Back to library</span>
        </Link>
        <div className="ml-2 hidden min-w-0 flex-1 truncate text-sm italic opacity-70 md:block">
          {book.title} · <span className="opacity-80">{book.author}</span>
        </div>

        <div className="ml-auto flex items-center gap-1 text-sm">
          <ToolbarBtn onClick={onToggleToc} title="Contents (t)">📑</ToolbarBtn>
          <ToolbarBtn onClick={onToggleShelf} title={onShelf ? "Remove from shelf" : "Add to shelf"}>
            {onShelf ? "🔖" : "＋"}
          </ToolbarBtn>
          <ToolbarBtn onClick={() => setOpen(open === "type" ? null : "type")} title="Typography">Aa</ToolbarBtn>
          <ToolbarBtn onClick={() => setOpen(open === "theme" ? null : "theme")} title="Theme">
            {theme === "paper" ? "☀" : theme === "sepia" ? "📜" : "☾"}
          </ToolbarBtn>
          <ToolbarBtn onClick={onFocus} title="Focus mode (f)">⤢</ToolbarBtn>
        </div>
      </div>

      {/* Popovers */}
      {open === "type" && (
        <div className="mx-auto mt-1 max-w-sm rounded-lg border border-current/10 bg-paper-50 p-4 shadow-card text-ink-400">
          <div className="text-[10px] uppercase tracking-[0.25em] text-ink-100">Typography</div>
          <div className="mt-3 flex items-center gap-3 text-sm">
            <span className="w-24">Font size</span>
            <button onClick={() => setFS(Math.max(14, fontSize - 1))} className="rounded border border-paper-300 px-2">−</button>
            <span className="w-8 text-center font-mono">{fontSize}</span>
            <button onClick={() => setFS(Math.min(28, fontSize + 1))} className="rounded border border-paper-300 px-2">+</button>
          </div>
          <div className="mt-3 flex items-center gap-3 text-sm">
            <span className="w-24">Line height</span>
            <button onClick={() => setLH(Math.max(1.3, +(lineHeight - 0.1).toFixed(2)))} className="rounded border border-paper-300 px-2">−</button>
            <span className="w-12 text-center font-mono">{lineHeight.toFixed(2)}</span>
            <button onClick={() => setLH(Math.min(2.4, +(lineHeight + 0.1).toFixed(2)))} className="rounded border border-paper-300 px-2">+</button>
          </div>
        </div>
      )}
      {open === "theme" && (
        <div className="mx-auto mt-1 flex max-w-sm gap-2 rounded-lg border border-current/10 bg-paper-50 p-3 shadow-card text-ink-400">
          {(["paper", "sepia", "night"] as const).map((t) => (
            <button key={t} onClick={() => setTheme(t)}
                    className={`flex-1 rounded px-3 py-2 text-sm ${theme === t ? "bg-oak-300 text-paper-50" : "bg-paper-100 text-ink-300"}`}>
              {THEME_LABEL[t]}
            </button>
          ))}
        </div>
      )}

      {/* Bottom status bar */}
      <div className="mx-auto mt-1 max-w-4xl px-6 pb-1 text-[10px] uppercase tracking-[0.22em] text-current/60">
        {Math.round(progress)}% · {timeLeft} min left
      </div>
    </div>
  );
}

function ToolbarBtn({ children, onClick, title }: any) {
  return (
    <button onClick={onClick} title={title}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-current/10 bg-current/5 text-base hover:bg-current/15">
      {children}
    </button>
  );
}
