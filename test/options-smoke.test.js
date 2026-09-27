import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { MSG } from '../src/core/messages.js';
import { installerI18n } from './helpers/i18n.js';

installerI18n();

// Same module-caching constraint as main-smoke.test.js: vendor/browser.js binds
// globalThis.browser once at first import, for the whole process running this file.
// Keep one stable stub object and reassign its leaf methods per test.
const browserStub = {
  runtime: { sendMessage: async () => null },
  storage: {
    sync: { get: async () => ({}), set: async () => {} },
    local: { get: async () => ({}), set: async () => {} }
  },
  permissions: { request: async () => true, contains: async () => false }
};
globalThis.browser = browserStub;

const FORM_HTML = `
  <form id="reglages">
    <input id="cacheTtlDays" name="cacheTtlDays" type="number">
    <input id="showLauncher" name="showLauncher" type="checkbox">
    <button type="submit">Enregistrer</button>
  </form>
  <button type="button" id="vider">Vider le cache</button>
  <p id="etat" role="status"></p>
`;

// jsdom (unlike real browsers) does not implement HTMLFormElement named-property
// access (form.cacheTtlDays), only form.elements.namedItem(name) - see
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

async function setup({ stored = {}, storedLocal = {}, sendMessage } = {}) {
  const dom = new JSDOM(`<!doctype html><body>${FORM_HTML}</body>`, { url: 'https://example.com/options.html' });
  patchNamedFormAccess(dom.window.document);
  globalThis.document = dom.window.document;

  browserStub.storage.sync.get = async () => stored;
  browserStub.storage.local.get = async () => storedLocal;

  const setCalls = [];
  const localSetCalls = [];
  browserStub.storage.sync.set = async (patch) => {
    setCalls.push(patch);
  };
  browserStub.storage.local.set = async (patch) => {
    localSetCalls.push(patch);
  };

  // l API est fixe et accordee a l installation : la page d options ne doit plus
  // jamais solliciter l API de permissions
  const permissionCalls = [];
  browserStub.permissions.request = async (request) => {
    permissionCalls.push({ request });
    return true;
  };
  browserStub.permissions.contains = async (request) => {
    permissionCalls.push({ contains: request });
    return true;
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
  const field = (name) => rawForm.elements.namedItem(name);

  return {
    doc,
    form: rawForm,
    field,
    etat: doc.querySelector('#etat'),
    setCalls,
    localSetCalls,
    permissionCalls,
    sentMessages
  };
}

function submit(doc, form) {
  form.dispatchEvent(new doc.defaultView.Event('submit', { bubbles: true, cancelable: true }));
}

test('charger remplit le formulaire avec les reglages existants', async () => {
  const { field } = await setup({ stored: { cacheTtlDays: 14, showLauncher: false } });

  assert.equal(field('cacheTtlDays').value, '14');
  assert.equal(field('showLauncher').checked, false);
});

test('la page d options ne propose ni adresse ni cle d API', async () => {
  const { field } = await setup({
    stored: { apiBaseUrl: 'https://detournee.example' },
    storedLocal: { apiKey: 'ancienne-cle' }
  });

  assert.equal(field('apiBaseUrl'), null, 'aucun champ d adresse ne doit exister');
  assert.equal(field('apiKey'), null, 'aucun champ de cle ne doit exister');
});

test('soumission enregistre les reglages sans cle ni permission', async () => {
  const { doc, form, field, etat, setCalls, localSetCalls, permissionCalls } = await setup();

  field('cacheTtlDays').value = '21';
  field('showLauncher').checked = true;

  submit(doc, form);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(setCalls, [{ cacheTtlDays: 21, showLauncher: true }]);
  assert.deepEqual(localSetCalls, [], 'plus rien ne doit etre ecrit dans storage.local');
  assert.deepEqual(permissionCalls, [], 'plus aucune demande de permission');
  assert.equal(etat.textContent, 'Settings saved');
  assert.equal(etat.dataset.erreur, 'false');
});

test('vider le cache envoie CLEAR_CACHE et affiche la confirmation', async () => {
  const { doc, etat, sentMessages } = await setup();

  doc.querySelector('#vider').dispatchEvent(new doc.defaultView.Event('click', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(sentMessages, [{ type: MSG.CLEAR_CACHE }]);
  assert.equal(etat.textContent, 'Cache cleared');
});
