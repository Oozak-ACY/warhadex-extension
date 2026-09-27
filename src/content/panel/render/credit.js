import { el } from './el.js';

export const WAHAPEDIA_URL = 'https://wahapedia.ru/';

// les donnees servies par l API proviennent de Wahapedia : on le credite partout
// ou le panneau montre d ou vient le contenu
export function renderCredit(doc) {
  return el(
    doc,
    'p',
    { class: 'wx-credit' },
    'Powered by ',
    el(doc, 'a', { href: WAHAPEDIA_URL, target: '_blank', rel: 'noopener noreferrer' }, 'Wahapedia')
  );
}
