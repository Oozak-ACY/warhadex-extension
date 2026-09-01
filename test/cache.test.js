import test from 'node:test';
import assert from 'node:assert/strict';
import { createCache } from '../src/core/cache.js';

// storage.local reel : get(null) rend tout, remove accepte une cle ou un tableau
function fakeStorage() {
  const data = new Map();
  return {
    async get(key) {
      if (key === null || key === undefined) return Object.fromEntries(data);
      return data.has(key) ? { [key]: data.get(key) } : {};
    },
    async set(entries) {
      for (const [key, value] of Object.entries(entries)) data.set(key, value);
    },
    async remove(key) {
      for (const one of Array.isArray(key) ? key : [key]) data.delete(one);
    },
    async clear() {
      data.clear();
    },
    keys: () => [...data.keys()],
    size: () => data.size
  };
}

test('rendre une valeur stockee avant expiration', async () => {
  let clock = 1000;
  const storage = fakeStorage();
  const cache = createCache({ storage, now: () => clock });

  await cache.set('a', { name: 'Calgar' }, 5000);
  clock = 4000;
  assert.deepEqual(await cache.get('a'), { name: 'Calgar' });
});

test('rendre undefined et purger apres expiration', async () => {
  let clock = 1000;
  const storage = fakeStorage();
  const cache = createCache({ storage, now: () => clock });

  await cache.set('a', { name: 'Calgar' }, 5000);
  clock = 6001;
  assert.equal(await cache.get('a'), undefined);
  assert.equal(storage.size(), 0);
});

test('distinguer une valeur null memorisee d une absence', async () => {
  const storage = fakeStorage();
  const cache = createCache({ storage, now: () => 0 });

  await cache.set('vide', null, 1000);
  assert.equal(await cache.get('vide'), null);
  assert.equal(await cache.get('jamais-ecrit'), undefined);
});

test('vider entierement le cache', async () => {
  const storage = fakeStorage();
  const cache = createCache({ storage, now: () => 0 });

  await cache.set('a', 1, 1000);
  await cache.set('b', 2, 1000);
  await cache.clear();
  assert.equal(await cache.get('a'), undefined);
  assert.equal(await cache.get('b'), undefined);
});

// Regression: storage.local ne contient pas que le cache, la cle d API y vit aussi.
// Un clear() global effacerait la configuration de l utilisateur.
test('vider le cache epargne les entrees non prefixees', async () => {
  const storage = fakeStorage();
  const cache = createCache({ storage, now: () => 0 });

  await storage.set({ apiKey: 'secret' });
  await cache.set('a', 1, 1000);
  await cache.clear();

  assert.deepEqual(storage.keys(), ['apiKey'], 'seules les entrees prefixees doivent disparaitre');
});
