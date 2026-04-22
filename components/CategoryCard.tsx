import Link from "next/link";
import type { Category } from "@/lib/library/categories";

/** A shelf-front tile in the Browse view — warm tone, minimal. */
export function CategoryCard({ category, count }: { category: Category; count: number }) {
  return (
    <Link
      href={`/category/${category.id}`}
      className="group relative flex h-36 flex-col justify-between overflow-hidden rounded-lg p-5 shadow-card transition-transform hover:-translate-y-0.5"
      style={{
        background: `linear-gradient(160deg, ${category.accent}e0 0%, ${category.accent}88 100%), #f6eeda`,
      }}
    >
      <div className="absolute right-3 top-3 text-2xl opacity-70 transition-opacity group-hover:opacity-100">{category.emoji}</div>
      <div>
        <div className="font-display text-xl text-paper-50">{category.label}</div>
        <div className="mt-1 text-[12px] italic text-paper-50/85">{category.blurb}</div>
      </div>
      <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-paper-50/90">{count} books</div>
    </Link>
  );
}
