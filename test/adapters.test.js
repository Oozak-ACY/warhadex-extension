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

// Le nom attendu est verifie mot pour mot : un simple `length > 0` passerait encore
// si l adaptateur attrapait un titre de section ou un fil d Ariane a la place du
// produit, ce qui enverrait une requete inutile a l API.
test('chaque adaptateur extrait le nom de sa fixture', () => {
  const cas = [
    [
      'https://www.warhammer.com/fr-FR/shop/x',
      'warhammer-com-product.html',
      'Marneus Calgar in Armour of Antilochus',
      'adapter:warhammer-com:[data-testid="hero-product-card-name"]'
    ],
    [
      'https://elementgames.co.uk/x',
      'element-games-product.html',
      'Marneus Calgar In Armour Of Antilochus',
      'adapter:element-games:.product-page-title h1'
    ],
    [
      'https://www.waylandgames.co.uk/x',
      'wayland-games-product.html',
      'Ultramarines: Marneus Calgar in Armour of Antilochus',
      'adapter:wayland-games:h1[class*="ProductInfo_detailTitle"]'
    ],
    [
      'https://www.philibertnet.com/fr/x',
      'philibert-product.html',
      'W40K : Ultramarines - Marneus Calgar in Armour of Antilochus',
      'adapter:philibert:#product-title'
    ]
  ];

  for (const [url, fixture, attendu, source] of cas) {
    const result = findAdapter(url).extract(loadFixture(fixture));
    assert.ok(result, `extraction vide pour ${fixture}`);
    assert.equal(result.raw, attendu, `nom inattendu pour ${fixture}`);
    assert.equal(result.source, source, `selecteur inattendu pour ${fixture}`);
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
