/**
 * Category metadata — colours, blurbs, ordering. Not the source of
 * truth for which books belong to a category (that's books.json + DB);
 * just for display.
 */
export type Category = {
  id: string;        // slug used in URLs
  label: string;     // human label as it appears in books.json
  blurb: string;     // shelf description
  accent: string;    // hex color
  emoji: string;
};

export const CATEGORIES: Category[] = [
  { id: "fiction",     label: "Fiction",     blurb: "Novels and classics — the long stories.",          accent: "#7c3a3a", emoji: "📕" },
  { id: "philosophy",  label: "Philosophy",  blurb: "First principles — ethics, mind, and meaning.",     accent: "#3a4a7c", emoji: "📘" },
  { id: "science",     label: "Science",     blurb: "Origins, dreams, motion — thinking made testable.", accent: "#3a7c5e", emoji: "📗" },
  { id: "history",     label: "History",     blurb: "Wars, revolutions, and the slow turn of years.",    accent: "#7c7a3a", emoji: "📜" },
  { id: "poetry",      label: "Poetry",      blurb: "Verse — short, dense, and meant to be reread.",      accent: "#7c3a6e", emoji: "🪶" },
  { id: "drama",       label: "Drama",       blurb: "Plays — Shakespeare, Ibsen, Wilde on the stage.",    accent: "#7c4a3a", emoji: "🎭" },
  { id: "essays",      label: "Essays",      blurb: "Walden, Federalist, Mill — argument made personal.", accent: "#5e3a7c", emoji: "🖋" },
  { id: "academic",    label: "Academic",    blurb: "Scholarship — economics, maths, law, mind, and method.", accent: "#4a5a6c", emoji: "🎓" },
  { id: "children",    label: "Children",    blurb: "The books we read first, that we still re-read.",    accent: "#7c5e3a", emoji: "🧸" },
  { id: "adventure",   label: "Adventure",   blurb: "Maps, sea-voyages, hidden treasure, escape.",        accent: "#5e7c3a", emoji: "🗺" },
  { id: "mystery",     label: "Mystery",     blurb: "Detectives, gothic houses, the unaccounted noise.",  accent: "#3a3a7c", emoji: "🔎" },
  { id: "global",      label: "Global Classics", blurb: "Cervantes, Homer, Dostoevsky, Tolstoy.",         accent: "#7c3a4a", emoji: "🌐" },
  { id: "self",        label: "Self & Stoic", blurb: "Quiet, practical wisdom — Stoics + moderns.",       accent: "#3a7c7c", emoji: "🕯" },
  { id: "sci-fi",      label: "Sci-Fi",      blurb: "Time-machines, invisible men, Flatland.",            accent: "#7c5e3a", emoji: "🚀" },
  { id: "memoir",      label: "Memoir",      blurb: "First-person lives, told quietly.",                  accent: "#3a5e7c", emoji: "✍️" },
];

export function findCategory(label: string): Category | undefined {
  return CATEGORIES.find((c) => c.label.toLowerCase() === label.toLowerCase());
}
export function findCategoryById(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}
