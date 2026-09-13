import browser from '../vendor/browser.js';
import { CLE_API_PAR_DEFAUT } from './config.js';

export const DEFAUT_API = 'https://warhadex-api.orion-sphere.fr';
// adresse par defaut des versions precedentes : un reglage qui la porte encore n a
// jamais ete personnalise, il a juste ete enregistre tel quel depuis les options
export const ANCIEN_DEFAUT_API = 'http://localhost:8000';

export const DEFAULTS = {
  apiBaseUrl: DEFAUT_API,
  apiKey: CLE_API_PAR_DEFAUT,
  showLauncher: true,
  cacheTtlDays: 7
};

// la cle d API ne va jamais dans storage.sync : ce serait la televerser vers le
// service de synchronisation du navigateur
export const LOCAL_KEYS = ['apiKey'];
export const SYNC_KEYS = Object.keys(DEFAULTS).filter((key) => !LOCAL_KEYS.includes(key));

function extraire(source, keys) {
  return Object.fromEntries(keys.map((key) => [key, source[key]]));
}

// Une valeur vide ou l ancien defaut ne sont pas des choix de l utilisateur : les
// laisser ecraser le defaut enverrait une extension a jour sur localhost, ou sans
// cle des que le champ des options a ete enregistre vide
export function nettoyer(sync, local) {
  const propreSync = { ...sync };
  if (!propreSync.apiBaseUrl || propreSync.apiBaseUrl === ANCIEN_DEFAUT_API) delete propreSync.apiBaseUrl;

  const propreLocal = { ...local };
  if (!propreLocal.apiKey) delete propreLocal.apiKey;

  return { propreSync, propreLocal };
}

export async function getSettings() {
  const [sync, local] = await Promise.all([
    browser.storage.sync.get(SYNC_KEYS),
    browser.storage.local.get(LOCAL_KEYS)
  ]);
  const { propreSync, propreLocal } = nettoyer(sync, local);
  return { ...DEFAULTS, ...propreSync, ...propreLocal };
}

export async function setSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await Promise.all([
    browser.storage.sync.set(extraire(next, SYNC_KEYS)),
    browser.storage.local.set(extraire(next, LOCAL_KEYS))
  ]);
  return next;
}
