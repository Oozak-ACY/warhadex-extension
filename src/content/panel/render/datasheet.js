import { el } from './el.js';

const STATS = [
  ['M', 'm'],
  ['T', 't'],
  ['SV', 'sv'],
  ['W', 'w'],
  ['LD', 'ld'],
  ['OC', 'oc']
];

function points(doc, entries) {
  if (!entries?.length) return null;
  const texte = entries.map((entry) => `${entry.models} figurine ${entry.cost} pts`).join(' | ');
  return el(doc, 'p', { class: 'wx-points' }, texte);
}

export function renderDatasheet(doc, character) {
  const cases = STATS.map(([label, key]) =>
    el(
      doc,
      'div',
      { class: 'wx-stat' },
      el(doc, 'span', { class: 'wx-stat-label' }, label),
      el(doc, 'span', { class: 'wx-stat-value' }, character.profile?.[key] ?? '-')
    )
  );

  return el(
    doc,
    'section',
    { class: 'wx-datasheet' },
    el(
      doc,
      'header',
      { class: 'wx-head' },
      el(doc, 'h2', {}, character.name),
      el(doc, 'p', { class: 'wx-sub' }, [character.faction, character.role].filter(Boolean).join(' - '))
    ),
    el(doc, 'div', { class: 'wx-stats' }, cases),
    character.invulnerable
      ? el(doc, 'p', { class: 'wx-invul' }, `Sauvegarde invulnerable ${character.invulnerable}`)
      : null,
    points(doc, character.points)
  );
}
