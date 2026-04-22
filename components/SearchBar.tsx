"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Result = {
  id: string; title: string; author: string; category: string;
};

export function SearchBar() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setResults(json.results ?? []);
      } catch {}
    }, 160);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <input
        type="search"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search the shelves — title, author, subject…"
        className="w-full rounded-full border border-paper-300 bg-paper-50/80 px-4 py-2 text-sm text-ink-300 placeholder:text-ink-100/70 shadow-sm focus:outline-none focus:ring-2 focus:ring-lamp/40"
      />
      {open && q.trim() && (
        <div className="absolute right-0 left-0 top-full mt-2 max-h-80 overflow-auto rounded-xl border border-paper-300 bg-paper-50 shadow-card">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-ink-100">No books found for <b className="text-ink-300">{q}</b>.</div>
          ) : (
            results.slice(0, 10).map((r) => (
              <Link key={r.id} href={`/book/${r.id}`} className="flex items-baseline gap-3 border-b border-paper-200 px-4 py-3 last:border-b-0 hover:bg-paper-200/60">
                <span className="font-serif text-[15px] text-ink-400">{r.title}</span>
                <span className="ml-auto text-xs italic text-ink-100">{r.author}</span>
                <span className="ml-3 rounded-full bg-oak-100/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-oak-300">{r.category}</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
