import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient, ApiError } from '../src/core/api-client.js';
import { startServer } from '../mock-api/server.mjs';

function clientFor(url, apiKey = '') {
  return createApiClient({ baseUrl: url, apiKey });
}

function espion(reponse = () => new Response(JSON.stringify({ items: [] }), { status: 200 })) {
  const appels = [];
  const fetchImpl = async (url, init) => {
    appels.push({ url, headers: init.headers });
    return reponse();
  };
  return { appels, fetchImpl };
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

test('lever not-configured quand l adresse de base est vide', async () => {
  const client = clientFor('');
  await assert.rejects(
    () => client.resolve('calgar'),
    (error) => error.status === 'not-configured'
  );
});

test('lever offline quand fetch echoue', async () => {
  const client = createApiClient({
    baseUrl: 'https://api.example',
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
    baseUrl: 'https://api.example',
    fetchImpl: async () => {
      throw originalError;
    }
  });

  await assert.rejects(
    () => client.resolve('calgar'),
    (error) => error instanceof ApiError && error.status === 'offline' && error.cause === originalError
  );
});

test('lever not-configured plutot qu une TypeError brute quand l adresse de base est invalide', async () => {
  const client = clientFor('not a url');

  await assert.rejects(
    () => client.resolve('calgar'),
    (error) => error instanceof ApiError && error.status === 'not-configured'
  );
});

test('conserver le segment de chemin d une adresse de base a plusieurs segments', async () => {
  const { appels, fetchImpl } = espion();
  const client = createApiClient({ baseUrl: 'https://api.example/warhadex', fetchImpl });

  await client.resolve('calgar');
  assert.equal(new URL(appels[0].url).pathname, '/warhadex/search');
  assert.equal(new URL(appels[0].url).searchParams.get('type'), 'datasheet');
});

test('lever rate-limited sur 429', async () => {
  const client = createApiClient({
    baseUrl: 'https://api.example',
    fetchImpl: async () => new Response('{}', { status: 429, headers: { 'retry-after': '30' } })
  });

  await assert.rejects(
    () => client.resolve('calgar'),
    (error) => error.status === 'rate-limited' && error.retryAfter === 30
  );
});

test('envoyer la cle dans l en-tete X-API-Key', async () => {
  const { appels, fetchImpl } = espion();
  const client = createApiClient({ baseUrl: 'https://api.example', apiKey: 'secret', fetchImpl });

  await client.resolve('calgar');
  assert.equal(appels[0].headers['X-API-Key'], 'secret');
  assert.equal(appels[0].headers.Authorization, undefined, 'l API de prod ne lit pas Authorization');
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
    baseUrl: 'https://api.example',
    fetchImpl: async () => new Response(JSON.stringify({}), { status: 200 })
  });

  assert.deepEqual(await client.resolve('rien'), []);
});

test('une cle refusee est un acces refuse, pas une panne', async () => {
  for (const status of [401, 403]) {
    const client = createApiClient({
      baseUrl: 'https://api.example',
      apiKey: 'revoquee',
      fetchImpl: async () => new Response('{}', { status })
    });

    await assert.rejects(
      () => client.resolve('calgar'),
      (error) => error instanceof ApiError && error.status === 'not-configured',
      `un ${status} doit etre traite comme un acces refuse`
    );
  }
});

test('aucun en-tete de cle n est envoye quand la cle est vide', async () => {
  const { appels, fetchImpl } = espion();
  const client = createApiClient({ baseUrl: 'https://api.example', apiKey: '', fetchImpl });

  await client.resolve('calgar');
  assert.equal('X-API-Key' in appels[0].headers, false);
});

test('l extension ne parle qu a l API warhadex par defaut', async () => {
  const { appels, fetchImpl } = espion();
  const client = createApiClient({ fetchImpl });

  await client.resolve('calgar');
  assert.equal(new URL(appels[0].url).origin, 'https://warhadex-api.orion-sphere.fr');
});

// Regression : l adresse puis la cle etaient des reglages. Le client ne lit plus
// rien dans le stockage : une valeur fournie par ce biais ne doit rien changer
test('ni l adresse ni la cle ne peuvent venir des reglages', async () => {
  const { appels, fetchImpl } = espion();
  const client = createApiClient({
    fetchImpl,
    getSettings: async () => ({ apiBaseUrl: 'https://detournee.example', apiKey: 'volee' })
  });

  await client.resolve('calgar');
  assert.equal(new URL(appels[0].url).origin, 'https://warhadex-api.orion-sphere.fr');
  assert.notEqual(appels[0].headers['X-API-Key'], 'volee');
});
