-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "category" TEXT NOT NULL,
    "subjectsCsv" TEXT NOT NULL DEFAULT '',
    "summary" TEXT,
    "coverUrl" TEXT,
    "contentPath" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'gutenberg',
    "sourceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ReadingProgress" (
    "bookId" TEXT NOT NULL PRIMARY KEY,
    "progressPercent" REAL NOT NULL DEFAULT 0,
    "lastLocation" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReadingProgress_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Book_category_idx" ON "Book"("category");

-- CreateIndex
CREATE INDEX "Book_author_idx" ON "Book"("author");
