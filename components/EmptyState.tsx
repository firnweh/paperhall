export function EmptyState({
  title, blurb, icon = "📚",
}: { title: string; blurb: string; icon?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-paper-300 bg-paper-50/80 px-8 py-14 text-center">
      <div className="text-5xl opacity-80">{icon}</div>
      <div className="mt-4 font-display text-lg text-ink-400">{title}</div>
      <p className="mt-2 max-w-sm text-sm italic leading-relaxed text-ink-100">{blurb}</p>
    </div>
  );
}
