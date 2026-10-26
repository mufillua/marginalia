export interface LiteraryQuote {
  text: string;
  author: string;
  source: string;
}

/**
 * Public-domain lines about reading, with their sources. All were first
 * published before 1929.
 */
export const PUBLIC_DOMAIN_QUOTES: readonly LiteraryQuote[] = [
  {
    text: 'There is no Frigate like a Book\nTo take us Lands away',
    author: 'Emily Dickinson',
    source: 'poem, c. 1873',
  },
  {
    text: 'I declare after all there is no enjoyment like reading!',
    author: 'Jane Austen',
    source: 'Pride and Prejudice (1813)',
  },
  {
    text: 'Some books are to be tasted, others to be swallowed, and some few to be chewed and digested.',
    author: 'Francis Bacon',
    source: 'Of Studies (1625)',
  },
  {
    text: 'Books are the treasured wealth of the world and the fit inheritance of generations and nations.',
    author: 'Henry David Thoreau',
    source: 'Walden (1854)',
  },
  {
    text: 'The person, be it gentleman or lady, who has not pleasure in a good novel, must be intolerably stupid.',
    author: 'Jane Austen',
    source: 'Northanger Abbey (1817)',
  },
  {
    text: '“And what is the use of a book,” thought Alice, “without pictures or conversations?”',
    author: 'Lewis Carroll',
    source: 'Alice’s Adventures in Wonderland (1865)',
  },
  {
    text: 'I am no bird; and no net ensnares me.',
    author: 'Charlotte Brontë',
    source: 'Jane Eyre (1847)',
  },
  {
    text: 'How many a man has dated a new era in his life from the reading of a book.',
    author: 'Henry David Thoreau',
    source: 'Walden (1854)',
  },
];

/** Short lines written for Marginalia, used as greetings. */
export const MARGINALIA_LINES: readonly string[] = [
  'A little space for all the worlds you’ve visited.',
  'Every book you’ve loved, kept in one quiet place.',
  'Pages turned, thoughts kept, nothing lost.',
  'The margins are yours. Write in them.',
  'A home for the stories that stayed with you.',
];

/** Picks an item that changes once a day, so the page feels steady while you use it. */
export function pickForToday<T>(items: readonly T[], offset = 0, now = new Date()): T {
  const day = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86_400_000);
  return items[(day + offset) % items.length];
}
