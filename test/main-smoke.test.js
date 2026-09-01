import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { MSG, STATUS } from '../src/core/messages.js';

// main.js reads the ambient document/window/location, as it does in a real content
// script. We stand those up with jsdom and stub browser + fetch before importing it.
//
// vendor/browser.js does `const api = globalThis.browser ?? globalThis.chrome` at
// import time and that binding is cached for the lifetime of the process (module
// caching applies to every static import main.js pulls in, not just main.js itself).
// So globalThis.browser must be one stable object created before the first import,
// with its leaf methods reassigned per test - replacing the whole object would leave
// the cached `api` pointing at a stale stub.
const browserStub = {
  runtime: {
    getURL: (path) => `stub://${path}`,
    sendMessage: async () => null
  },
  storage: {
    sync: { get: async () => ({}) }
  }
};
globalThis.browser = browserStub;

// A cache-busting query on the dynamic import gives each test a fresh main.js module
// instance, so module-level state (panel/launcher/dernier) does not leak between tests.
async function setup({ head = '', body = '', url = 'https://www.example.com/produit', showLauncher = true, sendMessage }) {
  const dom = new JSDOM(`<!doctype html><head>${head}</head><body>${body}</body>`, { url });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.location = dom.window.location;
  globalThis.fetch = async () => ({ text: async () => '' });

  browserStub.storage.sync.get = async () => ({ showLauncher });
  const calls = [];
  browserStub.runtime.sendMessage = async (message) => {
    calls.push(message);
    return sendMessage ? sendMessage(message) : null;
  };

  const mod = await import(`../src/content/main.js?t=${Date.now()}-${Math.random()}`);

  function findLauncherButton() {
    for (const child of dom.window.document.body.children) {
      const button = child.shadowRoot?.querySelector('.wx-launcher');
      if (button) return button;
    }
    return null;
  }

  function findPanelRoot() {
    for (const child of dom.window.document.body.children) {
      const root = child.shadowRoot?.querySelector('.wx-root');
      if (root) return root;
    }
    return null;
  }

  return { doc: dom.window.document, calls, start: mod.start, findLauncherButton, findPanelRoot };
}

test('start ne monte rien quand showLauncher est desactive', async () => {
  const { doc, calls, start } = await setup({
    head: '<meta property="og:title" content="Marneus Calgar">',
    showLauncher: false
  });

  await start();

  assert.equal(doc.body.children.length, 0, 'aucun host ne doit etre monte');
  assert.deepEqual(calls, []);
});

test('start detecte un personnage, resout et affiche le lanceur avec un match', async () => {
  const { calls, start, findLauncherButton, findPanelRoot } = await setup({
    head: '<meta property="og:title" content="Marneus Calgar">',
    sendMessage: (message) => {
      if (message.type === MSG.RESOLVE) {
        return { status: STATUS.MATCH, character: { id: 'marneus-calgar', name: 'Marneus Calgar' } };
      }
      return null;
    }
  });

  await start();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, MSG.RESOLVE);
  assert.equal(calls[0].name, 'marneus calgar');

  const button = findLauncherButton();
  assert.ok(button, 'le lanceur doit etre monte');
  assert.equal(button.hidden, false, 'le lanceur doit etre visible sur un match');

  const panelRoot = findPanelRoot();
  assert.ok(panelRoot, 'le panneau doit etre monte');
  assert.equal(panelRoot.getAttribute('data-open'), 'false', 'le panneau ne doit jamais s ouvrir tout seul');
});

test('start masque le lanceur quand rien n est detecte sur la page', async () => {
  const { calls, start, findLauncherButton } = await setup({ body: '<p>Rien ici</p>' });

  await start();

  assert.deepEqual(calls, [], 'aucune resolution ne doit etre demandee sans detection');
  const button = findLauncherButton();
  assert.ok(button, 'le lanceur doit etre monte, meme masque');
  assert.equal(button.hidden, true);
});

test('start masque le lanceur quand la resolution renvoie not-found', async () => {
  const { start, findLauncherButton } = await setup({
    head: '<meta property="og:title" content="Personnage Inconnu">',
    sendMessage: () => ({ status: STATUS.NOT_FOUND })
  });

  await start();

  const button = findLauncherButton();
  assert.ok(button, 'le lanceur doit etre monte, meme masque');
  assert.equal(button.hidden, true);
});
