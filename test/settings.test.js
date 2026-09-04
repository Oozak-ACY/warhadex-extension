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

const { getSettings, setSettings, DEFAULTS, SYNC_KEYS, LOCAL_KEYS } = await import('../src/core/settings.js');

test('la cle d API est la seule valeur stockee hors de storage.sync', () => {
  assert.deepEqual(LOCAL_KEYS, ['apiKey']);
  assert.deepEqual(SYNC_KEYS.sort(), ['apiBaseUrl', 'cacheTtlDays', 'showLauncher']);
  assert.deepEqual(Object.keys(DEFAULTS).sort(), [...SYNC_KEYS, ...LOCAL_KEYS].sort());
});

test('getSettings rend les valeurs par defaut quand rien n est stocke', async () => {
  sync.data.clear();
  local.data.clear();
  assert.deepEqual(await getSettings(), DEFAULTS);
});

test('setSettings ecrit la cle d API dans local et le reste dans sync', async () => {
  sync.data.clear();
  local.data.clear();

  const next = await setSettings({
    apiBaseUrl: 'https://api.exemple.fr',
    apiKey: 'secret',
    cacheTtlDays: 3,
    showLauncher: false
  });

  assert.equal(next.apiKey, 'secret');
  assert.deepEqual([...local.data.keys()], ['apiKey']);
  assert.equal(local.data.get('apiKey'), 'secret');
  assert.ok(!sync.data.has('apiKey'), 'la cle d API ne doit jamais atteindre storage.sync');
  assert.equal(sync.data.get('apiBaseUrl'), 'https://api.exemple.fr');
  assert.equal(sync.data.get('cacheTtlDays'), 3);
  assert.equal(sync.data.get('showLauncher'), false);
});

test('getSettings recompose les deux aires de maniere transparente', async () => {
  sync.data.clear();
  local.data.clear();
  sync.data.set('apiBaseUrl', 'https://api.exemple.fr');
  local.data.set('apiKey', 'secret');

  assert.deepEqual(await getSettings(), {
    ...DEFAULTS,
    apiBaseUrl: 'https://api.exemple.fr',
    apiKey: 'secret'
  });
});

test('setSettings partiel conserve les valeurs deja stockees dans l autre aire', async () => {
  sync.data.clear();
  local.data.clear();
  local.data.set('apiKey', 'secret');

  await setSettings({ cacheTtlDays: 14 });

  assert.equal(local.data.get('apiKey'), 'secret', 'la cle d API doit survivre a une mise a jour partielle');
  assert.equal(sync.data.get('cacheTtlDays'), 14);
});
