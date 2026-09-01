import test from 'node:test';
import assert from 'node:assert/strict';
import { extractGeneric } from '../src/content/detect/generic.js';
import { loadFixture, loadHtml } from './helpers/dom.js';

test('preferer le JSON-LD Product y compris dans un @graph', () => {
  const result = extractGeneric(loadFixture('generic-jsonld-product.html'));
  assert.deepEqual(result, { raw: 'Warhammer 40,000: Marneus Calgar', source: 'jsonld' });
});

test('replier sur og:title quand il n y a pas de JSON-LD', () => {
  const doc = loadHtml('<meta property="og:title" content="Ghazghkull Thraka"><h1>Autre</h1>');
  assert.deepEqual(extractGeneric(doc), { raw: 'Ghazghkull Thraka', source: 'og' });
});

test('replier sur le premier h1 en dernier recours', () => {
  const doc = loadHtml('<h1>  Abaddon the Despoiler  </h1>');
  assert.deepEqual(extractGeneric(doc), { raw: 'Abaddon the Despoiler', source: 'heading' });
});

test('ignorer un JSON-LD illisible sans lever', () => {
  const doc = loadHtml('<script type="application/ld+json">{ pas du json</script><h1>Kharn</h1>');
  assert.deepEqual(extractGeneric(doc), { raw: 'Kharn', source: 'heading' });
});

test('retourner null sur une page sans metadonnee exploitable', () => {
  assert.equal(extractGeneric(loadFixture('no-metadata-category.html')), null);
});
