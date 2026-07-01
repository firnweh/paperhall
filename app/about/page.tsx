import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { allBooks } from "@/lib/library/books";

export default async function About() {
  const total = (await allBooks()).length;
  return (
    <div className="min-h-screen bg-paper-100 text-ink-400">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 pb-16 pt-14 font-serif">
        <h1 className="font-display text-4xl text-ink-500">About the library</h1>
        <p className="mt-5 text-[17px] leading-relaxed">
          Paperhall is a curated digital library — {total.toLocaleString()} well-known
          books read quietly as real, page-turning books. It was built to feel
          like walking into a library, not opening a bookstore.
        </p>
        <h2 className="mt-10 font-display text-xl text-ink-500">What&apos;s on the shelves</h2>
        <p className="mt-3 text-[16px] leading-relaxed">
          A balanced collection across fiction, philosophy, science, history, poetry,
          drama, essays, children&apos;s books, adventure, mystery, global classics,
          self &amp; stoic thought, sci-fi and memoir. Every book is in the public
          domain — sourced from Project Gutenberg and catalogued with a hand-written
          summary.
        </p>
        <h2 className="mt-10 font-display text-xl text-ink-500">How it works</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-[16px] leading-relaxed">
          <li>One curated manifest (<code>data/books.json</code>) lists every title in the library.</li>
          <li>A local ingestion pipeline downloads + cleans each text once and stores it on disk.</li>
          <li>Metadata lives in that static JSON manifest; book content sits under <code>storage/books/</code> as plain HTML.</li>
          <li>At read-time, the app never touches the network — it just reads from your disk.</li>
          <li>Your shelf, bookmarks and reading progress stay in your browser&apos;s localStorage.</li>
        </ul>
        <h2 className="mt-10 font-display text-xl text-ink-500">Reading it</h2>
        <p className="mt-3 text-[16px] leading-relaxed">
          The reader is designed to recede. A warm reading surface, generous margins,
          three themes (paper, sepia, night), adjustable type, a subtle progress rail
          at the bottom of the page. Press <kbd>f</kbd> to enter focus mode, <kbd>t</kbd>
          for the table of contents.
        </p>
        <p className="mt-10 text-sm italic text-ink-100">
          Built slowly, read slowly.
        </p>
      </main>
      <Footer />
    </div>
  );
}
