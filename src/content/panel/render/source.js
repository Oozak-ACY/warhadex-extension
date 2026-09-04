import { el } from './el.js';
import { isSafeUrl } from './url.js';

// l extension n affiche que ce que sert l API de l utilisateur : l attribution
// de la source fait partie de ce contenu et doit etre rendue
export function renderSource(doc, character) {
  const source = character.source;
  const label = source?.label || source?.url;
  if (!label) return null;

  const contenu = isSafeUrl(source.url)
    ? el(doc, 'a', { href: source.url, target: '_blank', rel: 'noopener noreferrer' }, label)
    : el(doc, 'span', {}, label);

  return el(doc, 'footer', { class: 'wx-source' }, el(doc, 'span', {}, 'Source : '), contenu);
}
