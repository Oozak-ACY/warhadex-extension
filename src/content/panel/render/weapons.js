import { el } from './el.js';

const COLONNES = ['Arme', 'Portee', 'A', 'CT/CC', 'F', 'PA', 'D', 'Mots cles'];

function ligne(doc, weapon) {
  const valeurs = [
    weapon.name,
    weapon.range ?? '-',
    weapon.a ?? '-',
    weapon.skill ?? '-',
    weapon.s ?? '-',
    weapon.ap ?? '-',
    weapon.d ?? '-',
    weapon.keywords?.join(', ') || '-'
  ];
  return el(doc, 'tr', {}, valeurs.map((valeur) => el(doc, 'td', {}, valeur)));
}

function tableau(doc, titre, armes) {
  if (!armes.length) return null;
  return el(
    doc,
    'div',
    { class: 'wx-weapon-group' },
    el(doc, 'h3', {}, titre),
    el(
      doc,
      'table',
      { class: 'wx-table' },
      el(doc, 'thead', {}, el(doc, 'tr', {}, COLONNES.map((c) => el(doc, 'th', {}, c)))),
      el(doc, 'tbody', {}, armes.map((arme) => ligne(doc, arme)))
    )
  );
}

export function renderWeapons(doc, weapons) {
  if (!weapons?.length) return null;

  const tir = weapons.filter((weapon) => weapon.type === 'ranged');
  const melee = weapons.filter((weapon) => weapon.type !== 'ranged');

  const groupes = [tableau(doc, 'Armes de tir', tir), tableau(doc, 'Armes de melee', melee)].filter(Boolean);
  return groupes.length ? el(doc, 'section', { class: 'wx-weapons' }, groupes) : null;
}
