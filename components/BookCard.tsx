import Link from "next/link";
import { findCategory } from "@/lib/library/categories";

type Book = {
  id: string; title: string; author: string; category: string; coverUrl?: string | null;
};

/**
 * A single spine-and-cover card on a shelf. Visual goal: a small book
 * tipped gently forward, with a warm shadow, like it's waiting to be
 * picked up.
 */
export function BookCard({ book, size = "md" }: { book: Book; size?: "sm" | "md" | "lg" }) {
  const cat = findCategory(book.category);
  const dims = size === "lg" ? "h-72 w-48" : size === "sm" ? "h-44 w-28" : "h-56 w-36";
  const fallback = fallbackPattern(book.id);

  return (
    <Link href={`/book/${book.id}`} className="group flex flex-col items-center">
      <div
        className={`relative ${dims} overflow-hidden rounded-r-md rounded-l-sm shadow-book transition-transform group-hover:-translate-y-1 group-hover:rotate-[-0.5deg]`}
        style={{
          background: fallback,
          // Spine suggestion on the left
          boxShadow: "inset 8px 0 10px -6px rgba(0,0,0,0.35), 0 12px 24px -12px rgba(42,30,20,0.45)",
        }}
      >
        {/* Spine text — always renders, sits on the gradient. */}
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 text-paper-50 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
          <div className="font-display text-[15px] leading-snug">{book.title}</div>
          <div className="font-serif italic text-[11px] opacity-85">{book.author}</div>
        </div>
        {book.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={book.coverUrl} alt="" referrerPolicy="no-referrer"
               className="absolute inset-0 z-0 h-full w-full object-cover opacity-90 mix-blend-multiply" />
        ) : null}
      </div>
      {/* Shelf label under cover */}
      <div className="mt-3 w-full max-w-[11rem] text-center">
        <div className="font-serif text-[13px] leading-snug text-ink-400 line-clamp-2">{book.title}</div>
        <div className="mt-1 text-[11px] italic text-ink-100">{book.author}</div>
        {cat && (
          <div className="mt-1 text-[9px] uppercase tracking-[0.2em] text-ink-100/70">{cat.label}</div>
        )}
      </div>
    </Link>
  );
}

/** Generate a fallback gradient cover from the book id. */
function fallbackPattern(id: string): string {
  const palettes = [
    ["#7c3a3a", "#4a1f1f"],
    ["#3a4a7c", "#1e2a4a"],
    ["#3a7c5e", "#1f4a38"],
    ["#7c7a3a", "#4a491f"],
    ["#7c3a6e", "#4a1f41"],
    ["#7c4a3a", "#4a281f"],
    ["#5e3a7c", "#38214a"],
    ["#3a7c7c", "#1f4a4a"],
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % palettes.length;
  const [a, b] = palettes[h];
  return `linear-gradient(160deg, ${a} 0%, ${b} 100%)`;
}
