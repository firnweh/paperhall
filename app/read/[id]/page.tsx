import { notFound } from "next/navigation";
import { getBook } from "@/lib/library/books";
import { Reader } from "./Reader";

export const revalidate = 3600;

/**
 * Reader route. Renders metadata server-side; the client Reader fetches the
 * book's text from /public/books/<id>/content.html (a static CDN asset) and
 * paginates it into the page-flip book.
 */
export default async function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) return notFound();

  return (
    <Reader
      book={{ id: book.id, title: book.title, author: book.author, category: book.category, wordCount: book.wordCount }}
    />
  );
}
