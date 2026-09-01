import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../src/core/api-client.js';
import { MSG, STATUS } from '../src/core/messages.js';
import {
  createResolver,
  toFailure,
  badgeState,
  CERTAIN_SCORE,
  NEGATIVE_TTL_MS,
  DAY_MS
} from '../src/background/resolver.js';
import { createBadge } from '../src/background/badge.js';

// Le seul etat non couvert ici est l enregistrement des ecouteurs dans
// service-worker.js, qui se contente de cabler ces fonctions.

function fakeCache() {
  const values = new Map();
  const writes = [];
  return {
    writes,
    seed(key, value) {
      values.set(key, value);
    },
    async get(key) {
      return values.get(key);
    },
    async set(key, value, ttlMs) {
      values.set(key, value);
      writes.push({ key, value, ttlMs });
    },
    async clear() {
      values.clear();
      writes.push({ key: null, value: null, ttlMs: null });
    }
  };
}

function fakeApi({ matches = [], character = { id: 'x', name: 'X' } } = {}) {
  const calls = { resolve: [], character: [] };
  return {
    calls,
    async resolve(name, site) {
      calls.resolve.push({ name, site });
      return matches;
    },
    async character(id) {
      calls.character.push(id);
      return typeof character === 'function' ? character(id) : character;
    }
  };
}

function setup({ matches, character, cacheTtlDays = 7 } = {}) {
  const api = fakeApi({ matches, character });
  const cache = fakeCache();
  const resolver = createResolver({ api, cache, getSettings: async () => ({ cacheTtlDays }) });
  return { api, cache, resolver };
}

// --- regle de certitude (spec section 5 : unique ET score qui depasse 0.8) ---

test('une correspondance unique au score superieur au seuil est certaine', async () => {
  const { api, resolver } = setup({
    matches: [{ id: 'marneus-calgar', score: 0.97 }],
    character: { id: 'marneus-calgar', name: 'Marneus Calgar' }
  });

  const result = await resolver.resolveName('marneus calgar', 'warhammer.com');

  assert.equal(result.status, STATUS.MATCH);
  assert.equal(result.character.name, 'Marneus Calgar');
  assert.deepEqual(api.calls.character, ['marneus-calgar']);
});

test('une correspondance unique au seuil exact n est pas certaine', async () => {
  const { api, resolver } = setup({ matches: [{ id: 'a', score: CERTAIN_SCORE }] });

  const result = await resolver.resolveName('a', 'warhammer.com');

  assert.equal(result.status, STATUS.AMBIGUOUS, 'depasser 0.8 veut dire strictement superieur');
  assert.equal(result.matches.length, 1);
  assert.deepEqual(api.calls.character, [], 'aucune fiche ne doit etre chargee sans certitude');
});

test('une correspondance unique au score faible propose un selecteur a une entree', async () => {
  const { api, resolver } = setup({ matches: [{ id: 'a', score: 0.05 }] });

  const result = await resolver.resolveName('a', 'warhammer.com');

  assert.equal(result.status, STATUS.AMBIGUOUS);
  assert.deepEqual(result.matches, [{ id: 'a', score: 0.05 }]);
  assert.deepEqual(api.calls.character, []);
});

test('plusieurs correspondances ne sont jamais certaines, meme au dessus du seuil', async () => {
  const { api, resolver } = setup({
    matches: [
      { id: 'a', score: 0.85 },
      { id: 'b', score: 0.84 },
      { id: 'c', score: 0.5 }
    ]
  });

  const result = await resolver.resolveName('a', 'warhammer.com');

  assert.equal(result.status, STATUS.AMBIGUOUS);
  assert.equal(result.matches.length, 3);
  assert.deepEqual(api.calls.character, []);
});

// --- cache et TTL ---

test('une resolution positive est memorisee avec le TTL des fiches', async () => {
  const { cache, resolver } = setup({ matches: [{ id: 'a', score: 0.99 }], cacheTtlDays: 3 });

  await resolver.resolveName('a', 'warhammer.com');

  const resolveWrite = cache.writes.find((write) => write.key === 'resolve:a');
  const characterWrite = cache.writes.find((write) => write.key === 'character:a');
  assert.equal(resolveWrite.ttlMs, 3 * DAY_MS);
  assert.equal(characterWrite.ttlMs, 3 * DAY_MS, 'la fiche suit le meme TTL configure');
});

test('une resolution vide est memorisee avec le TTL negatif et ne charge aucune fiche', async () => {
  const { api, cache, resolver } = setup({ matches: [] });

  const result = await resolver.resolveName('produit-inconnu', 'warhammer.com');

  assert.equal(result.status, STATUS.NOT_FOUND);
  assert.deepEqual(cache.writes, [{ key: 'resolve:produit-inconnu', value: [], ttlMs: NEGATIVE_TTL_MS }]);
  assert.equal(NEGATIVE_TTL_MS, 24 * 60 * 60 * 1000, 'le cache negatif tient vingt-quatre heures');
  assert.deepEqual(api.calls.character, []);
});

