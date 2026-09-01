import { el } from './el.js';

export function renderAbilities(doc, character) {
  const abilities = character.abilities ?? [];
  const keywords = character.keywords ?? [];
  if (!abilities.length && !keywords.length) return null;

  return el(
    doc,
    'section',
    { class: 'wx-abilities' },
    abilities.length ? el(doc, 'h3', {}, 'Aptitudes') : null,
    abilities.map((ability) =>
      el(
        doc,
        'div',
        { class: 'wx-ability' },
        el(doc, 'h4', {}, ability.name),
        el(doc, 'p', {}, ability.text ?? '')
      )
    ),
    keywords.length ? el(doc, 'h3', {}, 'Mots cles') : null,
    keywords.length
      ? el(doc, 'ul', { class: 'wx-keywords' }, keywords.map((keyword) => el(doc, 'li', {}, keyword)))
      : null
  );
}
