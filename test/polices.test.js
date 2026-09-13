import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { injecterPolices, POLICES } from '../src/content/panel/fonts.js';

const racine = new URL('../', import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, racine), 'utf8');

test('chaque police embarquee est un woff2 accompagne de sa licence OFL', () => {
  for (const { fichier } of POLICES) {
    const octets = readFileSync(new URL('src/' + fichier, racine));
    assert.equal(octets.subarray(0, 4).toString('latin1'), 'wOF2', `${fichier} n est pas un woff2`);
  }
  for (const licence of ['OFL-cinzel.txt', 'OFL-eb-garamond.txt']) {
    assert.match(lire('src/assets/fonts/' + licence), /SIL OPEN FONT LICENSE/);
  }
});

// la declaration vit dans le document de la page marchande : sans cette entree,
// le navigateur refuse de lui servir les fichiers de l extension
test('les polices sont accessibles depuis les pages marchandes', () => {
  const manifeste = JSON.parse(lire('src/manifest.json'));
  const ressources = manifeste.web_accessible_resources.flatMap((entree) => entree.resources);
  assert.ok(ressources.includes('assets/fonts/*'));
});

test('injecterPolices declare chaque police une seule fois dans le document hote', () => {
  const doc = new JSDOM('<!doctype html><head></head><body></body>').window.document;
  const getURL = (chemin) => `chrome-extension://abc/${chemin}`;

  injecterPolices(doc, getURL);
  injecterPolices(doc, getURL);

  const styles = doc.querySelectorAll('#warhadex-polices');
  assert.equal(styles.length, 1, 'une seconde injection ne doit rien dupliquer');
  assert.equal(styles[0].parentElement, doc.head);
  for (const { famille, fichier } of POLICES) {
    assert.ok(styles[0].textContent.includes(`font-family: '${famille}'`), famille);
    assert.ok(styles[0].textContent.includes(getURL(fichier)), fichier);
  }
});

test('sans element head la declaration va sur la racine du document', () => {
  const doc = new JSDOM('<!doctype html><body></body>').window.document;
  doc.head.remove();

  injecterPolices(doc, (chemin) => chemin);

  assert.ok(doc.documentElement.querySelector('#warhadex-polices'));
});

// une police nommee comme celle du site marchand redefinirait le rendu de la page
test('les polices portent des noms propres a l extension', () => {
  for (const { famille } of POLICES) assert.ok(famille.startsWith('Warhadex '), famille);
});

test('panneau, lanceur et options utilisent en premier les polices embarquees', () => {
  const titre = "'Warhadex Cinzel'";
  const texte = "'Warhadex Garamond'";
  const panneau = lire('src/content/panel/panel.css');
  const options = lire('src/options/options.css');
  const lanceur = lire('src/content/panel/launcher.js');

  for (const [nom, contenu] of [['panel.css', panneau], ['options.css', options]]) {
    assert.ok(contenu.includes(`--wx-titre: ${titre}`), `${nom} : titres`);
    assert.ok(contenu.includes(`--wx-texte: ${texte}`), `${nom} : texte courant`);
  }
  assert.ok(lanceur.includes(`13px/1 ${titre}`), 'lanceur');

  // la page d options est une page d extension : elle declare ses propres @font-face
  for (const { fichier } of POLICES) assert.ok(options.includes(`../${fichier}`), `options.css : ${fichier}`);
});
