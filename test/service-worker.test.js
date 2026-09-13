import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../src/core/api-client.js';
import { MSG, STATUS } from '../src/core/messages.js';
import {
  candidats,
  cleFiche,
  createResolver,
  toFailure,
  badgeState,
  BADGE_MESSAGES,
  CERTAIN_SCORE,
  NEGATIVE_TTL_MS,
  ABILITIES_TTL_MS,
  TRONCATURES_MAX,
  MIN_RECHERCHE,
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

function fakeApi({ matches = [], character = { id: 'x', name: 'X' }, abilities = [] } = {}) {
  const calls = { resolve: [], character: [], abilities: 0 };
  return {
    calls,
    async resolve(name, site) {
      calls.resolve.push({ name, site });
      return matches;
    },
    async character(id) {
      calls.character.push(id);
      return typeof character === 'function' ? character(id) : character;
    },
    async abilities() {
      calls.abilities += 1;
      if (abilities instanceof Error) throw abilities;
      return abilities;
    }
  };
}

function setup({ matches, character, abilities, cacheTtlDays = 7 } = {}) {
  const api = fakeApi({ matches, character, abilities });
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

test('une tete au dessus du seuil qui bat ses suivants est certaine', async () => {
  const { api, resolver } = setup({
    matches: [
      { id: 'a', score: 1 },
      { id: 'b', score: 0.4 },
      { id: 'c', score: 0.4 }
    ],
    character: { id: 'a', name: 'Intercessor Squad' }
  });

  const result = await resolver.resolveName('a');

  assert.equal(result.status, STATUS.MATCH, 'les trainards bas ne rendent pas la tete ambigue');
  assert.deepEqual(api.calls.character, ['a']);
});

test('deux candidats a egalite en tete restent ambigus', async () => {
  const { api, resolver } = setup({
    matches: [
      { id: 'a', score: 1 },
      { id: 'b', score: 1 },
      { id: 'c', score: 0.4 }
    ]
  });

  const result = await resolver.resolveName('a');

  assert.equal(result.status, STATUS.AMBIGUOUS, 'une egalite en tete ne se tranche pas toute seule');
  assert.equal(result.matches.length, 3);
  assert.deepEqual(api.calls.character, []);
});

test('une tete qui ne depasse pas le seuil reste ambigue meme seule', async () => {
  const { api, resolver } = setup({ matches: [{ id: 'a', score: CERTAIN_SCORE }] });

  const result = await resolver.resolveName('a');

  assert.equal(result.status, STATUS.AMBIGUOUS);
  assert.deepEqual(api.calls.character, []);
});

// --- cache et TTL ---

test('une resolution positive est memorisee avec le TTL des fiches', async () => {
  const { cache, resolver } = setup({ matches: [{ id: 'a', score: 0.99 }], cacheTtlDays: 3 });

  await resolver.resolveName('a', 'warhammer.com');

  const resolveWrite = cache.writes.find((write) => write.key === 'resolve:a');
  const characterWrite = cache.writes.find((write) => write.key === cleFiche('a'));
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
  cache.seed(cleFiche('a'), { id: 'a', name: 'Deja vu' });

  const result = await resolver.resolveName('a', 'warhammer.com');

  assert.equal(result.character.name, 'Deja vu');
  assert.deepEqual(api.calls.resolve, []);
  assert.deepEqual(api.calls.character, []);
  assert.deepEqual(cache.writes, [], 'rien ne doit etre reecrit quand tout vient du cache');
});

test('une fiche memorisee dans un format anterieur est rechargee', async () => {
  const { api, cache, resolver } = setup({ matches: [{ id: 'a', score: 0.99 }] });
  cache.seed('character:a', { id: 'a', name: 'Ancien format' });

  const result = await resolver.resolveName('a', 'warhammer.com');

  assert.notEqual(result.character.name, 'Ancien format');
  assert.deepEqual(api.calls.character, ['a']);
  assert.equal(cleFiche('a'), 'character:v2:a');
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

test('un effacement de badge n appelle pas l API et remet le badge a neutre', async () => {
  const { api, resolver } = setup({ matches: [{ id: 'a', score: 0.99 }] });

  const result = await resolver.handle({ type: MSG.CLEAR_BADGE });

  assert.equal(badgeState(result.status), 'none');
  assert.deepEqual(api.calls.resolve, []);
  assert.deepEqual(api.calls.character, []);
});

test('seuls resolve et clear-badge pilotent le badge de l onglet', () => {
  assert.ok(BADGE_MESSAGES.has(MSG.RESOLVE));
  assert.ok(BADGE_MESSAGES.has(MSG.CLEAR_BADGE));
  assert.ok(!BADGE_MESSAGES.has(MSG.CHARACTER), 'ouvrir une fiche depuis le selecteur ne touche pas au badge');
  assert.ok(!BADGE_MESSAGES.has(MSG.CLEAR_CACHE));
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


// --- referentiel d aptitudes ---

test('le referentiel d aptitudes est pris une fois et memorise longtemps', async () => {
  const { api, cache, resolver } = setup({
    matches: [{ id: 'a', score: 0.99 }],
    abilities: [{ id: 'ab1', name: 'Deep Strike', description: { text: 'texte' } }]
  });

  await resolver.resolveName('a');
  await resolver.loadCharacter('b');

  assert.equal(api.calls.abilities, 1, 'un seul appel malgre deux fiches');
  const write = cache.writes.find((entry) => entry.key === 'abilities');
  assert.equal(write.ttlMs, ABILITIES_TTL_MS);
  assert.equal(ABILITIES_TTL_MS, 30 * DAY_MS);
});

test('une aptitude vide est resolue depuis le referentiel', async () => {
  const { resolver } = setup({
    matches: [{ id: 'a', score: 0.99 }],
    character: {
      id: 'a',
      name: 'Test',
      abilities: [{ type: 'Core', ability_id: 'ab1', name: '', description: { text: '' } }]
    },
    abilities: [{ id: 'ab1', name: 'Deep Strike', description: { text: 'apparait en reserve' } }]
  });

  const result = await resolver.resolveName('a');

  assert.equal(result.character.abilities[0].name, 'Deep Strike');
  assert.equal(result.character.abilities[0].text, 'apparait en reserve');
});

test('un referentiel injoignable degrade la fiche sans la faire echouer', async () => {
  const { cache, resolver } = setup({
    matches: [{ id: 'a', score: 0.99 }],
    character: {
      id: 'a',
      name: 'Test',
      abilities: [{ type: 'Core', ability_id: 'ab1', name: '', description: { text: '' } }]
    },
    abilities: new Error('referentiel injoignable'),
    cacheTtlDays: 7
  });

  const result = await resolver.resolveName('a');

  assert.equal(result.status, STATUS.MATCH, 'la fiche reste servie');
  assert.equal(result.character.abilities[0].name, 'Core', 'le type remplace le nom absent');
  assert.equal(result.character.abilities[0].text, '');

  const write = cache.writes.find((entry) => entry.key === cleFiche('a'));
  assert.equal(write.ttlMs, NEGATIVE_TTL_MS, 'une fiche degradee ne se garde qu une journee');
});

test('l agregat est traduit en fiche avant d etre memorise', async () => {
  const { cache, resolver } = setup({
    matches: [{ id: 'a', score: 0.99 }],
    character: {
      id: 'a',
      name: 'Intercessor Squad',
      faction: { id: 'SM', name: 'Space Marines' },
      models: [{ name: 'Intercessor', M: '6"', T: '4', Sv: '3+', W: '2', Ld: '6+', OC: '2', inv_sv: '-' }],
      costs: [{ cost: 80, description: { text: '5 models' } }]
    }
  });

  const result = await resolver.resolveName('a');

  assert.equal(result.character.faction, 'Space Marines', 'la faction est aplatie');
  assert.deepEqual(result.character.points, [{ models: 5, label: '5 models', cost: 80 }]);
  assert.equal(result.character.invulnerable, null);

  const write = cache.writes.find((entry) => entry.key === cleFiche('a'));
  assert.equal(write.value.faction, 'Space Marines', 'c est la fiche mappee qui est cachee');
});


// --- repli par troncature a gauche ---

test('la meilleure tentative gagne, pas la premiere qui repond', async () => {
  const reponses = {
    'adeptus custodes custodian guard': [],
    'custodes custodian guard': [{ id: 'cg', score: 0.77 }],
    'custodian guard': [{ id: 'cg', score: 1 }]
  };
  const api = fakeApi();
  api.resolve = async (name) => reponses[name] ?? [];
  const resolver = createResolver({ api, cache: fakeCache(), getSettings: async () => ({ cacheTtlDays: 7 }) });

  const trouve = await resolver.chercher('adeptus custodes custodian guard');

  assert.equal(trouve.requete, 'custodian guard');
  assert.equal(trouve.matches[0].score, 1);
});

test('la recherche s arrete des qu une correspondance exacte est trouvee', async () => {
  const api = fakeApi({ matches: [{ id: 'a', score: 1 }] });
  const resolver = createResolver({ api, cache: fakeCache(), getSettings: async () => ({ cacheTtlDays: 7 }) });

  await resolver.chercher('space marines intercessor squad');

  assert.equal(api.calls.resolve.length, 1, 'aucun appel inutile apres un score parfait');
});

test('la troncature est bornee', async () => {
  const api = fakeApi({ matches: [] });
  const resolver = createResolver({ api, cache: fakeCache(), getSettings: async () => ({ cacheTtlDays: 7 }) });

  await resolver.chercher('un titre marchand tres long avec beaucoup de mots inutiles');

  assert.equal(api.calls.resolve.length, 2 * TRONCATURES_MAX + 1);
});

// Regression (signalee a l usage) : les marchands ne s accordent pas sur le cote
// ou ils collent la faction. warhammer.com et Philibert la prefixent, Wayland la
// suffixe : Weirdboy - Orks devient weirdboy orks, qui ne score que 76, la ou
// weirdboy seul score 100. Ne tronquer qu a gauche donnait orks, du bruit pur.
test('la troncature retire des mots des deux bouts', () => {
  assert.deepEqual(candidats('weirdboy orks'), ['weirdboy orks', 'orks', 'weirdboy']);
});

test('un nom d un seul mot ne produit qu un candidat', () => {
  assert.deepEqual(candidats('weirdboy'), ['weirdboy']);
});

test('les candidats ne comportent pas de doublon', () => {
  const liste = candidats('alpha beta gamma');
  assert.equal(new Set(liste).size, liste.length);
});

test('une faction en suffixe est retiree pour retrouver l unite', async () => {
  const reponses = {
    'weirdboy orks': [{ id: 'w', score: 0.76 }],
    orks: [{ id: 'autre', score: 0.4 }],
    weirdboy: [{ id: 'w', score: 1 }]
  };
  const api = fakeApi();
  api.resolve = async (name) => reponses[name] ?? [];
  const resolver = createResolver({ api, cache: fakeCache(), getSettings: async () => ({ cacheTtlDays: 7 }) });

  const trouve = await resolver.chercher('weirdboy orks');

  assert.equal(trouve.requete, 'weirdboy');
  assert.equal(trouve.score, 1);
});

test('la faction est attachee aux candidats avant l affichage du selecteur', async () => {
  const api = fakeApi({ matches: [{ id: 'a', score: 1 }, { id: 'b', score: 1 }] });
  api.describe = async () => [
    { id: 'a', faction: 'Space Marines' },
    { id: 'b', faction: 'Grey Knights' }
  ];
  const resolver = createResolver({ api, cache: fakeCache(), getSettings: async () => ({ cacheTtlDays: 7 }) });

  const result = await resolver.resolveName('terminator squad');

  assert.equal(result.status, STATUS.AMBIGUOUS);
  assert.deepEqual(result.matches.map((m) => m.faction), ['Space Marines', 'Grey Knights']);
});

test('un enrichissement en echec ne fait pas echouer la resolution', async () => {
  const api = fakeApi({ matches: [{ id: 'a', score: 1 }, { id: 'b', score: 1 }] });
  api.describe = async () => {
    throw new Error('injoignable');
  };
  const resolver = createResolver({ api, cache: fakeCache(), getSettings: async () => ({ cacheTtlDays: 7 }) });

  const result = await resolver.resolveName('terminator squad');

  assert.equal(result.status, STATUS.AMBIGUOUS, 'le selecteur reste affichable sans faction');
  assert.equal(result.matches.length, 2);
});

test('une correspondance certaine n appelle pas l enrichissement', async () => {
  const api = fakeApi({ matches: [{ id: 'a', score: 1 }] });
  let appele = false;
  api.describe = async () => {
    appele = true;
    return [];
  };
  const resolver = createResolver({ api, cache: fakeCache(), getSettings: async () => ({ cacheTtlDays: 7 }) });

  await resolver.resolveName('marneus calgar');

  assert.equal(appele, false, 'pas d appel de confort quand le selecteur ne s affichera pas');
});


// --- recherche manuelle par nom ---

test('la recherche manuelle attache les factions et ne tronque pas', async () => {
  const api = fakeApi({ matches: [{ id: 'a', score: 0.8 }, { id: 'b', score: 0.6 }] });
  api.describe = async () => [
    { id: 'a', faction: 'Space Marines' },
    { id: 'b', faction: 'Grey Knights' }
  ];
  const resolver = createResolver({ api, cache: fakeCache(), getSettings: async () => ({ cacheTtlDays: 7 }) });

  const result = await resolver.rechercher('terminator squad');

  assert.equal(result.status, STATUS.AMBIGUOUS);
  assert.deepEqual(result.matches.map((m) => m.faction), ['Space Marines', 'Grey Knights']);
  assert.deepEqual(
    api.calls.resolve.map((c) => c.name),
    ['terminator squad'],
    'une seule requete : l utilisateur a tape ce qu il voulait'
  );
});

test('une recherche trop courte n interroge pas l api', async () => {
  const api = fakeApi({ matches: [{ id: 'a', score: 1 }] });
  const resolver = createResolver({ api, cache: fakeCache(), getSettings: async () => ({ cacheTtlDays: 7 }) });

  const result = await resolver.rechercher('cal');

  assert.equal(result.status, STATUS.NOT_FOUND);
  assert.deepEqual(result.matches, []);
  assert.deepEqual(api.calls.resolve, []);
  assert.equal(MIN_RECHERCHE, 4);
});

test('une recherche sans resultat repond not-found', async () => {
  const api = fakeApi({ matches: [] });
  const resolver = createResolver({ api, cache: fakeCache(), getSettings: async () => ({ cacheTtlDays: 7 }) });

  const result = await resolver.rechercher('inexistant');

  assert.equal(result.status, STATUS.NOT_FOUND);
  assert.deepEqual(result.matches, []);
});

test('la recherche manuelle ne pollue pas le cache de resolution', async () => {
  const api = fakeApi({ matches: [{ id: 'a', score: 1 }] });
  api.describe = async () => [];
  const cache = fakeCache();
  const resolver = createResolver({ api, cache, getSettings: async () => ({ cacheTtlDays: 7 }) });

  await resolver.rechercher('marneus calgar');

  assert.deepEqual(cache.writes, [], 'rien de memorise pour une recherche manuelle');
});

test('le message SEARCH est route vers la recherche manuelle', async () => {
  const api = fakeApi({ matches: [{ id: 'a', score: 1 }] });
  api.describe = async () => [{ id: 'a', faction: 'Orks' }];
  const resolver = createResolver({ api, cache: fakeCache(), getSettings: async () => ({ cacheTtlDays: 7 }) });

  const result = await resolver.handle({ type: MSG.SEARCH, q: 'weirdboy' });

  assert.equal(result.status, STATUS.AMBIGUOUS);
  assert.equal(result.matches[0].faction, 'Orks');
});

test('la recherche manuelle ne touche pas au badge', () => {
  assert.equal(BADGE_MESSAGES.has(MSG.SEARCH), false);
});
