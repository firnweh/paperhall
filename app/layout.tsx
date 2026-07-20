import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paperhall — a quiet, curated library",
  description: "Browse and read 3,600+ timeless public-domain books — English and Hindi — as real, page-turning books, with highlights, themes and your own shelf. Free, no account.",
  metadataBase: new URL("https://paperhall.in"),
  openGraph: {
    title: "Paperhall — a quiet, curated library",
    description: "3,600+ timeless books — English and Hindi — you can read like real books. Free, no account.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
