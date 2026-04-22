import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { BookCard } from "@/components/BookCard";
import { EmptyState } from "@/components/EmptyState";
import { booksByCategory } from "@/lib/library/books";
import { findCategoryById } from "@/lib/library/categories";

export const revalidate = 60;

export default async function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cat = findCategoryById(id);
  if (!cat) return notFound();
  const books = await booksByCategory(cat.label);

  return (
    <div className="min-h-screen bg-paper-100 text-ink-400">
      <Navbar />
      <main className="mx-auto max-w-shelf px-6 pb-16 pt-10">
        <div
          className="relative overflow-hidden rounded-lg p-8 shadow-card"
          style={{ background: `linear-gradient(160deg, ${cat.accent}e8 0%, ${cat.accent}aa 100%)` }}
        >
          <div className="absolute right-5 top-5 text-5xl opacity-60">{cat.emoji}</div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-paper-50/90">Shelf</div>
          <h1 className="mt-1 font-display text-4xl text-paper-50">{cat.label}</h1>
          <p className="mt-2 max-w-xl text-sm italic text-paper-50/90">{cat.blurb}</p>
          <p className="mt-4 text-[11px] uppercase tracking-[0.24em] text-paper-50/80">{books.length} books</p>
        </div>

        {books.length ? (
          <section className="mt-10">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {books.map((b) => <BookCard key={b.id} book={b as any} />)}
            </div>
          </section>
        ) : (
          <div className="mt-10">
            <EmptyState
              title="This shelf is empty"
              blurb="Run the importer to populate it. The catalog may still be loading."
            />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
