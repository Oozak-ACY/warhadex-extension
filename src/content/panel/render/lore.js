import { el } from './el.js';
import { isSafeUrl } from './url.js';

function livre(doc, book) {
  const detail = [book.author, book.year].filter(Boolean).join(', ');
  const titre = isSafeUrl(book.url)
    ? el(doc, 'a', { href: book.url, target: '_blank', rel: 'noopener noreferrer' }, book.title)
    : el(doc, 'span', {}, book.title);
  return el(doc, 'li', {}, titre, detail ? el(doc, 'span', { class: 'wx-book-meta' }, ` ${detail}`) : null);
}

export function renderLore(doc, character) {
  const books = character.books ?? [];
  if (!character.lore && !books.length) return null;

  return el(
    doc,
    'section',
    { class: 'wx-lore' },
    character.lore ? el(doc, 'h3', {}, 'Histoire') : null,
    character.lore ? el(doc, 'p', {}, character.lore) : null,
    books.length ? el(doc, 'h3', {}, 'Livres') : null,
    books.length ? el(doc, 'ul', { class: 'wx-books' }, books.map((book) => livre(doc, book))) : null
  );
}
