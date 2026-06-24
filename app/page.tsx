import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ShelfSection } from "@/components/ShelfSection";
import { CategoryCard } from "@/components/CategoryCard";
import { ContinueReading } from "@/components/ContinueReading";
import { EmptyState } from "@/components/EmptyState";
import { allBooks, featuredBooks, popularBooks } from "@/lib/library/books";
import { CATEGORIES, findCategory } from "@/lib/library/categories";

export const revalidate = 60;

export default async function LibraryLobby() {
  const [all, featured, popular] = await Promise.all([
    allBooks(), featuredBooks(12), popularBooks(12),
  ]);

  if (all.length === 0) {
    return (
      <main className="mx-auto max-w-shelf px-6 py-24">
        <Navbar />
        <EmptyState
          icon="📚"
          title="The shelves are empty."
          blurb="Run `npm run db:setup` then `npm run import:books` to populate the library. See the README for details." />
        <Footer />
      </main>
    );
  }

  // Books keyed by id for the Continue-Reading widget (client-side lookup).
  const lookup: Record<string, any> = {};
  for (const b of all) lookup[b.id] = { id: b.id, title: b.title, author: b.author, category: b.category };

  // Count per category for the shelves grid.
  const counts: Record<string, number> = {};
  for (const b of all) counts[b.category] = (counts[b.category] ?? 0) + 1;

  return (
    <div className="min-h-screen bg-library-wall bg-paper-100 text-ink-400">
      <Navbar />
      <main className="mx-auto max-w-shelf px-6 pb-16 pt-10">
        {/* Lobby header */}
        <section className="mb-14 text-center">
          <div className="inline-block rounded-full border border-paper-300 bg-paper-50/60 px-4 py-1 text-[11px] uppercase tracking-[0.28em] text-ink-100">
            The Library is open
          </div>
          <h1 className="mt-5 font-display text-[clamp(36px,6vw,64px)] leading-tight text-ink-500">
            Welcome to Paperhall.
          </h1>
          <p className="mx-auto mt-3 max-w-xl font-serif text-lg italic text-ink-200">
            Over 300 timeless books — stored locally, read quietly. Pick one from the shelves and bring it to the reading desk.
          </p>
        </section>

        {/* Continue reading — only renders if there's any */}
        <ContinueReading lookup={lookup} />

        <ShelfSection title="Featured shelf" subtitle="A librarian's picks this week." books={featured as any} href="/browse" />
        <ShelfSection title="Popular in the hall" subtitle="What readers pick up most often." books={popular as any} href="/browse" />

        {/* Categories — grid of shelf cards */}
        <section className="mb-14">
          <h2 className="mb-5 font-display text-2xl text-ink-400">Shelves by category</h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {CATEGORIES.filter((c) => (counts[c.label] ?? 0) > 0).map((c) => (
              <CategoryCard key={c.id} category={c} count={counts[c.label] ?? 0} />
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
