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

// un motif de permission d hote ne porte jamais de port : il couvre deja tous
// les ports de l hote, et la grammaire Firefox interdit un port dans l hote
function motifOrigine(valeur) {
  const url = new URL(valeur);
  return `${url.protocol}//${url.hostname}/*`;
}

async function charger() {
  const reglages = await getSettings();
  form.apiBaseUrl.value = reglages.apiBaseUrl;
  // la cle integree n est pas affichee : l enregistrer depuis le champ la
  // recopierait dans storage.local comme si l utilisateur l avait choisie
  form.apiKey.value = reglages.apiKey === CLE_API_PAR_DEFAUT ? '' : reglages.apiKey;
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

  // la demande doit partir du geste utilisateur, donc avant toute attente.
  // localhost est declare en host_permissions : rien a demander dans le cas
  // courant, ou l utilisateur garde l API de reference
  let accorde;
  try {
    accorde =
      (await browser.permissions.contains({ origins: [origine] })) ||
      (await browser.permissions.request({ origins: [origine] }));
  } catch {
    // le navigateur refuse le motif : origine non couverte par
    // optional_host_permissions, ou schema non supporte
    afficher(`Le navigateur a refuse la demande de permission pour ${origine}`, true);
    return;
  }
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
