import browser from '../vendor/browser.js';
import { getSettings, setSettings } from '../core/settings.js';
import { MSG } from '../core/messages.js';
import { t, langue } from '../core/i18n.js';

// le HTML porte l anglais par defaut, remplace ici par la langue du navigateur
document.documentElement.lang = langue();
for (const noeud of document.querySelectorAll('[data-i18n]')) {
  noeud.textContent = t(noeud.dataset.i18n);
}

const form = document.querySelector('#reglages');
const etat = document.querySelector('#etat');

function afficher(message, erreur = false) {
  etat.textContent = message;
  etat.dataset.erreur = String(erreur);
}

async function charger() {
  const reglages = await getSettings();
  form.cacheTtlDays.value = reglages.cacheTtlDays;
  form.showLauncher.checked = reglages.showLauncher;
}

// l API et sa cle sont integrees : il ne reste que les reglages d affichage
form.addEventListener('submit', async (event) => {
  event.preventDefault();

  await setSettings({
    cacheTtlDays: Number(form.cacheTtlDays.value),
    showLauncher: form.showLauncher.checked
  });

  afficher(t('optionsSaved'));
});

document.querySelector('#vider').addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: MSG.CLEAR_CACHE });
  afficher(t('optionsCacheCleared'));
});

await charger();
