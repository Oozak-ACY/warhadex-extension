import browser from '../vendor/browser.js';

export const DEFAUT_API = 'http://localhost:8000';

export const DEFAULTS = {
  // l API de reference est locale : l extension fonctionne sans configuration
  apiBaseUrl: DEFAUT_API,
  apiKey: '',
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

export async function getSettings() {
  const [sync, local] = await Promise.all([
    browser.storage.sync.get(SYNC_KEYS),
    browser.storage.local.get(LOCAL_KEYS)
  ]);
  return { ...DEFAULTS, ...sync, ...local };
}

export async function setSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await Promise.all([
    browser.storage.sync.set(extraire(next, SYNC_KEYS)),
    browser.storage.local.set(extraire(next, LOCAL_KEYS))
  ]);
  return next;
}
