import booksData from "../../data/books.json";

/**
 * Library query helpers used by server components + route handlers.
 *
 * The catalogue is a static JSON file (data/books.json) imported at build time —
 * no database, no filesystem reads, no network at runtime. Book *text* lives as
 * static files under public/books/<id>/content.html and is fetched by the reader
 * on the client. This keeps the whole site static-friendly and CDN-deployable.
 */

export type Book = {
  id: string;
  title: string;
  author: string;
  language: string;
  category: string;
  subjectsCsv: string;
  summary: string | null;
  coverUrl: string | null;
  contentPath: string;
  wordCount: number;
  isFeatured: boolean;
  source: string;
  sourceId: string | null;
  gutenbergId?: number;
};

const ALL: Book[] = (booksData as Partial<Book>[]).map((b) => ({
  id: b.id!,
  title: b.title || "Untitled",
  author: b.author || "Unknown",
  language: b.language || "en",
  category: b.category || "Fiction",
  subjectsCsv: b.subjectsCsv || "",
  summary: b.summary ?? null,
  coverUrl: b.coverUrl ?? null,
  contentPath: b.contentPath || `${b.id}/content.html`,
  wordCount: b.wordCount || 0,
  isFeatured: Boolean(b.isFeatured),
  source: b.source || "gutenberg",
  sourceId: b.sourceId ?? (b.gutenbergId != null ? String(b.gutenbergId) : null),
  gutenbergId: b.gutenbergId,
}));

const byFeaturedThenTitle = (a: Book, b: Book) =>
  Number(b.isFeatured) - Number(a.isFeatured) || a.title.localeCompare(b.title);

export async function allBooks() {
  return [...ALL].sort(byFeaturedThenTitle);
}

export async function featuredBooks(limit = 12) {
  return ALL.filter((b) => b.isFeatured).sort((a, b) => a.title.localeCompare(b.title)).slice(0, limit);
}

export async function popularBooks(limit = 12) {
  const SLUGS = [
    "pride-and-prejudice", "alice-wonderland", "frankenstein", "dracula",
    "moby-dick", "odyssey", "hamlet", "walden",
    "meditations", "crime-punishment", "treasure-island", "origin-of-species",
  ];
  const map = new Map(ALL.map((b) => [b.id, b]));
  return SLUGS.map((s) => map.get(s)).filter((b): b is Book => Boolean(b)).slice(0, limit);
}

export async function booksByCategory(label: string) {
  return ALL.filter((b) => b.category === label).sort(byFeaturedThenTitle);
}

export async function getBook(id: string) {
  return ALL.find((b) => b.id === id) ?? null;
}

export async function searchBooks(q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  return ALL.filter((b) =>
    b.title.toLowerCase().includes(needle) ||
    b.author.toLowerCase().includes(needle) ||
    b.category.toLowerCase().includes(needle) ||
    b.subjectsCsv.toLowerCase().includes(needle)
  );
}
