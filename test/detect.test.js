import test from 'node:test';
import assert from 'node:assert/strict';
import { detect } from '../src/content/detect/index.js';
import { loadFixture, loadHtml } from './helpers/dom.js';

test('utiliser l adaptateur du site quand il repond', () => {
  const result = detect(loadFixture('warhammer-com-product.html'), 'https://www.warhammer.com/fr-FR/shop/x');
  assert.equal(result.site, 'www.warhammer.com');
  assert.ok(result.source.startsWith('adapter:warhammer-com'));
  assert.ok(result.normalized.length > 0);
  assert.equal(result.normalized, result.normalized.toLowerCase());
  assert.doesNotMatch(result.normalized, /warhammer|citadel/);
});

test('replier sur l extracteur generique quand l adaptateur ne trouve rien', () => {
  const doc = loadHtml('<meta property="og:title" content="Ghazghkull Thraka">');
  const result = detect(doc, 'https://www.warhammer.com/fr-FR/shop/x');
  assert.equal(result.source, 'og');
  assert.equal(result.normalized, 'ghazghkull thraka');
});

test('utiliser l extracteur generique sur un site inconnu', () => {
  const doc = loadHtml('<h1>Abaddon the Despoiler</h1>');
  const result = detect(doc, 'https://boutique-inconnue.example/produit');
  assert.equal(result.site, 'boutique-inconnue.example');
  assert.equal(result.normalized, 'abaddon the despoiler');
});

test('retourner null quand rien n est exploitable', () => {
  assert.equal(detect(loadFixture('no-metadata-category.html'), 'https://example.com/c'), null);
});

test('retourner null quand la normalisation vide le nom', () => {
  const doc = loadHtml('<h1>Warhammer 40,000</h1>');
  assert.equal(detect(doc, 'https://example.com/p'), null);
});

test('retourner null sur une url invalide', () => {
  const doc = loadHtml('<h1>Kharn the Betrayer</h1>');
  assert.equal(detect(doc, 'pas-une-url'), null);
});
