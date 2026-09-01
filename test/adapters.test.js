import test from 'node:test';
import assert from 'node:assert/strict';
import { findAdapter } from '../src/content/detect/registry.js';
import { loadFixture, loadHtml } from './helpers/dom.js';

test('router chaque domaine vers son adaptateur', () => {
  assert.equal(findAdapter('https://www.warhammer.com/fr-FR/shop/marneus-calgar-2020').id, 'warhammer-com');
  assert.equal(findAdapter('https://elementgames.co.uk/warhammer-40000/x/y').id, 'element-games');
  assert.equal(findAdapter('https://www.waylandgames.co.uk/products/marneus-calgar').id, 'wayland-games');
  assert.equal(findAdapter('https://www.philibertnet.com/fr/games-workshop/1234.html').id, 'philibert');
});

test('retourner null pour un domaine inconnu', () => {
  assert.equal(findAdapter('https://example.com/produit'), null);
});

test('chaque adaptateur extrait le nom de sa fixture', () => {
  const cas = [
    ['https://www.warhammer.com/fr-FR/shop/x', 'warhammer-com-product.html'],
    ['https://elementgames.co.uk/x', 'element-games-product.html'],
    ['https://www.waylandgames.co.uk/x', 'wayland-games-product.html'],
    ['https://www.philibertnet.com/fr/x', 'philibert-product.html']
  ];

  for (const [url, fixture] of cas) {
    const result = findAdapter(url).extract(loadFixture(fixture));
    assert.ok(result, `extraction vide pour ${fixture}`);
    assert.ok(result.raw.length > 0, `nom vide pour ${fixture}`);
  }
});

test('chaque adaptateur retourne null plutot que de deviner sur une page sans produit', () => {
  const urls = [
    'https://www.warhammer.com/fr-FR/x',
    'https://elementgames.co.uk/x',
    'https://www.waylandgames.co.uk/x',
    'https://www.philibertnet.com/fr/x'
  ];
  const doc = loadHtml('<body><nav>Catalogue</nav></body>');

  for (const url of urls) {
    assert.equal(findAdapter(url).extract(doc), null, `faux positif pour ${url}`);
  }
});
