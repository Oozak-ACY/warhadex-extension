import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { observeUrlChanges } from '../src/content/spa-observer.js';

function fenetre() {
  const dom = new JSDOM('<!doctype html><body>', { url: 'https://example.test/depart' });
  return dom.window;
}

function attendre(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('une navigation par pushState est vue malgre le monde isole', async () => {
  const win = fenetre();
  const vues = [];
  const stop = observeUrlChanges(win, (url) => vues.push(url), 20);

  win.history.pushState({}, '', '/produit-a');
  await attendre(80);

  assert.deepEqual(vues, ['https://example.test/produit-a']);
  stop();
});

// Regression (constatee en navigateur) : la version precedente patchait
// history.pushState depuis le content script. Dans un monde isole ce patch ne
// voit pas les appels du routeur de la page, et aucune navigation SPA n etait
// detectee. La detection ne doit donc dependre d aucune globale de la page.
test('la detection ne repose pas sur un patch de history', async () => {
  const win = fenetre();
  const pushOriginal = win.history.pushState;
  const vues = [];
  const stop = observeUrlChanges(win, (url) => vues.push(url), 20);

  assert.equal(win.history.pushState, pushOriginal, 'history ne doit pas etre modifie');

  // simuler une navigation qui contourne entierement l objet history du monde isole
  win.history.replaceState({}, '', '/produit-b');
  await attendre(80);

  assert.deepEqual(vues, ['https://example.test/produit-b']);
  stop();
});

test('popstate declenche sans attendre le prochain tick', async () => {
  const win = fenetre();
  const vues = [];
  const stop = observeUrlChanges(win, (url) => vues.push(url), 100000);

  win.history.pushState({}, '', '/produit-c');
  win.dispatchEvent(new win.PopStateEvent('popstate'));

  assert.deepEqual(vues, ['https://example.test/produit-c']);
  stop();
});

test('une navigation vers la meme URL ne declenche rien', async () => {
  const win = fenetre();
  const vues = [];
  const stop = observeUrlChanges(win, (url) => vues.push(url), 20);

  win.history.pushState({}, '', '/depart');
  await attendre(80);

  assert.deepEqual(vues, []);
  stop();
});

test('chaque navigation successive est signalee une seule fois', async () => {
  const win = fenetre();
  const vues = [];
  const stop = observeUrlChanges(win, (url) => vues.push(url), 20);

  win.history.pushState({}, '', '/un');
  await attendre(60);
  win.history.pushState({}, '', '/deux');
  await attendre(60);

  assert.deepEqual(vues, ['https://example.test/un', 'https://example.test/deux']);
  stop();
});

test('la fonction stop arrete le sondage et retire l ecouteur', async () => {
  const win = fenetre();
  const vues = [];
  const stop = observeUrlChanges(win, (url) => vues.push(url), 20);

  stop();

  win.history.pushState({}, '', '/apres-arret');
  win.dispatchEvent(new win.PopStateEvent('popstate'));
  await attendre(80);

  assert.deepEqual(vues, [], 'plus aucun signalement apres arret');
});
