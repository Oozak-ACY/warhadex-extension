import { el } from './el.js';
import { t } from '../../../core/i18n.js';

// Wahapedia liste les aptitudes de faction et de coeur en nom seul sur la fiche,
// et renvoie leur texte aux regles de faction. Leur texte est ici utile mais
// generique et volumineux : Leader pese trois mille caracteres et figure sur
// presque chaque personnage. Deplie, il noie l aptitude propre au modele, qui
// est celle qu on veut lire sur une page d achat
const REPLIABLES = new Set(['Core', 'Faction']);

function aptitude(doc, ability) {
  const titre = ability.type ? `${ability.name} (${ability.type})` : ability.name;

  if (!ability.text) return el(doc, 'div', { class: 'wx-ability' }, el(doc, 'h4', {}, titre));

  if (REPLIABLES.has(ability.type)) {
    return el(
      doc,
      'details',
      { class: 'wx-ability' },
      el(doc, 'summary', {}, titre),
      el(doc, 'p', {}, ability.text)
    );
  }

  return el(
    doc,
    'div',
    { class: 'wx-ability' },
    el(doc, 'h4', {}, ability.name),
    el(doc, 'p', {}, ability.text)
  );
}

export function renderAbilities(doc, character) {
  const abilities = character.abilities ?? [];
  const keywords = character.keywords ?? [];
  if (!abilities.length && !keywords.length) return null;

  return el(
    doc,
    'section',
    { class: 'wx-abilities' },
    abilities.length ? el(doc, 'h3', {}, t('abilitiesTitle')) : null,
    abilities.map((ability) => aptitude(doc, ability)),
    keywords.length ? el(doc, 'h3', {}, t('keywordsTitle')) : null,
    keywords.length
      ? el(doc, 'ul', { class: 'wx-keywords' }, keywords.map((keyword) => el(doc, 'li', {}, keyword)))
      : null
  );
}
