import browser from '../vendor/browser.js';
import { CLE_API_PAR_DEFAUT } from './config.js';

// L adresse de l API n est pas un reglage : l extension ne parle qu a warhadex-api,
// fixee dans api-client.js. Une adresse enregistree par une version precedente
// reste dans storage.sync mais n est plus jamais lue
export const DEFAULTS = {
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

// Une cle vide n est pas un choix de l utilisateur : la laisser ecraser le defaut
// priverait l extension de sa cle integree des que le champ est enregistre vide
export function nettoyer(local) {
  const propre = { ...local };
  if (!propre.apiKey) delete propre.apiKey;
  return propre;
}

export async function getSettings() {
  const [sync, local] = await Promise.all([
    browser.storage.sync.get(SYNC_KEYS),
    browser.storage.local.get(LOCAL_KEYS)
  ]);
  return { ...DEFAULTS, ...sync, ...nettoyer(local) };
}

export async function setSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await Promise.all([
    browser.storage.sync.set(extraire(next, SYNC_KEYS)),
    browser.storage.local.set(extraire(next, LOCAL_KEYS))
  ]);
  return next;
}
