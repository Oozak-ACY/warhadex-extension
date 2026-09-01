import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { observeUrlChanges } from '../src/content/spa-observer.js';

function setup(url = 'https://example.com/a') {
  const dom = new JSDOM('<!doctype html><body>', { url });
  return dom.window;
}

function wait(win, ms) {
  return new Promise((resolve) => win.setTimeout(resolve, ms));
}

test('pushState declenche le callback apres le delai', async () => {
  const win = setup();
  const urls = [];
  observeUrlChanges(win, (url) => urls.push(url), 10);

  win.history.pushState({}, '', '/b');
  assert.deepEqual(urls, [], 'ne doit pas encore avoir declenche avant le delai');

  await wait(win, 30);
  assert.deepEqual(urls, [win.location.href]);
});

test('replaceState declenche le callback apres le delai', async () => {
  const win = setup();
  const urls = [];
  observeUrlChanges(win, (url) => urls.push(url), 10);

  win.history.replaceState({}, '', '/c');
  await wait(win, 30);
  assert.deepEqual(urls, [win.location.href]);
});

test('popstate declenche le callback apres le delai', async () => {
  const win = setup();
  const urls = [];
  observeUrlChanges(win, (url) => urls.push(url), 10);

  // simuler une navigation arriere qui change effectivement l URL puis emet popstate
  win.history.pushState({}, '', '/d');
  await wait(win, 30);
  urls.length = 0;

  win.history.pushState({}, '', '/e');
  win.dispatchEvent(new win.PopStateEvent('popstate'));
  await wait(win, 30);
  assert.deepEqual(urls, [win.location.href]);
});

test('une navigation vers la meme URL ne declenche pas le callback', async () => {
  const win = setup();
  const urls = [];
  observeUrlChanges(win, (url) => urls.push(url), 10);

  win.history.pushState({}, '', win.location.href);
  await wait(win, 30);
  assert.deepEqual(urls, []);
});

test('la fonction stop restaure history et retire l ecouteur popstate', async () => {
  const win = setup();
  const urls = [];
  const originalPush = win.history.pushState;
  const originalReplace = win.history.replaceState;

  const stop = observeUrlChanges(win, (url) => urls.push(url), 10);

  assert.notEqual(win.history.pushState, originalPush, 'pushState doit avoir ete remplace');
  assert.notEqual(win.history.replaceState, originalReplace, 'replaceState doit avoir ete remplace');

  stop();

  assert.equal(win.history.pushState, originalPush, 'pushState doit etre restaure');
  assert.equal(win.history.replaceState, originalReplace, 'replaceState doit etre restaure');

  win.history.pushState({}, '', '/apres-stop');
  win.dispatchEvent(new win.PopStateEvent('popstate'));
  await wait(win, 30);
  assert.deepEqual(urls, [], 'le callback ne doit plus etre appele apres stop');
});
