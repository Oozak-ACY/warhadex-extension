import browser from '../vendor/browser.js';
import { getSettings, setSettings } from '../core/settings.js';
import { CLE_API_PAR_DEFAUT } from '../core/config.js';
import { MSG } from '../core/messages.js';

const form = document.querySelector('#reglages');
const etat = document.querySelector('#etat');

function afficher(message, erreur = false) {
  etat.textContent = message;
  etat.dataset.erreur = String(erreur);
}

async function charger() {
  const reglages = await getSettings();
  // la cle integree n est pas affichee : l enregistrer depuis le champ la
  // recopierait dans storage.local comme si l utilisateur l avait choisie
  form.apiKey.value = reglages.apiKey === CLE_API_PAR_DEFAUT ? '' : reglages.apiKey;
  form.cacheTtlDays.value = reglages.cacheTtlDays;
  form.showLauncher.checked = reglages.showLauncher;
}

// l API est fixe et accordee a l installation : rien a demander au navigateur
form.addEventListener('submit', async (event) => {
  event.preventDefault();

  await setSettings({
    apiKey: form.apiKey.value,
    cacheTtlDays: Number(form.cacheTtlDays.value),
    showLauncher: form.showLauncher.checked
  });

  afficher('Reglages enregistres');
});

document.querySelector('#vider').addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: MSG.CLEAR_CACHE });
  afficher('Cache vide');
});

await charger();
