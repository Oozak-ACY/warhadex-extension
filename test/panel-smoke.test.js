import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { STATUS } from '../src/core/messages.js';

// panel.js loads its CSS via `browser.runtime.getURL` + `fetch`, both stubbed here
// since jsdom is not a real extension context
const FAKE_CSS = '.wx-root { color: red; }';

const character = {
  id: 'marneus-calgar',
  name: 'Marneus Calgar',
  faction: 'Adeptus Astartes',
  role: 'Epic Hero',
  profiles: [{ name: 'MARNEUS CALGAR', m: '5"', t: 5, sv: '2+', w: 6, ld: '5+', oc: 1 }],
  weapons: [{ name: 'Gantelets', type: 'melee', range: 'Melee', a: 6, skill: '2+', s: 8, ap: -2, d: 2, keywords: [] }],
  abilities: [],
  keywords: [],
  points: [],
  lore: 'Histoire.',
  books: []
};

async function setup({ fetchImpl } = {}) {
  globalThis.browser = { runtime: { getURL: (path) => `stub://${path}` } };
  globalThis.fetch = fetchImpl ?? (async () => ({ text: async () => FAKE_CSS }));

  const dom = new JSDOM('<!doctype html><body>');
  const doc = dom.window.document;
  const selected = [];
  const { createPanel } = await import('../src/content/panel/panel.js');
  const panel = await createPanel({ doc, onSelect: (id) => selected.push(id) });
  const shadow = doc.body.firstElementChild.shadowRoot;

  return { doc, shadow, panel, selected };
}

test('createPanel monte un host avec shadow dom et charge le css via fetch', async () => {
  const { doc, shadow } = await setup();
  assert.ok(doc.body.firstElementChild, 'host absent du body');
  assert.ok(shadow, 'pas de shadow root');
  assert.equal(shadow.querySelector('style').textContent, FAKE_CSS);
  assert.equal(shadow.querySelector('.wx-root').getAttribute('data-open'), 'false');
});

test('createPanel monte le panneau sans css quand le fetch echoue', async () => {
  const { doc, shadow } = await setup({
    fetchImpl: async () => {
      throw new Error('reseau indisponible');
    }
  });
  assert.ok(doc.body.firstElementChild, 'le panneau doit exister meme sans feuille de style');
  assert.ok(shadow.querySelector('.wx-root'), 'le panneau doit rester utilisable sans feuille de style');
  assert.equal(shadow.querySelector('style').textContent, '');
});

test('open et close bascule data-open', async () => {
  const { shadow, panel } = await setup();
  const root = shadow.querySelector('.wx-root');
  panel.open();
  assert.equal(root.getAttribute('data-open'), 'true');
  panel.close();
  assert.equal(root.getAttribute('data-open'), 'false');
});

test('showState affiche un message pour chaque statut et retire les onglets', async () => {
  const { shadow, panel } = await setup();
  for (const status of [STATUS.NOT_FOUND, STATUS.NOT_CONFIGURED, STATUS.OFFLINE, STATUS.ERROR]) {
    panel.showState(status);
    assert.ok(shadow.querySelector('.wx-state').textContent.length > 0);
  }
  assert.equal(shadow.querySelectorAll('.wx-tab').length, 0);
});

test('showMatches affiche un bouton par correspondance et declenche onSelect', async () => {
  const { doc, shadow, panel, selected } = await setup();
  panel.showMatches([
    { id: 'a', name: 'Alpha', faction: 'Chaos' },
    { id: 'b', name: 'Beta', faction: 'Orks' }
  ]);
  const boutons = [...shadow.querySelectorAll('.wx-match')];
  assert.equal(boutons.length, 2);
  boutons[1].dispatchEvent(new doc.defaultView.Event('click', { bubbles: true }));
  assert.deepEqual(selected, ['b']);
});

test('showCharacter cree un onglet Histoire et bascule la vue au clic', async () => {
  const { doc, shadow, panel } = await setup();
  panel.showCharacter(character);

  const tabs = [...shadow.querySelectorAll('.wx-tab')];
  assert.deepEqual(tabs.map((t) => t.textContent), ['Regles', 'Histoire']);
  assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
  assert.ok(shadow.querySelector('.wx-datasheet'));

  tabs[1].dispatchEvent(new doc.defaultView.Event('click', { bubbles: true }));
  assert.equal(tabs[0].getAttribute('aria-selected'), 'false');
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
  assert.ok(shadow.querySelector('.wx-lore'));
  assert.equal(shadow.querySelector('.wx-datasheet'), null);
});

test('showCharacter affiche la source en pied de l onglet Regles', async () => {
  const { shadow, panel } = await setup();
  panel.showCharacter({
    ...character,
    source: { label: 'Codex factice', url: 'https://example.com/codex' }
  });

  const pied = shadow.querySelector('.wx-source');
  assert.ok(pied, 'la source doit etre rendue dans l onglet Regles');
  assert.equal(pied.querySelector('a').getAttribute('href'), 'https://example.com/codex');
});

test('showMatches sans faction n affiche pas de separateur orphelin', async () => {
  const { shadow, panel } = await setup();
  panel.showMatches([{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta', faction: 'Orks' }]);

  const boutons = [...shadow.querySelectorAll('.wx-match')].map((b) => b.textContent);
  assert.deepEqual(boutons, ['Alpha', 'Beta - Orks']);
});

test('showCharacter sans lore ne cree pas d onglets', async () => {
  const { shadow, panel } = await setup();
  panel.showCharacter({ ...character, lore: '', books: [] });
  assert.equal(shadow.querySelectorAll('.wx-tab').length, 0);
});

// La feuille de style vit hors du Shadow DOM monte par jsdom, qui n applique aucune
// cascade : on verifie au moins que chaque classe emise par les modules de rendu a
// bien une regle, et que la barre d onglets vide est effacee plutot que de laisser
// une bordure residuelle.
test('la feuille de style couvre chaque classe rendue', () => {
  const css = readFileSync(new URL('../src/content/panel/panel.css', import.meta.url), 'utf8');
  const selecteurs = [
    '.wx-root',
    '.wx-close',
    '.wx-tabs',
    '.wx-tabs:empty',
    '.wx-tab',
    '.wx-head',
    '.wx-sub',
    '.wx-stats',
    '.wx-stat',
    '.wx-invul',
    '.wx-points',
    '.wx-table',
    '.wx-keywords',
    '.wx-books',
    '.wx-book-meta',
    '.wx-source',
    '.wx-state',
    '.wx-match'
  ];

  for (const selecteur of selecteurs) {
    assert.ok(css.includes(selecteur), `aucune regle pour ${selecteur}`);
  }
});

test('destroy retire l ecouteur keydown du document', async () => {
  const { doc, shadow, panel } = await setup();
  const root = shadow.querySelector('.wx-root');

  panel.open();
  assert.equal(root.getAttribute('data-open'), 'true');

  panel.destroy();
  doc.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  assert.equal(root.getAttribute('data-open'), 'true', 'la touche Echap ne doit plus agir apres destroy');
});
