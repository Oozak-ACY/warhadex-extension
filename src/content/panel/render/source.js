import { el } from './el.js';
import { isSafeUrl } from './url.js';
import { renderCredit } from './credit.js';
import { t } from '../../../core/i18n.js';

// l extension n affiche que ce que sert l API de l utilisateur : l attribution
// de la source fait partie de ce contenu et doit etre rendue. Le credit du
// fournisseur de donnees l accompagne toujours, meme sans source sur la fiche
export function renderSource(doc, character) {
  const source = character.source;
  const label = source?.label || source?.url;

  const ligneSource = label
    ? el(
        doc,
        'p',
        { class: 'wx-source-line' },
        el(doc, 'span', {}, `${t('sourceLabel')} `),
        isSafeUrl(source.url)
          ? el(doc, 'a', { href: source.url, target: '_blank', rel: 'noopener noreferrer' }, label)
          : el(doc, 'span', {}, label)
      )
    : null;

  return el(doc, 'footer', { class: 'wx-source' }, ligneSource, renderCredit(doc));
}
