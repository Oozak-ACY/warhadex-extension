import { el } from './el.js';
import { t } from '../../../core/i18n.js';

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
    return `${t(entry.models > 1 ? 'pointsModels' : 'pointsModel', entry.models)} ${cout}`;
  }
  return entry.label ? `${entry.label} ${cout}` : cout;
}

function points(doc, entries) {
  if (!entries?.length) return null;
  return el(doc, 'p', { class: 'wx-points' }, entries.map(palier).join(' | '));
}

// l API sert 32mm, 90 x 52mm, 120 x 92mm flying base ou Use model pour un vehicule
// mesure depuis sa coque
export function libelleSocle(base, note) {
  const brut = String(base ?? '').trim();
  if (!brut) return null;

  let libelle;
  if (/^use model$/i.test(brut)) {
    libelle = t('baseNone');
  } else {
    const volant = /flying/i.test(brut);
    const ovale = brut.match(/^(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*mm/i);
    const rond = brut.match(/^(\d+(?:[.,]\d+)?)\s*mm/i);
    if (ovale) libelle = t(volant ? 'baseOvalFlying' : 'baseOval', ovale[1], ovale[2]);
    else if (rond) libelle = t(volant ? 'baseRoundFlying' : 'baseRound', rond[1]);
    else libelle = t('baseOther', brut);
  }

  const precision = String(note ?? '').trim();
  return precision ? `${libelle} (${precision})` : libelle;
}

// une unite peut porter plusieurs lignes de profil, un sergent et sa troupe par
// exemple : le nom n est affiche que s il y en a plus d une
function bloc(doc, profile, nomme) {
  const socle = libelleSocle(profile?.base, profile?.baseNote);
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
    el(doc, 'div', { class: 'wx-stats' }, cases),
    socle ? el(doc, 'p', { class: 'wx-base' }, socle) : null
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
      ? el(doc, 'p', { class: 'wx-invul' }, t('invulnerableSave', character.invulnerable))
      : null,
    points(doc, character.points)
  );
}
