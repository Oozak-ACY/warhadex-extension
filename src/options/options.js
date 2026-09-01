import browser from '../vendor/browser.js';
import { getSettings, setSettings } from '../core/settings.js';
import { MSG } from '../core/messages.js';

const form = document.querySelector('#reglages');
const etat = document.querySelector('#etat');

function afficher(message, erreur = false) {
  etat.textContent = message;
  etat.dataset.erreur = String(erreur);
}

function motifOrigine(valeur) {
  return `${new URL(valeur).origin}/*`;
}

async function charger() {
  const reglages = await getSettings();
  form.apiBaseUrl.value = reglages.apiBaseUrl;
  form.apiKey.value = reglages.apiKey;
  form.cacheTtlDays.value = reglages.cacheTtlDays;
  form.showLauncher.checked = reglages.showLauncher;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  let origine;
  try {
    origine = motifOrigine(form.apiBaseUrl.value);
  } catch {
    afficher('Adresse invalide', true);
    return;
  }

  // la demande doit partir du geste utilisateur, donc avant toute attente
  const accorde = await browser.permissions.request({ origins: [origine] });
  if (!accorde) {
    afficher('Permission refusee, Warhadex ne pourra pas joindre votre API', true);
    return;
  }

  await setSettings({
    apiBaseUrl: form.apiBaseUrl.value.trim(),
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
