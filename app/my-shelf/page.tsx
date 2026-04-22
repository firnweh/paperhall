import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { allBooks } from "@/lib/library/books";
import { ShelfClient } from "./ShelfClient";

export const revalidate = 60;

export default async function MyShelf() {
  // Pass the whole catalog to the client — small, denormalised, lets
  // localStorage state stay entirely client-side.
  const books = await allBooks();
  const lookup: Record<string, any> = {};
  for (const b of books) lookup[b.id] = { id: b.id, title: b.title, author: b.author, category: b.category, coverUrl: b.coverUrl };
  return (
    <div className="min-h-screen bg-paper-100 text-ink-400">
      <Navbar />
      <main className="mx-auto max-w-shelf px-6 pb-16 pt-10">
        <h1 className="font-display text-4xl text-ink-500">My shelf</h1>
        <p className="mt-2 text-sm italic text-ink-100">Books you&apos;ve saved — kept just for you. Nothing leaves the device.</p>
        <ShelfClient lookup={lookup} />
      </main>
      <Footer />
    </div>
  );
}
