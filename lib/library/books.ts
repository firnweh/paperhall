import { prisma } from "../db";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Library query helpers used by server components + route handlers.
 * Everything is local — no network calls at runtime.
 */

export async function allBooks() {
  return prisma.book.findMany({
    orderBy: [{ isFeatured: "desc" }, { title: "asc" }],
  });
}

export async function featuredBooks(limit = 12) {
  return prisma.book.findMany({
    where: { isFeatured: true },
    take: limit,
    orderBy: { title: "asc" },
  });
}

export async function popularBooks(limit = 12) {
  // MVP "popular" = hand-curated well-known titles by slug match
  const SLUGS = [
    "pride-and-prejudice", "alice-wonderland", "frankenstein", "dracula",
    "moby-dick", "odyssey", "hamlet", "walden",
    "meditations", "crime-punishment", "treasure-island", "origin-of-species",
  ];
  const books = await prisma.book.findMany({
    where: { id: { in: SLUGS } },
    take: limit,
  });
  // Preserve curated order
  return SLUGS.map((s) => books.find((b) => b.id === s)).filter(Boolean);
}

export async function booksByCategory(label: string) {
  return prisma.book.findMany({
    where: { category: { equals: label } },
    orderBy: [{ isFeatured: "desc" }, { title: "asc" }],
  });
}

export async function getBook(id: string) {
  return prisma.book.findUnique({ where: { id } });
}

export async function searchBooks(q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  // SQLite has no native LOWER index, but the dataset is small (~100 rows)
  // so scanning + case-insensitive compare in memory is fine.
  const all = await prisma.book.findMany();
  return all.filter((b) =>
    b.title.toLowerCase().includes(needle) ||
    b.author.toLowerCase().includes(needle) ||
    b.category.toLowerCase().includes(needle) ||
    b.subjectsCsv.toLowerCase().includes(needle)
  );
}

/**
 * Load the stored book content from /storage/books/<id>/content.html.
 * Returns null if missing — pages should degrade gracefully.
 */
export async function loadBookContent(id: string): Promise<string | null> {
  const abs = path.join(process.cwd(), "storage", "books", id, "content.html");
  try {
    return await fs.readFile(abs, "utf8");
  } catch {
    return null;
  }
}
