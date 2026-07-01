import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paperhall — a quiet, curated library",
  description: "Browse and read 1,000+ timeless public-domain books as real, page-turning books — with highlights, themes and your own shelf. Free, offline, no account.",
  metadataBase: new URL("https://paperhall.app"),
  openGraph: {
    title: "Paperhall — a quiet, curated library",
    description: "1,000+ timeless books you can read like real books. Free, offline, no account.",
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
