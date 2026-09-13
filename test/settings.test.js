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

const { getSettings, setSettings, nettoyer, DEFAULTS, SYNC_KEYS, LOCAL_KEYS, DEFAUT_API, ANCIEN_DEFAUT_API } =
  await import('../src/core/settings.js');

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

// --- API de production et migration des reglages enregistres ---

test('l adresse par defaut est l API de production', () => {
  assert.equal(DEFAUT_API, 'https://warhadex-api.orion-sphere.fr');
  assert.equal(DEFAULTS.apiBaseUrl, DEFAUT_API);
});

// Regression : la page d options enregistre l objet complet, defaut compris. Une
// installation qui avait clique Enregistrer du temps de localhost garde donc
// http://localhost:8000 dans storage.sync, et resterait bloquee dessus apres mise a jour
test('l ancien defaut localhost enregistre n ecrase pas la nouvelle adresse', async () => {
  sync.data.clear();
  local.data.clear();
  sync.data.set('apiBaseUrl', ANCIEN_DEFAUT_API);

  assert.equal((await getSettings()).apiBaseUrl, DEFAUT_API);
});

test('une adresse personnalisee reste prioritaire sur le defaut', async () => {
  sync.data.clear();
  local.data.clear();
  sync.data.set('apiBaseUrl', 'https://mon-api.exemple.fr');

  assert.equal((await getSettings()).apiBaseUrl, 'https://mon-api.exemple.fr');
});

// Teste la regle elle-meme plutot qu a travers getSettings : dans src la cle
// integree est vide, donc une cle vide stockee et le defaut seraient indistinguables
test('une cle vide ou l ancien defaut ne sont pas des choix de l utilisateur', () => {
  const { propreSync, propreLocal } = nettoyer(
    { apiBaseUrl: ANCIEN_DEFAUT_API, cacheTtlDays: 3 },
    { apiKey: '' }
  );

  assert.equal('apiBaseUrl' in propreSync, false, 'l ancien defaut doit ceder la place');
  assert.equal(propreSync.cacheTtlDays, 3, 'les autres reglages sont conserves');
  assert.equal('apiKey' in propreLocal, false, 'une cle vide doit laisser place a la cle integree');
});

test('une cle saisie par l utilisateur est conservee', () => {
  const { propreLocal } = nettoyer({}, { apiKey: 'la-mienne' });
  assert.equal(propreLocal.apiKey, 'la-mienne');
});
