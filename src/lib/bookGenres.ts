/**
 * Turns Open Library's messy subject tags ("FICTION / Thrillers / Suspense",
 * "Fiction, Romance, Historical, Regency", "juvenile fantasy"…) into a short,
 * friendly list of genres for "Pick for me". A book can have several.
 */
export const GENRES: { name: string; test: RegExp }[] = [
  { name: 'Fantasy', test: /fantasy|dragons|wizards|magic\b/i },
  { name: 'Sci-fi', test: /science fiction|sci-fi|dystopia|space opera|cyberpunk/i },
  { name: 'Romance', test: /romance|love stories/i },
  { name: 'Mystery & thriller', test: /mystery|thriller|suspense|detective|crime fiction/i },
  { name: 'Horror', test: /horror|ghost stories|supernatural fiction/i },
  { name: 'Classics', test: /\bclassics?\b/i },
  { name: 'Literary fiction', test: /literary fiction|fiction, literary/i },
  { name: 'Historical fiction', test: /historical fiction|fiction, historical|fiction \/ historical/i },
  { name: 'Young adult & children’s', test: /young adult|juvenile|children'?s/i },
  { name: 'Memoir & biography', test: /biography|memoir|autobiograph/i },
  { name: 'Self-help', test: /self-help|personal growth|self-actualization|success\b|habit/i },
  { name: 'Poetry', test: /poetry|\bpoems\b/i },
  { name: 'Comics & graphic novels', test: /comic|graphic novel|manga/i },
  { name: 'Philosophy', test: /philosophy/i },
];

export const NON_FICTION = 'Non-fiction';

export function genresFrom(subjects: readonly string[] | undefined): string[] {
  const subs = (subjects ?? []).slice(0, 40);
  if (!subs.length) return [];
  // A genre counts if it's among the main tags, or comes up more than once — one stray tag deep in the list
  // (a comic-book edition of a novel, say) isn't enough.
  const found = GENRES.filter((g) => subs.slice(0, 12).some((s) => g.test.test(s)) || subs.filter((s) => g.test.test(s)).length >= 2).map((g) => g.name);
  const saysNonFiction = subs.some((s) => /non-?fiction/i.test(s));
  const saysFiction = subs.some((s) => /fiction|novel/i.test(s.replace(/non-?fiction/gi, '')));
  if (saysNonFiction || !saysFiction) found.push(NON_FICTION);
  return found;
}
