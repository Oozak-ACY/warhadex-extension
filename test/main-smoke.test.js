import test, { after } from 'node:test';
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
    sync: { get: async () => ({}) },
    local: { get: async () => ({}) }
  }
};
globalThis.browser = browserStub;

// A cache-busting query on the dynamic import gives each test a fresh main.js module
// instance, so module-level state (panel/launcher/dernier) does not leak between tests.
// `t` is optional: pass it from any test that leaves main.js's bounded
// MutationObserver armed, so the jsdom window (and its 10 s timer) is torn down
// with the test instead of keeping the process alive.
// Le sondage d URL du content script tourne pour la vie de la page. Sans
// fermeture explicite, les fenetres jsdom gardent la boucle d evenements de Node
// vivante et le fichier de test ne rend jamais la main
const fenetresOuvertes = [];

after(() => {
  for (const fenetre of fenetresOuvertes) fenetre.close();
  fenetresOuvertes.length = 0;
});

async function setup({ head = '', body = '', url = 'https://www.example.com/produit', showLauncher = true, sendMessage }, t) {
  const dom = new JSDOM(`<!doctype html><head>${head}</head><body>${body}</body>`, { url });
  fenetresOuvertes.push(dom.window);
  t?.after(() => dom.window.close());
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

  const panelText = () => findPanelRoot()?.textContent ?? '';

  return {
    doc: dom.window.document,
    calls,
    start: mod.start,
    findLauncherButton,
    findPanelRoot,
    findPanelShadow,
    panelText
  };
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

test('start masque le lanceur quand rien n est detecte sur la page', async (t) => {
  const { calls, start, findLauncherButton } = await setup({ body: '<p>Rien ici</p>' }, t);

  await start();

  assert.deepEqual(
    calls.map((call) => call.type),
    [MSG.CLEAR_BADGE],
    'sans detection, seul l effacement du badge doit etre demande'
  );
  const button = findLauncherButton();
  assert.ok(button, 'le lanceur doit etre monte, meme masque');
  assert.equal(button.hidden, true);
});

// Regression: Chrome ne reinitialise un badge d onglet que sur une vraie navigation.
// Sur une SPA, quitter une fiche produit pour une page sans personnage laissait le
// badge fige sur `1` faute du moindre message envoye au service worker.
test('quitter une fiche produit pour une page sans personnage efface le badge', async (t) => {
  const { doc, calls, start } = await setup(
    {
      head: '<meta property="og:title" content="Marneus Calgar">',
      sendMessage: (message) => {
        if (message.type === MSG.RESOLVE) {
          return { status: STATUS.MATCH, character: { id: 'marneus-calgar', name: 'Marneus Calgar' } };
        }
        return null;
      }
    },
    t
  );

  await start();
  assert.deepEqual(calls.map((call) => call.type), [MSG.RESOLVE]);

  // la SPA remplace le titre du produit par une page de categorie
  doc.querySelector('meta[property="og:title"]').remove();
  doc.defaultView.history.pushState({}, '', '/categorie');
  await wait(550);

  assert.deepEqual(
    calls.map((call) => call.type),
    [MSG.RESOLVE, MSG.CLEAR_BADGE],
    'le service worker doit etre prevenu que l onglet a quitte la fiche produit'
  );
});

test('une page produit sans personnage reconnu le dit au lieu de rester muette', async () => {
  const { start, findLauncherButton, panelText } = await setup({
    head: '<meta property="og:title" content="Personnage Inconnu">',
    sendMessage: () => ({ status: STATUS.NOT_FOUND })
  });

  await start();

  assert.equal(findLauncherButton().hidden, false, 'le lanceur reste ouvrable');
  assert.match(panelText(), /Aucun personnage trouve/);
});

// Regression: a sendMessage rejection (sleeping service worker, invalidated context)
// must not leak as an unhandled rejection, must show the error state, must keep the
// launcher visible so the error is actually reachable, and - since this is not a
// definitive answer about the product - must not leave `dernier` armed, so a later
// re-detection of the same product retries instead of being silently skipped by the
// dedupe guard.
test('un rejet de sendMessage affiche l erreur, laisse le lanceur ouvrable et permet une nouvelle tentative', async () => {
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
  assert.equal(
    findLauncherButton().hidden,
    false,
    'un etat erreur ecrit dans le panneau doit rester ouvrable depuis le lanceur'
  );
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

// Regression: NOT_CONFIGURED is not a definitive answer about this product either -
// the user can go and set the API URL, come back to the tab, and must get a retry.
// It must also leave the launcher visible so the "configure your API" message is
// actually reachable.
test('un statut not-configured laisse le lanceur ouvrable et efface le garde-fou', async () => {
  let resolveCalls = 0;
  const { doc, calls, start, findLauncherButton, findPanelShadow } = await setup({
    head: '<meta property="og:title" content="Marneus Calgar">',
    sendMessage: (message) => {
      if (message.type !== MSG.RESOLVE) return null;
      resolveCalls += 1;
      if (resolveCalls === 1) return { status: STATUS.NOT_CONFIGURED };
      return { status: STATUS.MATCH, character: { id: 'marneus-calgar', name: 'Marneus Calgar' } };
    }
  });

  await start();

  assert.equal(calls.length, 1);
  assert.equal(findLauncherButton().hidden, false, 'le message de configuration doit etre atteignable');
  // l API de production exige une cle : le message doit orienter vers elle, pas seulement vers l adresse
  assert.match(findPanelShadow().querySelector('.wx-state').textContent, /cle d API dans les options/);

  doc.defaultView.history.pushState({}, '', '/autre-chemin');
  await wait(550);

  assert.equal(calls.length, 2, 'un statut not-configured ne doit pas bloquer une nouvelle tentative');
  assert.equal(findPanelShadow().querySelector('.wx-state'), null);
});

// Regression: warhammer.com is a React SPA whose product title lands in the DOM after
// hydration. A single document_idle pass returns null and used to give up for the life
// of the page view. A bounded MutationObserver must pick the node up when it appears.
test('une mutation du body qui fait apparaitre le titre declenche la detection', async (t) => {
  const { doc, calls, start, findLauncherButton } = await setup(
    {
      body: '<div id="app"></div>',
      sendMessage: (message) =>
        message.type === MSG.RESOLVE
          ? { status: STATUS.MATCH, character: { id: 'marneus-calgar', name: 'Marneus Calgar' } }
          : null
    },
    t
  );

  await start();

  assert.deepEqual(calls.map((call) => call.type), [MSG.CLEAR_BADGE], 'rien a resoudre au premier passage');
  assert.equal(findLauncherButton().hidden, true);

  const titre = doc.createElement('h1');
  titre.textContent = 'Marneus Calgar';
  doc.querySelector('#app').append(titre);
  await wait(20);

  assert.deepEqual(
    calls.map((call) => call.type),
    [MSG.CLEAR_BADGE, MSG.RESOLVE],
    'l apparition du titre doit relancer la resolution'
  );
  assert.equal(calls[1].name, 'marneus calgar');
  assert.equal(findLauncherButton().hidden, false);

  // l observateur se deconnecte au premier succes : une mutation ulterieure ne
  // doit plus rien declencher
  doc.querySelector('#app').append(doc.createElement('span'));
  await wait(20);
  assert.equal(calls.length, 2, 'l observateur doit etre deconnecte apres le premier succes');
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


// Regression (signalee a l usage) : sur une SPA le DOM change apres l URL. Relire
// le titre trop tot renvoie encore le produit qu on vient de quitter, et le garde
// anti-doublon coupait alors court sans armer l observateur, laissant le panneau
// fige sur le personnage precedent jusqu au rechargement de la page.
test('le panneau ne garde pas le personnage precedent apres une navigation SPA', async () => {
  const { doc, calls, start, panelText, findLauncherButton } = await setup({
    head: '<meta property="og:title" content="Marneus Calgar">',
    sendMessage: (message) => {
      if (message.type !== MSG.RESOLVE) return null;
      return { status: STATUS.MATCH, character: { id: message.name, name: message.name } };
    }
  });

  await start();
  assert.match(panelText(), /marneus calgar/);

  // l URL change mais le DOM porte encore l ancien titre
  doc.defaultView.history.pushState({}, '', '/autre-produit');
  await wait(550);

  assert.doesNotMatch(panelText(), /marneus calgar/, 'la fiche precedente ne doit plus etre affichee');
  assert.equal(findLauncherButton().hidden, true, 'rien a ouvrir tant que le nouveau titre n est pas la');
  assert.equal(calls.filter((c) => c.type === MSG.RESOLVE).length, 1, 'aucune resolution sur un titre perime');

  // la SPA finit par mettre le DOM a jour
  doc.querySelector('meta[property="og:title"]').setAttribute('content', 'Ghazghkull Thraka');
  doc.body.append(doc.createElement('div'));
  await wait(100);

  assert.match(panelText(), /ghazghkull thraka/, 'le nouveau personnage doit remplacer l ancien');
  assert.equal(findLauncherButton().hidden, false);
});

test('revenir sur le meme produit finit par reafficher sa fiche', async () => {
  const { doc, start, panelText } = await setup({
    head: '<meta property="og:title" content="Marneus Calgar">',
    sendMessage: (message) => {
      if (message.type !== MSG.RESOLVE) return null;
      return { status: STATUS.MATCH, character: { id: message.name, name: message.name } };
    }
  });

  await start();

  // navigation vers une URL differente qui montre le meme produit : le titre ne
  // changera jamais, l observateur doit finir par accepter ce que la page montre
  doc.defaultView.history.pushState({}, '', '/meme-produit-autre-url');
  await wait(550);
  assert.doesNotMatch(panelText(), /marneus calgar/, 'le panneau est vide pendant l attente');

  await wait(10200);
  assert.match(panelText(), /marneus calgar/, 'au bout du delai la page est acceptee telle quelle');
});
