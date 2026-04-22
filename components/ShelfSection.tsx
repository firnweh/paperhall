import Link from "next/link";
import { BookCard } from "./BookCard";

/**
 * A horizontal "shelf" — a row of book spines with a wooden ledge
 * drawn beneath them. Scrolls horizontally on mobile, grids on wide.
 */
export function ShelfSection({
  title, subtitle, books, href, accent,
}: {
  title: string;
  subtitle?: string;
  books: Array<{ id: string; title: string; author: string; category: string; coverUrl?: string | null }>;
  href?: string;
  accent?: string;
}) {
  if (!books.length) return null;
  return (
    <section className="mb-14">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-ink-400">{title}</h2>
          {subtitle && <p className="mt-1 text-sm italic text-ink-100">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="text-sm font-medium text-oak-200 hover:text-ink-400" style={{ color: accent }}>
            Browse shelf →
          </Link>
        )}
      </div>
      <div className="relative">
        {/* Wooden shelf ledge */}
        <div className="absolute inset-x-0 bottom-0 z-0 h-3 rounded-b-md bg-gradient-to-b from-oak-200 to-oak-400 shadow-[0_6px_14px_-6px_rgba(0,0,0,0.4)]" />
        <div className="relative z-10 flex gap-6 overflow-x-auto pb-5 pt-2 md:gap-8" style={{ scrollSnapType: "x mandatory" }}>
          {books.map((b) => (
            <div key={b.id} style={{ scrollSnapAlign: "start" }} className="flex-shrink-0">
              <BookCard book={b} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
