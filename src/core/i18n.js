// Les textes vivent dans _locales : le navigateur choisit la langue de
// l utilisateur et retombe sur default_locale (anglais) sinon.
// L API est resolue a chaque appel et non a l import, comme le fait
// vendor/browser.js : Chrome n expose pas browser, et les tests installent leur
// stub apres coup
function api() {
  return globalThis.browser?.i18n ?? globalThis.chrome?.i18n;
}

export function t(cle, ...substitutions) {
  const message = api()?.getMessage(cle, substitutions.map(String));
  // une cle absente rend une chaine vide : mieux vaut afficher la cle que rien
  return message || cle;
}

export function langue() {
  return api()?.getUILanguage?.() ?? 'en';
}
