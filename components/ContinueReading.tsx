"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getAllProgress, getRecentlyOpened, onStorageChange, getShelf } from "@/lib/storage/shelf";

type Book = { id: string; title: string; author: string; category: string };

/**
 * Client-only. Queries localStorage progress + recents, looks them up
 * against a server-provided lookup table of books, and shows the
 * "continue reading" shelf.
 */
export function ContinueReading({ lookup }: { lookup: Record<string, Book> }) {
  const [tick, setTick] = useState(0);
  useEffect(() => onStorageChange(() => setTick((t) => t + 1)), []);

  const progress = getAllProgress();
  const recent = getRecentlyOpened();
  const shelf = getShelf();

  // Sort by: in-progress (0 < percent < 100) → recently opened → on shelf
  const active: Array<{ b: Book; p: number }> = [];
  const seen = new Set<string>();

  Object.entries(progress)
    .filter(([, p]) => p.percent > 0 && p.percent < 99)
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
    .forEach(([id, p]) => {
      if (lookup[id]) { active.push({ b: lookup[id], p: p.percent }); seen.add(id); }
    });
  recent.forEach((id) => {
    if (!seen.has(id) && lookup[id] && active.length < 8) {
      active.push({ b: lookup[id], p: progress[id]?.percent ?? 0 });
      seen.add(id);
    }
  });
  if (active.length === 0 && shelf.length) {
    shelf.slice(0, 6).forEach((id) => { if (lookup[id]) active.push({ b: lookup[id], p: progress[id]?.percent ?? 0 }); });
  }

  if (active.length === 0) return null;

  return (
    <section className="mb-14" key={tick}>
      <h2 className="mb-4 font-display text-2xl text-ink-400">Continue reading</h2>
      <p className="mb-6 text-sm italic text-ink-100">Your bookmark is still in place. Come back to where you left off.</p>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {active.map(({ b, p }) => (
          <Link key={b.id} href={`/read/${b.id}`}
                className="group flex items-center gap-4 rounded-lg border border-paper-300 bg-paper-50 p-4 shadow-card transition-transform hover:-translate-y-0.5">
            <div className="flex h-20 w-14 flex-shrink-0 items-center justify-center rounded-sm bg-oak-300 text-[9px] italic text-paper-50 shadow-[inset_4px_0_6px_-3px_rgba(0,0,0,0.4)]">
              {b.title.split(" ").slice(0, 3).map((w, i) => <div key={i}>{w}</div>)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-serif text-[15px] text-ink-400">{b.title}</div>
              <div className="mt-0.5 truncate text-xs italic text-ink-100">{b.author}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-300/60">
                <div className="h-full bg-oak-200" style={{ width: `${Math.round(p)}%` }} />
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-ink-100/80">{Math.round(p)}% · resume</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
