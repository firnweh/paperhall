import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paperhall — A quiet library",
  description: "A curated 100-book library. Walk in, pick a book, sit at the reading desk.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
