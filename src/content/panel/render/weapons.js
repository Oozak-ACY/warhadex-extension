import { el } from './el.js';
import { t } from '../../../core/i18n.js';

// cles de _locales, resolues au rendu
const COLONNES = [
  'columnWeapon',
  'columnRange',
  'columnAttacks',
  'columnSkill',
  'columnStrength',
  'columnPenetration',
  'columnDamage',
  'columnKeywords'
];

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
      el(doc, 'thead', {}, el(doc, 'tr', {}, COLONNES.map((c) => el(doc, 'th', {}, t(c))))),
      el(doc, 'tbody', {}, armes.map((arme) => ligne(doc, arme)))
    )
  );
}

export function renderWeapons(doc, weapons) {
  if (!weapons?.length) return null;

  const tir = weapons.filter((weapon) => weapon.type === 'ranged');
  const melee = weapons.filter((weapon) => weapon.type !== 'ranged');

  const groupes = [tableau(doc, t('weaponsRanged'), tir), tableau(doc, t('weaponsMelee'), melee)].filter(Boolean);
  return groupes.length ? el(doc, 'section', { class: 'wx-weapons' }, groupes) : null;
}
