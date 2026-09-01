import test from 'node:test';
import assert from 'node:assert/strict';
import { createCache } from '../src/core/cache.js';

function fakeStorage() {
  const data = new Map();
  return {
    async get(key) {
      return data.has(key) ? { [key]: data.get(key) } : {};
    },
    async set(entries) {
      for (const [key, value] of Object.entries(entries)) data.set(key, value);
    },
    async remove(key) {
      data.delete(key);
    },
    async clear() {
      data.clear();
    },
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
  await cache.clear();
  assert.equal(await cache.get('a'), undefined);
});
