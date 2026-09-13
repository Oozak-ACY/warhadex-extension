import browser from '../vendor/browser.js';

// Ni l adresse de l API ni sa cle ne sont des reglages : l extension ne parle qu a
// warhadex-api, avec la cle integree au build. Une adresse ou une cle enregistree
// par une version precedente reste dans le stockage mais n est plus jamais lue
export const DEFAULTS = {
  showLauncher: true,
  cacheTtlDays: 7
};

export const SYNC_KEYS = Object.keys(DEFAULTS);

export async function getSettings() {
  const sync = await browser.storage.sync.get(SYNC_KEYS);
  return { ...DEFAULTS, ...sync };
}

export async function setSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await browser.storage.sync.set(Object.fromEntries(SYNC_KEYS.map((key) => [key, next[key]])));
  return next;
}
