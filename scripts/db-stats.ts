#!/usr/bin/env tsx
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const total = await p.book.count();
  const cats = await p.book.groupBy({ by: ["category"], _count: true, orderBy: { category: "asc" } });
  const featured = await p.book.count({ where: { isFeatured: true } });
  const totalWords = await p.book.aggregate({ _sum: { wordCount: true } });
  console.log(`Books in DB: ${total}`);
  console.log(`Featured: ${featured}`);
  console.log(`Total word count: ${(totalWords._sum.wordCount ?? 0).toLocaleString()} (~${Math.round((totalWords._sum.wordCount ?? 0) / 220 / 60).toLocaleString()} reading hours)`);
  console.log(`\nBy category:`);
  cats.forEach((g) => console.log(`  ${g.category.padEnd(15)} ${g._count}`));
  await p.$disconnect();
})();
