import { notFound } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CatalogCard } from "@/components/CatalogCard";
import { ShelfButton } from "./ShelfButton";
import { getBook } from "@/lib/library/books";

export const revalidate = 60;

export default async function BookDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) return notFound();

  // Call number: CAT-XXX based on ID hash
  let h = 0;
  for (let i = 0; i < book.id.length; i++) h = (h * 31 + book.id.charCodeAt(i)) % 999;
  const callNumber = `${book.category.slice(0, 3).toUpperCase()}-${String(h + 100).padStart(3, "0")}`;

  return (
    <div className="min-h-screen bg-paper-100 text-ink-400">
      <Navbar />
      <main className="mx-auto max-w-shelf px-6 pb-16 pt-10">
        <Link href="/browse" className="mb-6 inline-block text-sm text-ink-100 hover:text-ink-400">← Back to the shelves</Link>

        <div className="grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Book cover */}
          <div className="flex justify-center lg:justify-start">
            <div className="relative h-96 w-64 overflow-hidden rounded-r-md rounded-l-sm shadow-book"
                 style={{
                   background: "linear-gradient(160deg, #4a281f 0%, #2a1e14 100%)",
                   boxShadow: "inset 8px 0 12px -6px rgba(0,0,0,0.5), 0 20px 40px -14px rgba(40,25,12,0.6)",
                 }}>
              <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-5 text-paper-50 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
                <div className="font-display text-xl leading-snug">{book.title}</div>
                <div className="font-serif italic text-sm opacity-90">{book.author}</div>
              </div>
              {book.coverUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={book.coverUrl} alt="" referrerPolicy="no-referrer"
                     className="absolute inset-0 z-0 h-full w-full object-cover opacity-90 mix-blend-multiply" />
              )}
            </div>
          </div>

          {/* Catalog card */}
          <div>
            <CatalogCard
              title={book.title}
              author={book.author}
              category={book.category}
              language={book.language}
              wordCount={book.wordCount}
              source={book.source}
              summary={book.summary}
              callNumber={callNumber}
            />

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={`/read/${book.id}`}
                    className="inline-flex items-center gap-2 rounded-full bg-oak-300 px-7 py-3 font-serif text-base text-paper-50 shadow-card transition-transform hover:-translate-y-0.5 hover:bg-oak-400">
                📖 Open the book
              </Link>
              <ShelfButton bookId={book.id} />
            </div>

            <p className="mt-6 max-w-xl text-[12px] italic text-ink-100">
              A catalog-card view of this volume. Open the book to sit at the reading desk.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
