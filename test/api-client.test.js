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

  const matches = await client.resolve('marneus calgar', 'www.warhammer.com');
  assert.equal(matches[0].id, 'marneus-calgar');
  assert.equal(matches[0].score, 1);

  await server.close();
});

test('character retourne la fiche complete', async () => {
  const server = await startServer({ port: 0 });
  const client = clientFor(server.url);

  const fiche = await client.character('ghazghkull-thraka');
  assert.equal(fiche.name, 'Ghazghkull Thraka');
  assert.equal(fiche.profile.w, 12);

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
    () => client.resolve('calgar', 'x'),
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
    () => client.resolve('calgar', 'x'),
    (error) => error.status === 'offline'
  );
});

test('lever rate-limited sur 429', async () => {
  const client = createApiClient({
    getSettings: async () => ({ apiBaseUrl: 'https://api.example', apiKey: '' }),
    fetchImpl: async () => new Response('{}', { status: 429, headers: { 'retry-after': '30' } })
  });

  await assert.rejects(
    () => client.resolve('calgar', 'x'),
    (error) => error.status === 'rate-limited' && error.retryAfter === 30
  );
});

test('envoyer la cle d api en Bearer quand elle est reglee', async () => {
  let seen;
  const client = createApiClient({
    getSettings: async () => ({ apiBaseUrl: 'https://api.example', apiKey: 'secret' }),
    fetchImpl: async (url, init) => {
      seen = init.headers;
      return new Response(JSON.stringify({ matches: [] }), { status: 200 });
    }
  });

  await client.resolve('calgar', 'x');
  assert.equal(seen.Authorization, 'Bearer secret');
});
