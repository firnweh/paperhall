import Link from "next/link";
import { SearchBar } from "./SearchBar";

/**
 * A quiet library masthead — Paperhall wordmark on the left, nav in
 * the middle, search to the right. No flashy branding or announcements.
 */
export function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-paper-300/60 bg-paper-100/85 backdrop-blur supports-[backdrop-filter]:bg-paper-100/75">
      <div className="mx-auto flex max-w-shelf items-center gap-8 px-6 py-4">
        <Link href="/" className="flex items-center gap-3 text-ink-400 no-underline">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-oak-300 text-paper-100 font-display">P</span>
          <div className="leading-tight">
            <div className="font-display text-xl tracking-wide">Paperhall</div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-ink-200/70">A quiet library</div>
          </div>
        </Link>
        <nav className="hidden flex-1 items-center gap-8 md:flex">
          <Link href="/"            className="text-sm font-medium text-ink-300 hover:text-ink-500">Lobby</Link>
          <Link href="/browse"      className="text-sm font-medium text-ink-300 hover:text-ink-500">Shelves</Link>
          <Link href="/my-shelf"    className="text-sm font-medium text-ink-300 hover:text-ink-500">My Shelf</Link>
          <Link href="/about"       className="text-sm font-medium text-ink-300 hover:text-ink-500">About</Link>
        </nav>
        <div className="ml-auto w-full max-w-sm md:ml-0 md:w-80">
          <SearchBar />
        </div>
      </div>
    </header>
  );
}
