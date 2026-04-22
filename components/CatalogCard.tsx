/**
 * A physical-library-catalog-card rendering of a book's metadata.
 * Used on the book detail page. Think: a manilla card in a wooden
 * drawer — typewriter font, ruled lines, call number in the corner.
 */
export function CatalogCard({
  title, author, category, language, wordCount, source, summary, callNumber,
}: {
  title: string; author: string; category: string; language: string;
  wordCount: number; source: string; summary?: string | null; callNumber: string;
}) {
  const mins = Math.max(1, Math.round(wordCount / 220));
  const hours = (mins / 60).toFixed(1);
  return (
    <div className="relative max-w-xl rounded-sm border border-paper-300 bg-paper-50 px-7 py-6 font-serif text-ink-400 shadow-[0_6px_20px_-10px_rgba(40,25,12,0.35)]"
         style={{ backgroundImage: "repeating-linear-gradient(0deg, #f6eeda 0 23px, #e5d7b7 23px 24px)" }}>
      <div className="absolute right-4 top-3 font-mono text-[11px] text-ink-100">{callNumber}</div>
      <div className="text-[10px] uppercase tracking-[0.3em] text-ink-100">Paperhall Catalog</div>
      <h1 className="mt-2 font-display text-[30px] leading-tight text-ink-500">{title}</h1>
      <div className="mt-1 italic text-ink-200">by {author}</div>
      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
        <dt className="text-ink-100">Category</dt><dd>{category}</dd>
        <dt className="text-ink-100">Language</dt><dd>{language.toUpperCase()}</dd>
        <dt className="text-ink-100">Source</dt><dd className="capitalize">{source}</dd>
        <dt className="text-ink-100">Words</dt><dd>{wordCount.toLocaleString()}</dd>
        <dt className="text-ink-100">Estimated read</dt><dd>{mins} min ({hours} hr)</dd>
      </dl>
      {summary && (
        <p className="mt-5 border-l-2 border-oak-200 pl-3 text-[14px] italic leading-relaxed text-ink-300">
          {summary}
        </p>
      )}
    </div>
  );
}
