import browser from '../vendor/browser.js';
import { detect } from './detect/index.js';
import { createPanel } from './panel/panel.js';
import { createLauncher } from './panel/launcher.js';
import { observeUrlChanges } from './spa-observer.js';
import { MSG, STATUS } from '../core/messages.js';
import { getSettings } from '../core/settings.js';

let panel;
let launcher;
let dernier = null;

async function ouvrirFiche(id) {
  let reponse;
  try {
    reponse = await browser.runtime.sendMessage({ type: MSG.CHARACTER, id });
  } catch {
    // service worker endormi ou contexte invalide : pas de fuite de rejet non gere
    panel.showState(STATUS.ERROR);
    return;
  }
  if (reponse?.status === STATUS.MATCH) panel.showCharacter(reponse.character);
  else panel.showState(reponse?.status ?? STATUS.ERROR);
}

function appliquer(reponse) {
  if (reponse.status === STATUS.MATCH) panel.showCharacter(reponse.character);
  else if (reponse.status === STATUS.AMBIGUOUS) panel.showMatches(reponse.matches);
  else panel.showState(reponse.status);
}

async function analyser() {
  const trouve = detect(document, location.href);

  if (!trouve) {
    dernier = null;
    launcher.hide();
    return;
  }
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
    launcher.hide();
    panel.showState(STATUS.ERROR);
    return;
  }

  if (!reponse) {
    // reponse absente : ce n est pas une reponse definitive sur ce produit
    // (cross-browser : Firefox/Safari peuvent resoudre undefined sans rejeter)
    dernier = null;
    launcher.hide();
    return;
  }

  if (reponse.status === STATUS.NOT_FOUND) {
    launcher.hide();
    return;
  }

  // OFFLINE et ERROR ne sont pas des reponses definitives sur ce produit :
  // on desarme le garde-fou pour qu une prochaine navigation SPA reessaie
  if (reponse.status === STATUS.OFFLINE || reponse.status === STATUS.ERROR) {
    dernier = null;
  }

  launcher.show();
  appliquer(reponse);
}

export async function start() {
  const { showLauncher } = await getSettings();
  if (!showLauncher) return;

  panel = await createPanel({ doc: document, onSelect: ouvrirFiche });
  launcher = createLauncher({ doc: document, onClick: () => panel.open() });

  await analyser();
  observeUrlChanges(window, () => {
    panel.close();
    analyser();
  });
}