test('un TTL de fiche absent ou invalide retombe sur sept jours', async () => {
  const { cache, resolver } = setup({ matches: [{ id: 'a', score: 0.99 }], cacheTtlDays: 'nawak' });

  await resolver.resolveName('a', 'warhammer.com');

  assert.equal(cache.writes.find((write) => write.key === 'resolve:a').ttlMs, 7 * DAY_MS);
});

test('une resolution deja en cache ne rappelle pas l API', async () => {
  const { api, cache, resolver } = setup({ matches: [{ id: 'autre', score: 0.99 }] });
  cache.seed('resolve:a', [{ id: 'a', score: 0.99 }]);
  cache.seed('character:a', { id: 'a', name: 'Deja vu' });

  const result = await resolver.resolveName('a', 'warhammer.com');

  assert.equal(result.character.name, 'Deja vu');
  assert.deepEqual(api.calls.resolve, []);
  assert.deepEqual(api.calls.character, []);
  assert.deepEqual(cache.writes, [], 'rien ne doit etre reecrit quand tout vient du cache');
});

test('un cache negatif memorise evite un nouvel appel a l API', async () => {
  const { api, resolver, cache } = setup({ matches: [{ id: 'a', score: 0.99 }] });
  cache.seed('resolve:rien', []);

  const result = await resolver.resolveName('rien', 'warhammer.com');

  assert.equal(result.status, STATUS.NOT_FOUND);
  assert.deepEqual(api.calls.resolve, []);
});

// --- aiguillage des messages ---

test('handle route chaque type de message', async () => {
  const { api, cache, resolver } = setup({
    matches: [{ id: 'a', score: 0.99 }],
    character: { id: 'a', name: 'Alpha' }
  });

  const resolu = await resolver.handle({ type: MSG.RESOLVE, name: 'a', site: 'warhammer.com' });
  assert.equal(resolu.status, STATUS.MATCH);

  const fiche = await resolver.handle({ type: MSG.CHARACTER, id: 'b' });
  assert.equal(fiche.status, STATUS.MATCH);
  assert.equal(api.calls.character.at(-1), 'b');

  const vide = await resolver.handle({ type: MSG.CLEAR_CACHE });
  assert.equal(vide.status, STATUS.MATCH);
  assert.equal(cache.writes.at(-1).key, null, 'clear doit avoir ete appele');

  const inconnu = await resolver.handle({ type: 'warhadex:inexistant' });
  assert.equal(inconnu.status, STATUS.ERROR);
});

// --- traduction des erreurs ---

test('toFailure traduit chaque statut d ApiError', () => {
  assert.deepEqual(toFailure(new ApiError('not-configured', 'x')), { status: STATUS.NOT_CONFIGURED });
  assert.deepEqual(toFailure(new ApiError('offline', 'x')), { status: STATUS.OFFLINE });
  assert.deepEqual(toFailure(new ApiError('not-found', 'x')), { status: STATUS.NOT_FOUND });
  // 429 : pas de statut dedie dans l interface, on retombe sur l erreur generique
  assert.deepEqual(toFailure(new ApiError('rate-limited', 'x', 30)), { status: STATUS.ERROR });
  assert.deepEqual(toFailure(new ApiError('error', 'x')), { status: STATUS.ERROR });
});

test('toFailure traduit une erreur quelconque en erreur generique', () => {
  assert.deepEqual(toFailure(new TypeError('bug')), { status: STATUS.ERROR });
  assert.deepEqual(toFailure('pas une erreur'), { status: STATUS.ERROR });
});

// --- badge ---

test('badgeState traduit chaque statut de reponse', () => {
  assert.equal(badgeState(STATUS.MATCH), 'match');
  assert.equal(badgeState(STATUS.AMBIGUOUS), 'ambiguous');
  for (const status of [STATUS.NOT_FOUND, STATUS.NOT_CONFIGURED, STATUS.OFFLINE, STATUS.ERROR]) {
    assert.equal(badgeState(status), 'none', `statut mal traduit : ${status}`);
  }
});

test('setBadge applique le texte et la couleur de chaque etat', async () => {
  const appels = [];
  const setBadge = createBadge({
    async setBadgeText(args) {
      appels.push(['text', args]);
    },
    async setBadgeBackgroundColor(args) {
      appels.push(['color', args]);
    }
  });

  await setBadge(7, 'match');
  assert.deepEqual(appels[0], ['text', { tabId: 7, text: '1' }]);

  appels.length = 0;
  await setBadge(7, 'ambiguous');
  assert.deepEqual(appels[0], ['text', { tabId: 7, text: '?' }]);

  appels.length = 0;
  await setBadge(7, 'none');
  assert.deepEqual(appels[0], ['text', { tabId: 7, text: '' }]);

  appels.length = 0;
  await setBadge(7, 'etat-inconnu');
  assert.deepEqual(appels[0], ['text', { tabId: 7, text: '' }], 'un etat inconnu efface le badge');
});

test('setBadge avale l erreur quand l onglet a disparu', async () => {
  const setBadge = createBadge({
    async setBadgeText() {
      throw new Error('No tab with id: 7');
    },
    async setBadgeBackgroundColor() {}
  });

  await setBadge(7, 'match');
});
