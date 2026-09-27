import { readFileSync } from 'node:fs';

export function lireMessages(locale) {
  return JSON.parse(readFileSync(new URL(`../../src/_locales/${locale}/messages.json`, import.meta.url), 'utf8'));
}

// reproduit getMessage des navigateurs : placeholders nommes $NOM$ puis
// substitutions positionnelles $1, $2
export function stubI18n(locale = 'en') {
  const messages = lireMessages(locale);
  return {
    getUILanguage: () => locale,
    getMessage(cle, substitutions = []) {
      const entree = messages[cle];
      if (!entree) return '';
      const positionnel = (texte) => texte.replace(/\$(\d)/g, (_, n) => substitutions[n - 1] ?? '');
      return entree.message.replace(/\$([A-Za-z0-9_]+)\$/g, (_, nom) => {
        const contenu = entree.placeholders?.[nom.toLowerCase()]?.content;
        return contenu === undefined ? '' : positionnel(contenu);
      });
    }
  };
}

// src/core/i18n.js retombe sur chrome.i18n quand le stub browser n a pas d i18n :
// les tests peuvent ainsi remplacer globalThis.browser sans perdre les textes
export function installerI18n(locale = 'en') {
  globalThis.chrome = { ...globalThis.chrome, i18n: stubI18n(locale) };
}
