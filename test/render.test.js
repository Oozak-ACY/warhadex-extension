import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { el } from '../src/content/panel/render/el.js';
import { renderDatasheet } from '../src/content/panel/render/datasheet.js';
import { renderWeapons } from '../src/content/panel/render/weapons.js';
import { renderAbilities } from '../src/content/panel/render/abilities.js';
import { renderLore } from '../src/content/panel/render/lore.js';
import { renderState } from '../src/content/panel/render/states.js';
import { STATUS } from '../src/core/messages.js';

const doc = new JSDOM('<!doctype html><body>').window.document;

const character = {
  id: 'marneus-calgar',
  name: 'Marneus Calgar',
  faction: 'Adeptus Astartes',
  role: 'Epic Hero',
  profile: { m: '5"', t: 5, sv: '2+', w: 6, ld: '5+', oc: 1 },
  invulnerable: '4+',
  weapons: [
    { name: 'Gantelets', type: 'ranged', range: '18"', a: 3, skill: '2+', s: 4, ap: 0, d: 1, keywords: ['Twin-linked'] },
    { name: 'Gantelets', type: 'melee', range: 'Melee', a: 6, skill: '2+', s: 8, ap: -2, d: 2, keywords: [] }
  ],
  abilities: [{ name: 'Tacticien', type: 'core', text: 'Texte factice.' }],
  keywords: ['Infantry', 'Character'],
  points: [{ models: 1, cost: 95 }],
  lore: 'Notice factice.',
  books: [{ title: 'Roman', author: 'Auteur', year: 2000, url: '' }]
};

test('el cree un element avec classe et texte', () => {
  const node = el(doc, 'span', { class: 'x' }, 'bonjour');
  assert.equal(node.tagName, 'SPAN');
  assert.equal(node.className, 'x');
  assert.equal(node.textContent, 'bonjour');
});

test('el n interprete jamais le html', () => {
  const node = el(doc, 'p', {}, '<img src=x onerror=alert(1)>');
  assert.equal(node.querySelector('img'), null);
  assert.equal(node.textContent, '<img src=x onerror=alert(1)>');
});

test('renderDatasheet affiche les six caracteristiques et l invulnerable', () => {
  const node = renderDatasheet(doc, character);
  const labels = [...node.querySelectorAll('.wx-stat-label')].map((n) => n.textContent);
  assert.deepEqual(labels, ['M', 'T', 'SV', 'W', 'LD', 'OC']);
  assert.match(node.textContent, /4\+/);
  assert.match(node.textContent, /95/);
});

test('renderWeapons separe les armes de tir et de melee', () => {
  const node = renderWeapons(doc, character.weapons);
  const titres = [...node.querySelectorAll('h3')].map((n) => n.textContent);
  assert.deepEqual(titres, ['Armes de tir', 'Armes de melee']);
  assert.equal(node.querySelectorAll('tbody tr').length, 2);
});

test('renderWeapons retourne null sans arme', () => {
  assert.equal(renderWeapons(doc, []), null);
  assert.equal(renderWeapons(doc, undefined), null);
});

test('renderAbilities liste les aptitudes et les mots cles', () => {
  const node = renderAbilities(doc, character);
  assert.match(node.textContent, /Tacticien/);
  assert.match(node.textContent, /Infantry/);
});

test('renderLore retourne null quand la fiche n a ni lore ni livres', () => {
  assert.equal(renderLore(doc, { ...character, lore: '', books: [] }), null);
});

test('renderLore affiche l histoire et les livres', () => {
  const node = renderLore(doc, character);
  assert.match(node.textContent, /Notice factice/);
  assert.match(node.textContent, /Roman/);
});

test('renderLore transforme une url https en lien cliquable', () => {
  const node = renderLore(doc, {
    ...character,
    books: [{ title: 'Roman', author: 'Auteur', year: 2000, url: 'https://example.com/roman' }]
  });
  const lien = node.querySelector('a');
  assert.ok(lien, 'aucun lien genere pour une url https');
  assert.equal(lien.getAttribute('href'), 'https://example.com/roman');
  assert.equal(lien.textContent, 'Roman');
});

test('renderLore refuse une url javascript et retombe sur un span', () => {
  const node = renderLore(doc, {
    ...character,
    books: [{ title: 'Roman', author: 'Auteur', year: 2000, url: 'javascript:alert(1)' }]
  });
  assert.equal(node.querySelector('a'), null, 'un lien ne doit jamais porter un href javascript:');
  assert.match(node.textContent, /Roman/);
});

test('renderState produit un message par statut', () => {
  for (const status of [STATUS.NOT_FOUND, STATUS.NOT_CONFIGURED, STATUS.OFFLINE, STATUS.ERROR]) {
    assert.ok(renderState(doc, status).textContent.length > 0, `message vide pour ${status}`);
  }
});
