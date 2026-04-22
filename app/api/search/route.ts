import { NextRequest, NextResponse } from "next/server";
import { searchBooks } from "@/lib/library/books";

/**
 * GET /api/search?q=pride → returns up to 20 matches.
 * Everything runs against local SQLite; no external network.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const results = await searchBooks(q);
  return NextResponse.json({
    results: results.slice(0, 20).map((b) => ({
      id: b.id, title: b.title, author: b.author, category: b.category,
    })),
  });
}
