import { el } from './el.js';

const STATS = [
  ['M', 'm'],
  ['T', 't'],
  ['SV', 'sv'],
  ['W', 'w'],
  ['LD', 'ld'],
  ['OC', 'oc']
];

function palier(entry) {
  const cout = `${entry.cost} pts`;
  if (typeof entry.models === 'number') {
    return `${entry.models} figurine${entry.models > 1 ? 's' : ''} ${cout}`;
  }
  return entry.label ? `${entry.label} ${cout}` : cout;
}

function points(doc, entries) {
  if (!entries?.length) return null;
  return el(doc, 'p', { class: 'wx-points' }, entries.map(palier).join(' | '));
}

// une unite peut porter plusieurs lignes de profil, un sergent et sa troupe par
// exemple : le nom n est affiche que s il y en a plus d une
function bloc(doc, profile, nomme) {
  const cases = STATS.map(([label, key]) =>
    el(
      doc,
      'div',
      { class: 'wx-stat' },
      el(doc, 'span', { class: 'wx-stat-label' }, label),
      el(doc, 'span', { class: 'wx-stat-value' }, profile?.[key] ?? '-')
    )
  );

  return el(
    doc,
    'div',
    { class: 'wx-profile' },
    nomme && profile.name ? el(doc, 'h4', { class: 'wx-profile-name' }, profile.name) : null,
    el(doc, 'div', { class: 'wx-stats' }, cases)
  );
}

export function renderDatasheet(doc, character) {
  const profiles = character.profiles ?? [];
  const nomme = profiles.length > 1;

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
    profiles.map((profile) => bloc(doc, profile, nomme)),
    character.invulnerable
      ? el(doc, 'p', { class: 'wx-invul' }, `Sauvegarde invulnerable ${character.invulnerable}`)
      : null,
    points(doc, character.points)
  );
}
