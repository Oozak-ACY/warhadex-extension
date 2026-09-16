import browser from '../vendor/browser.js';
import { detect } from './detect/index.js';
import { createPanel } from './panel/panel.js';
import { createLauncher } from './panel/launcher.js';
import { injecterPolices } from './panel/fonts.js';
import { LOGOS } from './panel/logos.js';
import { observeUrlChanges } from './spa-observer.js';
import { MSG, STATUS } from '../core/messages.js';
import { getSettings } from '../core/settings.js';

// duree maximale d observation du DOM en attente d une page client rendue
const OBSERVATION_MS = 10000;

let panel;
let launcher;
let dernier = null;
// nom detecte sur l URL precedente : sur une SPA le DOM change apres l URL, et
// relire le titre trop tot renvoie encore celui du produit qu on vient de quitter
let perime = null;
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
    const trouve = detect(document, location.href);
    if (!trouve) return;
    // le DOM porte encore le produit precedent : continuer d attendre
    if (perime && trouve.normalized === perime) return;
    annulerObservation();
    analyser({ reessayer: false });
  });

  // au bout du delai on accepte ce que la page montre, meme inchange : une
  // navigation peut legitimement revenir sur le meme produit
  const timer = window.setTimeout(() => {
    annulerObservation();
    if (perime === null) return;
    perime = null;
    analyser({ reessayer: false });
  }, OBSERVATION_MS);

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

async function chercherParNom(requete) {
  const reponse = await envoyer({ type: MSG.SEARCH, q: requete });
  if (!reponse) throw new Error('recherche indisponible');
  return reponse.matches ?? [];
}

async function ouvrirFiche(id) {
  const reponse = await envoyer({ type: MSG.CHARACTER, id });
  if (reponse?.status === STATUS.MATCH) panel.showCharacter(reponse.character);
  else panel.showState(reponse?.status ?? STATUS.ERROR);
}

function appliquer(reponse) {
  if (reponse.status === STATUS.MATCH) {
    // l accueil garde la trace de ce qui a ete detecte, pour que le retour ait
    // un sens meme quand la resolution etait certaine
    const fiche = reponse.character;
    panel.setHome([{ id: fiche.id, name: fiche.name, faction: fiche.faction }]);
    panel.showCharacter(fiche);
  } else if (reponse.status === STATUS.AMBIGUOUS) {
    panel.showMatches(reponse.matches);
  } else {
    panel.showState(reponse.status);
  }
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

  if (perime && trouve.normalized === perime) {
    // titre encore perime : ne rien afficher plutot que la fiche precedente
    if (reessayer) observerApparition();
    return;
  }

  perime = null;
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
    // une page produit sans personnage reconnu merite de le dire, contrairement
    // a une page sans produit du tout ou l extension reste muette
    // une page produit non reconnue est justement le cas ou la recherche
    // manuelle sert : on ouvre l accueil plutot qu un message seul
    panel.setHome([]);
    panel.showHome(STATUS.NOT_FOUND);
    launcher.show();
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

  injecterPolices(document, (chemin) => browser.runtime.getURL(chemin));

  panel = await createPanel({ doc: document, onSelect: ouvrirFiche, onSearch: chercherParNom });
  launcher = createLauncher({
    doc: document,
    onClick: () => panel.open(),
    iconUrl: browser.runtime.getURL(LOGOS.lanceur)
  });

  await analyser();
  observeUrlChanges(window, () => {
    annulerObservation();
    panel.close();
    panel.clear();
    launcher.hide();
    // ce qui etait affiche appartient a l URL qu on vient de quitter
    perime = dernier;
    dernier = null;
    analyser();
  });
}
