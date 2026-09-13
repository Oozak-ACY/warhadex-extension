import test from 'node:test';
import assert from 'node:assert/strict';

// vendor/browser.js lie globalThis.browser au premier import du processus : le stub
// doit exister avant d importer settings.js, et seules ses feuilles sont remplacees.
function aire() {
  const data = new Map();
  return {
    data,
    async get(keys) {
      if (keys === null || keys === undefined) return Object.fromEntries(data);
      const asked = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(asked.filter((key) => data.has(key)).map((key) => [key, data.get(key)]));
    },
    async set(entries) {
      for (const [key, value] of Object.entries(entries)) data.set(key, value);
    }
  };
}

const sync = aire();
const local = aire();
globalThis.browser = { storage: { sync, local } };

const { getSettings, setSettings, DEFAULTS, SYNC_KEYS } = await import('../src/core/settings.js');

function vider() {
  sync.data.clear();
  local.data.clear();
}

test('seuls les reglages d affichage sont des reglages', () => {
  assert.deepEqual([...SYNC_KEYS].sort(), ['cacheTtlDays', 'showLauncher']);
  assert.equal('apiBaseUrl' in DEFAULTS, false);
  assert.equal('apiKey' in DEFAULTS, false);
});

test('getSettings rend les valeurs par defaut quand rien n est stocke', async () => {
  vider();
  assert.deepEqual(await getSettings(), DEFAULTS);
});

test('setSettings ecrit dans storage.sync et jamais dans storage.local', async () => {
  vider();

  const next = await setSettings({ cacheTtlDays: 3, showLauncher: false });

  assert.equal(next.cacheTtlDays, 3);
  assert.equal(sync.data.get('cacheTtlDays'), 3);
  assert.equal(sync.data.get('showLauncher'), false);
  assert.equal(local.data.size, 0);
});

test('setSettings partiel conserve les autres reglages', async () => {
  vider();
  sync.data.set('showLauncher', false);

  await setSettings({ cacheTtlDays: 14 });

  assert.equal(sync.data.get('cacheTtlDays'), 14);
  assert.equal(sync.data.get('showLauncher'), false);
});

// Regression : l adresse puis la cle etaient reglables, et une installation mise a
// jour les garde dans le stockage. Elles ne doivent plus jamais ressortir
test('une adresse ou une cle enregistree par une version precedente n est jamais exposee', async () => {
  vider();
  sync.data.set('apiBaseUrl', 'http://localhost:8000');
  local.data.set('apiKey', 'ancienne-cle');

  const reglages = await getSettings();
  assert.equal('apiBaseUrl' in reglages, false);
  assert.equal('apiKey' in reglages, false);
});
