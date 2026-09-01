import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { MSG } from '../src/core/messages.js';

// Same module-caching constraint as main-smoke.test.js: vendor/browser.js binds
// globalThis.browser once at first import, for the whole process running this file.
// Keep one stable stub object and reassign its leaf methods per test.
const browserStub = {
  runtime: { sendMessage: async () => null },
  storage: { sync: { get: async () => ({}), set: async () => {} } },
  permissions: { request: async () => true }
};
globalThis.browser = browserStub;

const FORM_HTML = `
  <form id="reglages">
    <input id="apiBaseUrl" name="apiBaseUrl" type="url">
    <input id="apiKey" name="apiKey" type="password">
    <input id="cacheTtlDays" name="cacheTtlDays" type="number">
    <input id="showLauncher" name="showLauncher" type="checkbox">
    <button type="submit">Enregistrer</button>
  </form>
  <button type="button" id="vider">Vider le cache</button>
  <p id="etat" role="status"></p>
`;

// jsdom (unlike real browsers) does not implement HTMLFormElement named-property
// access (form.apiBaseUrl), only form.elements.namedItem(name) - see
// https://html.spec.whatwg.org/#the-form-element:dom-form-nameditem. options.js
// itself relies on the spec'd form.<name> shorthand, which every target browser
// supports; this proxy patches just the test's document.querySelector so the
// unmodified options.js code can be exercised for real under jsdom.
function patchNamedFormAccess(doc) {
  const original = doc.querySelector.bind(doc);
  doc.querySelector = (selector) => {
    const result = original(selector);
    if (selector !== '#reglages' || !result) return result;
    return new Proxy(result, {
      get(target, prop, receiver) {
        if (prop in target) return Reflect.get(target, prop, receiver);
        return target.elements.namedItem(typeof prop === 'string' ? prop : '') ?? undefined;
      }
    });
  };
}

async function setup({ stored = {}, permissionGranted = true, sendMessage } = {}) {
  const dom = new JSDOM(`<!doctype html><body>${FORM_HTML}</body>`, { url: 'https://example.com/options.html' });
  patchNamedFormAccess(dom.window.document);
  globalThis.document = dom.window.document;

  browserStub.storage.sync.get = async () => stored;
  const setCalls = [];
  browserStub.storage.sync.set = async (patch) => {
    setCalls.push(patch);
  };

  const permissionCalls = [];
  browserStub.permissions.request = async (request) => {
    permissionCalls.push(request);
    return permissionGranted;
  };

  const sentMessages = [];
  browserStub.runtime.sendMessage = async (message) => {
    sentMessages.push(message);
    return sendMessage ? sendMessage(message) : null;
  };

  await import(`../src/options/options.js?t=${Date.now()}-${Math.random()}`);
  // options.js runs charger() as a top-level await; give the microtask queue a turn
  await new Promise((resolve) => setTimeout(resolve, 0));

  const doc = dom.window.document;
  const rawForm = doc.querySelector('#reglages');
  // jsdom (unlike real browsers) does not implement HTMLFormElement named-property
  // access (form.apiBaseUrl) per the HTML spec, only form.elements.namedItem(name).
  // options.js itself relies on the spec'd form.<name> access, which works in every
  // target browser; this helper only works around the test environment's gap.
  const field = (name) => rawForm.elements.namedItem(name);

  return {
    doc,
    form: rawForm,
    field,
    etat: doc.querySelector('#etat'),
    setCalls,
    permissionCalls,
    sentMessages
  };
}

function submit(doc, form) {
  form.dispatchEvent(new doc.defaultView.Event('submit', { bubbles: true, cancelable: true }));
}

test('charger remplit le formulaire avec les reglages existants', async () => {
  const { field } = await setup({
    stored: { apiBaseUrl: 'https://api.exemple.fr', apiKey: 'abc', cacheTtlDays: 14, showLauncher: false }
  });

  assert.equal(field('apiBaseUrl').value, 'https://api.exemple.fr');
  assert.equal(field('apiKey').value, 'abc');
  assert.equal(field('cacheTtlDays').value, '14');
  assert.equal(field('showLauncher').checked, false);
});

test('soumission valide demande la permission d hote puis enregistre les reglages', async () => {
  const { doc, form, field, etat, setCalls, permissionCalls } = await setup();

  field('apiBaseUrl').value = 'https://api.exemple.fr/base';
  field('apiKey').value = 'ma-cle';
  field('cacheTtlDays').value = '21';
  field('showLauncher').checked = true;

  submit(doc, form);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(permissionCalls, [{ origins: ['https://api.exemple.fr/*'] }]);
  assert.deepEqual(setCalls, [
    { apiBaseUrl: 'https://api.exemple.fr/base', apiKey: 'ma-cle', cacheTtlDays: 21, showLauncher: true }
  ]);
  assert.equal(etat.textContent, 'Reglages enregistres');
  assert.equal(etat.dataset.erreur, 'false');
});

test('permission refusee laisse un message d erreur et n enregistre rien', async () => {
  const { doc, form, field, etat, setCalls, permissionCalls } = await setup({ permissionGranted: false });

  field('apiBaseUrl').value = 'https://api.exemple.fr';
  submit(doc, form);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(permissionCalls.length, 1);
  assert.deepEqual(setCalls, []);
  assert.equal(etat.dataset.erreur, 'true');
});

test('url invalide affiche une erreur sans demander de permission', async () => {
  const { doc, form, field, etat, permissionCalls } = await setup();

  field('apiBaseUrl').value = 'pas-une-url';
  submit(doc, form);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(permissionCalls, []);
  assert.equal(etat.dataset.erreur, 'true');
});

test('vider le cache envoie CLEAR_CACHE et affiche la confirmation', async () => {
  const { doc, etat, sentMessages } = await setup();

  doc.querySelector('#vider').dispatchEvent(new doc.defaultView.Event('click', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(sentMessages, [{ type: MSG.CLEAR_CACHE }]);
  assert.equal(etat.textContent, 'Cache vide');
});
