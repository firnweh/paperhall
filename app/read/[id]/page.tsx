import { notFound } from "next/navigation";
import { getBook, loadBookContent } from "@/lib/library/books";
import { extractToc } from "@/lib/library/formatter";
import { Reader } from "./Reader";

export const revalidate = 60;

/**
 * Reader route. We fetch metadata + content server-side so the first
 * paint has everything (no loading spinner before the book opens), then
 * hand control to the client Reader for themes, progress and scroll.
 */
export default async function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) return notFound();
  const content = await loadBookContent(id);
  if (!content) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-100 p-10 text-center text-ink-300">
        <div>
          <div className="text-5xl">📭</div>
          <div className="mt-4 font-display text-xl">The text for this book isn&apos;t on the shelf.</div>
          <p className="mt-2 max-w-md italic text-ink-100">
            Run <code>npm run import:books</code> to fetch + store it locally, then refresh.
          </p>
        </div>
      </div>
    );
  }
  // Strip the HTML shell and pull the <article>…</article> body.
  const articleMatch = content.match(/<article[\s\S]*<\/article>/);
  const html = (articleMatch ? articleMatch[0] : content);
  const toc = extractToc(html);

  return (
    <Reader
      book={{ id: book.id, title: book.title, author: book.author, category: book.category, wordCount: book.wordCount }}
      html={html}
      toc={toc}
    />
  );
}
