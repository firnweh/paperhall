"use client";
import { useEffect, useState } from "react";
import { addToShelf, removeFromShelf, isOnShelf, onStorageChange } from "@/lib/storage/shelf";

export function ShelfButton({ bookId }: { bookId: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(isOnShelf(bookId)); return onStorageChange(() => setOn(isOnShelf(bookId))); }, [bookId]);
  return (
    <button
      onClick={() => (on ? removeFromShelf(bookId) : addToShelf(bookId))}
      className={`inline-flex items-center gap-2 rounded-full border px-5 py-3 font-serif text-sm transition-colors ${
        on
          ? "border-oak-300 bg-oak-300/15 text-oak-400 hover:bg-oak-300/25"
          : "border-paper-300 bg-paper-50 text-ink-300 hover:bg-paper-200"
      }`}>
      {on ? "🔖 On your shelf" : "＋ Add to shelf"}
    </button>
  );
}
