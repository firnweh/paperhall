export function Footer() {
  return (
    <footer className="mt-16 border-t border-paper-300/60 bg-paper-200/40 py-8">
      <div className="mx-auto max-w-shelf px-6 text-center">
        <div className="font-display text-lg text-ink-300">Paperhall</div>
        <p className="mt-2 text-xs italic text-ink-100">
          A quiet, curated personal library. Every book is kept locally — nothing is loaded while you read.
        </p>
        <p className="mt-3 text-[10px] tracking-[0.25em] text-ink-100/70">
          TEXTS SOURCED FROM PROJECT GUTENBERG · PUBLIC DOMAIN
        </p>
      </div>
    </footer>
  );
}
