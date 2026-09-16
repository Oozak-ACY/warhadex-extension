import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { LOGOS } from '../src/content/panel/logos.js';
import { createLauncher } from '../src/content/panel/launcher.js';
import { createHome } from '../src/content/panel/render/home.js';

const racine = new URL('../', import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, racine));
const manifeste = JSON.parse(lire('src/manifest.json').toString('utf8'));

function dimensionsPng(chemin) {
  const octets = lire(chemin);
  assert.equal(octets.subarray(1, 4).toString('latin1'), 'PNG', `${chemin} n est pas un PNG`);
  return { largeur: octets.readUInt32BE(16), hauteur: octets.readUInt32BE(20), alpha: octets[25] === 6 };
}

test('chaque icone declaree existe a la taille annoncee avec transparence', () => {
  const declarees = [...Object.entries(manifeste.icons), ...Object.entries(manifeste.action.default_icon)];
  assert.ok(declarees.some(([taille]) => taille === '32'), 'icone 32 absente pour les ecrans haute densite');

  for (const [taille, chemin] of declarees) {
    const { largeur, hauteur, alpha } = dimensionsPng(`src/${chemin}`);
    assert.equal(largeur, Number(taille), chemin);
    assert.equal(hauteur, Number(taille), chemin);
    assert.ok(alpha, `${chemin} sans canal alpha`);
  }
});

test('les logos du panneau existent et sont accessibles depuis les pages marchandes', () => {
  const ressources = manifeste.web_accessible_resources.flatMap((entree) => entree.resources);
  assert.ok(ressources.includes('assets/logo/*'));

  for (const chemin of Object.values(LOGOS)) {
    assert.match(chemin, /^assets\/logo\//);
    dimensionsPng(`src/${chemin}`);
  }
});

test('la page d options reference un logo existant', () => {
  const html = lire('src/options/options.html').toString('utf8');
  const source = html.match(/<h1><img src="\.\.\/([^"]+)" alt=""/);
  assert.ok(source, 'logo absent du titre ou sans alt vide');
  dimensionsPng(`src/${source[1]}`);
});

// build.mjs copie tout src : un original de 200 Ko alourdirait chaque navigateur
test('les originaux du logo restent hors de l extension', () => {
  const dossier = new URL('src/assets/logo/', racine);
  let total = 0;
  for (const nom of readdirSync(dossier)) {
    assert.match(nom, /\.png$/, `${nom} n a rien a faire dans src`);
    total += statSync(new URL(nom, dossier)).size;
  }
  assert.ok(total < 100 * 1024, `logos embarques trop lourds : ${total} octets`);
});

test('le lanceur affiche le logo en decoration sans changer son libelle', () => {
  const doc = new JSDOM('<!doctype html><body>').window.document;
  createLauncher({ doc, onClick: () => {}, iconUrl: 'stub://assets/logo/tete-vert-56.png' });

  const bouton = doc.body.firstElementChild.shadowRoot.querySelector('button');
  const logo = bouton.querySelector('img');
  assert.equal(logo.getAttribute('src'), 'stub://assets/logo/tete-vert-56.png');
  assert.equal(logo.getAttribute('alt'), '');
  assert.equal(bouton.textContent, 'Voir les regles');
});

test('sans adresse de logo le lanceur reste un simple bouton texte', () => {
  const doc = new JSDOM('<!doctype html><body>').window.document;
  createLauncher({ doc, onClick: () => {} });

  const bouton = doc.body.firstElementChild.shadowRoot.querySelector('button');
  assert.equal(bouton.querySelector('img'), null);
  assert.equal(bouton.classList.contains('wx-avec-logo'), false);
});

test('l accueil place le filigrane apres la liste pour que la CSS le masque des qu elle se remplit', () => {
  const doc = new JSDOM('<!doctype html><body>').window.document;
  const home = createHome(doc, { onSelect: () => {}, onSearch: async () => [], filigraneUrl: 'stub://f.png' });

  const filigrane = home.node.querySelector('.wx-filigrane');
  assert.equal(filigrane.previousElementSibling.className, 'wx-home-list');
  assert.equal(filigrane.getAttribute('alt'), '');
  assert.equal(filigrane.getAttribute('aria-hidden'), 'true');

  const css = lire('src/content/panel/panel.css').toString('utf8');
  assert.ok(css.includes('.wx-home-list:empty + .wx-filigrane'));

  const sans = createHome(doc, { onSelect: () => {}, onSearch: async () => [] });
  assert.equal(sans.node.querySelector('.wx-filigrane'), null);
});
