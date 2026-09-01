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

  function findPanelShadow() {
    for (const child of dom.window.document.body.children) {
      if (child.shadowRoot?.querySelector('.wx-root')) return child.shadowRoot;
    }
    return null;
  }

  return { doc: dom.window.document, calls, start: mod.start, findLauncherButton, findPanelRoot, findPanelShadow };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

// Regression: a sendMessage rejection (sleeping service worker, invalidated context)
// must not leak as an unhandled rejection, must show the error state, must hide the
// launcher, and - since this is not a definitive answer about the product - must not
// leave `dernier` armed, so a later re-detection of the same product retries instead
// of being silently skipped by the dedupe guard.
test('un rejet de sendMessage affiche l erreur, masque le lanceur et permet une nouvelle tentative', async () => {
  let resolveCalls = 0;
  const { doc, calls, start, findLauncherButton, findPanelShadow } = await setup({
    head: '<meta property="og:title" content="Marneus Calgar">',
    sendMessage: (message) => {
      if (message.type !== MSG.RESOLVE) return null;
      resolveCalls += 1;
      if (resolveCalls === 1) throw new Error('service worker endormi');
      return { status: STATUS.MATCH, character: { id: 'marneus-calgar', name: 'Marneus Calgar' } };
    }
  });

  await start();

  assert.equal(calls.length, 1, 'la premiere tentative doit avoir ete faite');
  assert.equal(findLauncherButton().hidden, true, 'le lanceur doit etre masque apres un rejet');
  assert.equal(
    findPanelShadow().querySelector('.wx-state')?.textContent,
    'Une erreur est survenue lors de la recuperation de la fiche',
    'le panneau doit afficher l etat erreur'
  );

  // simuler une navigation SPA vers une autre URL du meme produit (le titre og
  // n a pas change) pour verifier que le garde-fou de deduplication a bien ete leve
  doc.defaultView.history.pushState({}, '', '/autre-chemin');
  await wait(550);

  assert.equal(calls.length, 2, 'la reponse en erreur ne doit pas bloquer une nouvelle tentative');
  assert.equal(findLauncherButton().hidden, false, 'le lanceur doit redevenir visible apres le succes');
  assert.equal(findPanelShadow().querySelector('.wx-state'), null, 'l etat erreur ne doit plus etre affiche');
});

// Regression (minor, same code path): a resolved-but-non-definitive status (OFFLINE,
// ERROR) must also clear `dernier`, even though sendMessage itself did not reject.
test('un statut offline efface le garde-fou pour permettre une nouvelle tentative', async () => {
  let resolveCalls = 0;
  const { doc, calls, start, findLauncherButton } = await setup({
    head: '<meta property="og:title" content="Marneus Calgar">',
    sendMessage: (message) => {
      if (message.type !== MSG.RESOLVE) return null;
      resolveCalls += 1;
      if (resolveCalls === 1) return { status: STATUS.OFFLINE };
      return { status: STATUS.MATCH, character: { id: 'marneus-calgar', name: 'Marneus Calgar' } };
    }
  });

  await start();

  assert.equal(calls.length, 1);
  // OFFLINE laisse le lanceur visible (le clic ouvre le panneau sur le message d etat)
  assert.equal(findLauncherButton().hidden, false);

  doc.defaultView.history.pushState({}, '', '/autre-chemin');
  await wait(550);

  assert.equal(calls.length, 2, 'un statut offline ne doit pas bloquer une nouvelle tentative');
});

// Regression: an absent/undefined response (distinct from a rejection and from a
// genuine NOT_FOUND) is not a definitive answer either - e.g. Firefox/Safari can
// resolve sendMessage to undefined instead of rejecting when nothing answers. It
// must hide the launcher (unchanged) but must also clear `dernier` so a later
// re-detection of the same product retries instead of being permanently skipped.
test('une reponse absente efface le garde-fou pour permettre une nouvelle tentative', async () => {
  let resolveCalls = 0;
  const { doc, calls, start, findLauncherButton } = await setup({
    head: '<meta property="og:title" content="Marneus Calgar">',
    sendMessage: (message) => {
      if (message.type !== MSG.RESOLVE) return null;
      resolveCalls += 1;
      if (resolveCalls === 1) return undefined;
      return { status: STATUS.MATCH, character: { id: 'marneus-calgar', name: 'Marneus Calgar' } };
    }
  });

  await start();

  assert.equal(calls.length, 1);
  assert.equal(findLauncherButton().hidden, true, 'le lanceur doit etre masque sans reponse');

  doc.defaultView.history.pushState({}, '', '/autre-chemin');
  await wait(550);

  assert.equal(calls.length, 2, 'une reponse absente ne doit pas bloquer une nouvelle tentative');
  assert.equal(findLauncherButton().hidden, false, 'le lanceur doit redevenir visible apres le succes');
});

// Regression: a rejected sendMessage from the match-picker flow (ouvrirFiche) must
// also surface the error state instead of escaping as an unhandled rejection.
test('un rejet de sendMessage dans ouvrirFiche affiche l etat erreur', async () => {
  const { doc, start, findPanelShadow } = await setup({
    head: '<meta property="og:title" content="Marneus Calgar">',
    sendMessage: (message) => {
      if (message.type === MSG.RESOLVE) {
        return {
          status: STATUS.AMBIGUOUS,
          matches: [{ id: 'a', name: 'Alpha', faction: 'Chaos' }]
        };
      }
      if (message.type === MSG.CHARACTER) throw new Error('service worker endormi');
      return null;
    }
  });

  await start();

  const shadow = findPanelShadow();
  const bouton = shadow.querySelector('.wx-match');
  assert.ok(bouton, 'un bouton de correspondance doit etre affiche');

  bouton.dispatchEvent(new doc.defaultView.Event('click', { bubbles: true }));
  await wait(0);

  assert.equal(
    shadow.querySelector('.wx-state')?.textContent,
    'Une erreur est survenue lors de la recuperation de la fiche',
    'le panneau doit afficher l etat erreur apres le rejet'
  );
});
