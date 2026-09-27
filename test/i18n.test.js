import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { lireMessages, installerI18n } from './helpers/i18n.js';

const LOCALES = ['en', 'fr'];
const racine = new URL('../src/', import.meta.url);

function fichiersSource(dossier = racine) {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = new URL(entree.name + (entree.isDirectory() ? '/' : ''), dossier);
    if (entree.isDirectory()) return entree.name === 'vendor' ? [] : fichiersSource(chemin);
    return /\.(js|html)$/.test(entree.name) ? [chemin] : [];
  });
}

test('chaque langue porte exactement les memes cles et placeholders', () => {
  const [reference, ...autres] = LOCALES.map(lireMessages);
  for (const [index, messages] of autres.entries()) {
    const locale = LOCALES[index + 1];
    assert.deepEqual(Object.keys(messages).sort(), Object.keys(reference).sort(), `cles divergentes en ${locale}`);
    for (const [cle, entree] of Object.entries(reference)) {
      assert.deepEqual(
        Object.keys(messages[cle].placeholders ?? {}).sort(),
        Object.keys(entree.placeholders ?? {}).sort(),
        `placeholders divergents pour ${cle} en ${locale}`
      );
    }
  }
});

test('toute cle utilisee par le code existe dans les messages', () => {
  const messages = lireMessages('en');
  const utilisees = new Set();
  for (const fichier of fichiersSource()) {
    const texte = readFileSync(fichier, 'utf8');
    for (const [, cle] of texte.matchAll(/\bt\('([A-Za-z0-9_]+)'/g)) utilisees.add(cle);
    for (const [, cle] of texte.matchAll(/data-i18n="([A-Za-z0-9_]+)"/g)) utilisees.add(cle);
    for (const [, cle] of texte.matchAll(/'(state[A-Z][A-Za-z]+|column[A-Z][A-Za-z]+)'/g)) utilisees.add(cle);
    for (const [, cle] of texte.matchAll(/__MSG_([A-Za-z0-9_]+)__/g)) utilisees.add(cle);
  }

  assert.ok(utilisees.size > 20, 'le balayage du code ne trouve presque aucune cle');
  for (const cle of utilisees) assert.ok(messages[cle], `cle absente de _locales : ${cle}`);
});

test('le manifeste declare l anglais par defaut et une description traduite', () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', racine), 'utf8'));
  assert.equal(manifest.default_locale, 'en');
  assert.equal(manifest.description, '__MSG_extDescription__');
});

test('la description tient dans les 132 caracteres du Chrome Web Store', () => {
  for (const locale of LOCALES) {
    const description = lireMessages(locale).extDescription.message;
    assert.ok(description.length <= 132, `${locale} : ${description.length} caracteres`);
  }
});

test('le panneau se rend en francais quand le navigateur est en francais', async () => {
  installerI18n('fr');
  try {
    const { renderWeapons } = await import('../src/content/panel/render/weapons.js');
    const { libelleSocle } = await import('../src/content/panel/render/datasheet.js');
    const doc = new JSDOM('<!doctype html><body>').window.document;

    const node = renderWeapons(doc, [{ name: 'Bolter', type: 'ranged', keywords: [] }]);
    assert.equal(node.querySelector('h3').textContent, 'Armes de tir');
    assert.equal(node.querySelector('th:nth-child(4)').textContent, 'CT/CC');
    assert.equal(libelleSocle('90 x 52mm'), 'Socle ovale 90 x 52mm');
  } finally {
    installerI18n('en');
  }
});
