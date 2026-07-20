import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { allBooks } from "@/lib/library/books";
import { CATEGORIES } from "@/lib/library/categories";

export default async function About() {
  const all = await allBooks();
  const total = all.length;
  const authors = new Set(all.map((b) => b.author)).size;
  const shelves = CATEGORIES.map((c) => c.label);

  return (
    <div className="min-h-screen bg-paper-100 text-ink-400">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 pb-16 pt-14 font-serif">
        <h1 className="font-display text-4xl text-ink-500">About the library</h1>
        <p className="mt-5 text-[17px] leading-relaxed">
          Paperhall is a curated digital library — {total.toLocaleString()} public-domain
          books by {authors.toLocaleString()} authors, read quietly as real, page-turning
          books. It was built to feel like walking into a library, not opening a bookstore.
        </p>

        <h2 className="mt-10 font-display text-xl text-ink-500">What&apos;s on the shelves</h2>
        <p className="mt-3 text-[16px] leading-relaxed">
          {total.toLocaleString()} books across {shelves.length} shelves —{" "}
          {shelves.slice(0, -1).join(", ")} and {shelves[shelves.length - 1]}. From Homer,
          Shakespeare and Dostoevsky to a deep <b>Academic</b> shelf — economics,
          mathematics, psychology, law, political science, and the natural sciences — and a{" "}
          <b>Hindi</b> shelf in Devanagari: Premchand, Jaishankar Prasad, Nirala, Tulsidas,
          Kabir, Surdas and the classics. Every book is in the public domain, sourced from
          Project Gutenberg and Hindi Wikisource, cleaned of boilerplate for comfortable
          reading.
        </p>

        <h2 className="mt-10 font-display text-xl text-ink-500">How it works</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-[16px] leading-relaxed">
          <li>A single JSON manifest (<code>data/books.json</code>) is the whole catalogue.</li>
          <li>Each book&apos;s text is stored as clean HTML on a CDN and fetched on demand — so the library can grow without limit.</li>
          <li>The text is paginated in your browser into a two-page spread and turned with a real page-flip.</li>
          <li>Your shelf, bookmarks, highlights and reading progress stay in your browser&apos;s localStorage — nothing leaves your device.</li>
        </ul>

        <h2 className="mt-10 font-display text-xl text-ink-500">Reading it</h2>
        <p className="mt-3 text-[16px] leading-relaxed">
          Open any book and it lays out as a real two-page spread you turn with a page-flip
          (<kbd>←</kbd> / <kbd>→</kbd>, or swipe on a phone). Three paper themes — paper,
          sepia, night — three type sizes, a serif/sans toggle, and a chapter drawer. Select
          any passage and pick a colour to highlight it; it&apos;s saved to that book. Tap the
          star to keep a book on your shelf, and it remembers where you left off.
        </p>

        <p className="mt-10 text-sm italic text-ink-100">
          Built slowly, read slowly.
        </p>
      </main>
      <Footer />
    </div>
  );
}
