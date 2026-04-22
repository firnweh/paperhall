"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BookCard } from "@/components/BookCard";
import { EmptyState } from "@/components/EmptyState";
import { getShelf, getAllProgress, getRecentlyOpened, onStorageChange } from "@/lib/storage/shelf";

type Book = { id: string; title: string; author: string; category: string; coverUrl?: string | null };

export function ShelfClient({ lookup }: { lookup: Record<string, Book> }) {
  const [, tick] = useState(0);
  useEffect(() => onStorageChange(() => tick((t) => t + 1)), []);

  const shelf = getShelf().map((id) => lookup[id]).filter(Boolean) as Book[];
  const progress = getAllProgress();
  const reading = shelf.filter((b) => progress[b.id] && progress[b.id].percent > 0 && progress[b.id].percent < 99);
  const done    = shelf.filter((b) => progress[b.id]?.percent >= 99);
  const unread  = shelf.filter((b) => !progress[b.id] || progress[b.id].percent === 0);
  const recent  = getRecentlyOpened().map((id) => lookup[id]).filter(Boolean) as Book[];

  return (
    <div className="mt-10 space-y-14">
      {shelf.length === 0 && recent.length === 0 && (
        <EmptyState
          title="Your shelf is empty."
          blurb='Browse the library — when you find a book, tap "Add to shelf" on its catalog card and it will appear here.'
          icon="🗂"
        />
      )}

      {reading.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-xl text-ink-400">Currently reading</h2>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {reading.map((b) => <BookCard key={b.id} book={b} size="sm" />)}
          </div>
        </section>
      )}

      {unread.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-xl text-ink-400">Waiting to be opened</h2>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {unread.map((b) => <BookCard key={b.id} book={b} size="sm" />)}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-xl text-ink-400">Finished</h2>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {done.map((b) => <BookCard key={b.id} book={b} size="sm" />)}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-xl text-ink-400">Recently opened</h2>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {recent.map((b) => <BookCard key={b.id} book={b} size="sm" />)}
          </div>
        </section>
      )}
    </div>
  );
}
