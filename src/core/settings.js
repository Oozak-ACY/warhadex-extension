import browser from '../vendor/browser.js';

export const DEFAULTS = {
  apiBaseUrl: '',
  apiKey: '',
  showLauncher: true,
  cacheTtlDays: 7
};

export async function getSettings() {
  const stored = await browser.storage.sync.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...stored };
}

export async function setSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await browser.storage.sync.set(next);
  return next;
}
