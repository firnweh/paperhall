import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CategoryCard } from "@/components/CategoryCard";
import { BookCard } from "@/components/BookCard";
import { allBooks } from "@/lib/library/books";
import { CATEGORIES } from "@/lib/library/categories";

export const revalidate = 60;

export default async function Browse() {
  const books = await allBooks();
  const counts: Record<string, number> = {};
  for (const b of books) counts[b.category] = (counts[b.category] ?? 0) + 1;

  return (
    <div className="min-h-screen bg-paper-100 text-ink-400">
      <Navbar />
      <main className="mx-auto max-w-shelf px-6 pb-16 pt-10">
        <h1 className="font-display text-4xl text-ink-500">The shelves</h1>
        <p className="mt-2 text-sm italic text-ink-100">{books.length} books across {Object.keys(counts).length} categories.</p>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.filter((c) => (counts[c.label] ?? 0) > 0).map((c) => (
            <CategoryCard key={c.id} category={c} count={counts[c.label] ?? 0} />
          ))}
        </section>

        <section className="mt-12">
          <h2 className="mb-5 font-display text-2xl text-ink-400">All books</h2>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {books.map((b) => <BookCard key={b.id} book={b as any} size="sm" />)}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
