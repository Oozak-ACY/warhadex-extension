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

const { getSettings, setSettings, nettoyer, DEFAULTS, SYNC_KEYS, LOCAL_KEYS } = await import('../src/core/settings.js');

function vider() {
  sync.data.clear();
  local.data.clear();
}

test('la cle d API est la seule valeur stockee hors de storage.sync', () => {
  assert.deepEqual(LOCAL_KEYS, ['apiKey']);
  assert.deepEqual([...SYNC_KEYS].sort(), ['cacheTtlDays', 'showLauncher']);
  assert.deepEqual(Object.keys(DEFAULTS).sort(), [...SYNC_KEYS, ...LOCAL_KEYS].sort());
});

test('l adresse de l API n est pas un reglage', () => {
  assert.equal('apiBaseUrl' in DEFAULTS, false);
  assert.equal(SYNC_KEYS.includes('apiBaseUrl'), false);
});

test('getSettings rend les valeurs par defaut quand rien n est stocke', async () => {
  vider();
  assert.deepEqual(await getSettings(), DEFAULTS);
});

test('setSettings ecrit la cle d API dans local et le reste dans sync', async () => {
  vider();

  const next = await setSettings({ apiKey: 'secret', cacheTtlDays: 3, showLauncher: false });

  assert.equal(next.apiKey, 'secret');
  assert.deepEqual([...local.data.keys()], ['apiKey']);
  assert.equal(local.data.get('apiKey'), 'secret');
  assert.ok(!sync.data.has('apiKey'), 'la cle d API ne doit jamais atteindre storage.sync');
  assert.equal(sync.data.get('cacheTtlDays'), 3);
  assert.equal(sync.data.get('showLauncher'), false);
});

// Regression : du temps ou l adresse etait reglable, la page d options l enregistrait
// dans storage.sync. Une installation mise a jour la garde, elle ne doit plus ressortir
test('une adresse enregistree par une version precedente n est jamais exposee', async () => {
  vider();
  sync.data.set('apiBaseUrl', 'http://localhost:8000');

  assert.equal('apiBaseUrl' in (await getSettings()), false);
});

test('getSettings recompose les deux aires de maniere transparente', async () => {
  vider();
  sync.data.set('cacheTtlDays', 14);
  local.data.set('apiKey', 'secret');

  assert.deepEqual(await getSettings(), { ...DEFAULTS, cacheTtlDays: 14, apiKey: 'secret' });
});

test('setSettings partiel conserve les valeurs deja stockees dans l autre aire', async () => {
  vider();
  local.data.set('apiKey', 'secret');

  await setSettings({ cacheTtlDays: 14 });

  assert.equal(local.data.get('apiKey'), 'secret', 'la cle d API doit survivre a une mise a jour partielle');
  assert.equal(sync.data.get('cacheTtlDays'), 14);
});

// Teste la regle elle-meme plutot qu a travers getSettings : dans src la cle
// integree est vide, donc une cle vide stockee et le defaut seraient indistinguables
test('une cle vide n est pas un choix de l utilisateur', () => {
  assert.equal('apiKey' in nettoyer({ apiKey: '' }), false);
});

test('une cle saisie par l utilisateur est conservee', () => {
  assert.equal(nettoyer({ apiKey: 'la-mienne' }).apiKey, 'la-mienne');
});
