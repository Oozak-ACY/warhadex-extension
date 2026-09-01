import browser from '../vendor/browser.js';
import { detect } from './detect/index.js';
import { createPanel } from './panel/panel.js';
import { createLauncher } from './panel/launcher.js';
import { observeUrlChanges } from './spa-observer.js';
import { MSG, STATUS } from '../core/messages.js';
import { getSettings } from '../core/settings.js';

// duree maximale d observation du DOM en attente d une page client rendue
const OBSERVATION_MS = 10000;

let panel;
let launcher;
let dernier = null;
let arreterObservation = null;

// les reponses qui ne tranchent pas sur ce produit precis desarment le garde-fou
// de deduplication, pour qu une nouvelle detection puisse reessayer
const NON_DEFINITIFS = new Set([STATUS.OFFLINE, STATUS.ERROR, STATUS.NOT_CONFIGURED]);

function annulerObservation() {
  if (!arreterObservation) return;
  arreterObservation();
  arreterObservation = null;
}

// warhammer.com est une SPA React : le titre du produit n existe pas forcement
// dans le DOM a document_idle. On observe brievement le body, puis on abandonne
function observerApparition() {
  annulerObservation();

  const observer = new window.MutationObserver(() => {
    if (!detect(document, location.href)) return;
    annulerObservation();
    analyser({ reessayer: false });
  });
  const timer = window.setTimeout(annulerObservation, OBSERVATION_MS);

  arreterObservation = () => {
    observer.disconnect();
    window.clearTimeout(timer);
  };
  observer.observe(document.body, { childList: true, subtree: true });
}

async function envoyer(message) {
  try {
    return await browser.runtime.sendMessage(message);
  } catch {
    // service worker endormi ou contexte invalide : pas de fuite de rejet non gere
    return undefined;
  }
}

async function ouvrirFiche(id) {
  const reponse = await envoyer({ type: MSG.CHARACTER, id });
  if (reponse?.status === STATUS.MATCH) panel.showCharacter(reponse.character);
  else panel.showState(reponse?.status ?? STATUS.ERROR);
}

function appliquer(reponse) {
  if (reponse.status === STATUS.MATCH) panel.showCharacter(reponse.character);
  else if (reponse.status === STATUS.AMBIGUOUS) panel.showMatches(reponse.matches);
  else panel.showState(reponse.status);
}

async function analyser({ reessayer = true } = {}) {
  const trouve = detect(document, location.href);

  if (!trouve) {
    dernier = null;
    launcher.hide();
    // le badge de l onglet resterait sinon fige sur la page produit precedente
    await envoyer({ type: MSG.CLEAR_BADGE });
    if (reessayer) observerApparition();
    return;
  }

  annulerObservation();
  if (trouve.normalized === dernier) return;
  dernier = trouve.normalized;

  let reponse;
  try {
    reponse = await browser.runtime.sendMessage({
      type: MSG.RESOLVE,
      name: trouve.normalized,
      site: trouve.site
    });
  } catch {
    // service worker endormi ou contexte invalide : ce n est pas une reponse
    // definitive, donc on desarme le garde-fou pour permettre une nouvelle tentative
    dernier = null;
    panel.showState(STATUS.ERROR);
    launcher.show();
    return;
  }

  if (!reponse) {
    // reponse absente : ce n est pas une reponse definitive sur ce produit
    // (cross-browser : Firefox/Safari peuvent resoudre undefined sans rejeter)
    // et rien n a ete ecrit dans le panneau, donc le lanceur reste masque
    dernier = null;
    launcher.hide();
    return;
  }

  if (reponse.status === STATUS.NOT_FOUND) {
    launcher.hide();
    return;
  }

  if (NON_DEFINITIFS.has(reponse.status)) dernier = null;

  // le lanceur apparait des que le panneau a quelque chose a dire, erreurs
  // comprises : une erreur que l utilisateur ne peut pas ouvrir est pire
  appliquer(reponse);
  launcher.show();
}

export async function start() {
  const { showLauncher } = await getSettings();
  if (!showLauncher) return;

  panel = await createPanel({ doc: document, onSelect: ouvrirFiche });
  launcher = createLauncher({ doc: document, onClick: () => panel.open() });

  await analyser();
  observeUrlChanges(window, () => {
    annulerObservation();
    panel.close();
    analyser();
  });
}
