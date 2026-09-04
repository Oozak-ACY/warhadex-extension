import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient, ApiError } from '../src/core/api-client.js';
import { startServer } from '../mock-api/server.mjs';

function clientFor(url, extra = {}) {
  return createApiClient({
    getSettings: async () => ({ apiBaseUrl: url, apiKey: '', ...extra })
  });
}

test('resolve retourne les correspondances du serveur', async () => {
  const server = await startServer({ port: 0 });
  const client = clientFor(server.url);

  const matches = await client.resolve('marneus calgar in armour of antilochus');
  assert.equal(matches[0].id, '000004183');
  assert.equal(matches[0].name, 'Marneus Calgar in Armour of Antilochus');
  // les scores de l API sont sur 100, le client les ramene sur 1
  assert.equal(matches[0].score, 1);

  await server.close();
});

test('character retourne la fiche complete', async () => {
  const server = await startServer({ port: 0 });
  const client = clientFor(server.url);

  const agregat = await client.character('000001157');
  assert.equal(agregat.name, 'Intercessor Squad');
  assert.equal(agregat.models[0].W, '2');

  await server.close();
});

test('character leve une ApiError not-found sur 404', async () => {
  const server = await startServer({ port: 0 });
  const client = clientFor(server.url);

  await assert.rejects(
    () => client.character('inconnu'),
    (error) => error instanceof ApiError && error.status === 'not-found'
  );

  await server.close();
});

test('lever not-configured quand aucune url n est reglee', async () => {
  const client = clientFor('');
  await assert.rejects(
    () => client.resolve('calgar'),
    (error) => error.status === 'not-configured'
  );
});

test('lever offline quand fetch echoue', async () => {
  const client = createApiClient({
    getSettings: async () => ({ apiBaseUrl: 'https://api.example', apiKey: '' }),
    fetchImpl: async () => {
      throw new TypeError('network error');
    }
  });

  await assert.rejects(
    () => client.resolve('calgar'),
    (error) => error.status === 'offline'
  );
});

test('lever offline sans perdre la cause quand fetch echoue pour une raison non reseau', async () => {
  const originalError = new RangeError('erreur de logique interne au fetchImpl');
  const client = createApiClient({
    getSettings: async () => ({ apiBaseUrl: 'https://api.example', apiKey: '' }),
    fetchImpl: async () => {
      throw originalError;
    }
  });

  await assert.rejects(
    () => client.resolve('calgar'),
    (error) => error instanceof ApiError && error.status === 'offline' && error.cause === originalError
  );
});

test('lever not-configured plutot qu une TypeError brute quand apiBaseUrl est invalide', async () => {
  const client = clientFor('not a url');

  await assert.rejects(
    () => client.resolve('calgar'),
    (error) => error instanceof ApiError && error.status === 'not-configured'
  );
});

test('conserver le segment de chemin d une apiBaseUrl a plusieurs segments', async () => {
  let seenUrl;
  const client = createApiClient({
    getSettings: async () => ({ apiBaseUrl: 'https://api.example/warhadex', apiKey: '' }),
    fetchImpl: async (url) => {
      seenUrl = url;
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }
  });

  await client.resolve('calgar');
  assert.equal(new URL(seenUrl).pathname, '/warhadex/search');
  assert.equal(new URL(seenUrl).searchParams.get('type'), 'datasheet');
});

test('lever rate-limited sur 429', async () => {
  const client = createApiClient({
    getSettings: async () => ({ apiBaseUrl: 'https://api.example', apiKey: '' }),
    fetchImpl: async () => new Response('{}', { status: 429, headers: { 'retry-after': '30' } })
  });

  await assert.rejects(
    () => client.resolve('calgar'),
    (error) => error.status === 'rate-limited' && error.retryAfter === 30
  );
});

test('envoyer la cle d api en Bearer quand elle est reglee', async () => {
  let seen;
  const client = createApiClient({
    getSettings: async () => ({ apiBaseUrl: 'https://api.example', apiKey: 'secret' }),
    fetchImpl: async (url, init) => {
      seen = init.headers;
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }
  });

  await client.resolve('calgar');
  assert.equal(seen.Authorization, 'Bearer secret');
});

test('abilities ramene le referentiel complet', async () => {
  const server = await startServer({ port: 0 });
  const client = clientFor(server.url);

  const items = await client.abilities();
  assert.ok(items.length >= 4);
  assert.ok(items.some((item) => item.name === 'Deep Strike'));

  await server.close();
});

test('resolve rend un tableau vide quand items est absent', async () => {
  const client = createApiClient({
    getSettings: async () => ({ apiBaseUrl: 'https://api.example', apiKey: '' }),
    fetchImpl: async () => new Response(JSON.stringify({}), { status: 200 })
  });

  assert.deepEqual(await client.resolve('rien'), []);
});
