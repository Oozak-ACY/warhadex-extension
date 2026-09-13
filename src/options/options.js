import browser from '../vendor/browser.js';
import { getSettings, setSettings } from '../core/settings.js';
import { MSG } from '../core/messages.js';

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

  afficher('Reglages enregistres');
});

document.querySelector('#vider').addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: MSG.CLEAR_CACHE });
  afficher('Cache vide');
});

await charger();
