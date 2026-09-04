import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../src/content/detect/normalize.js';

test('retire la marque et la ponctuation', () => {
  assert.equal(normalize('Warhammer 40,000: Marneus Calgar'), 'marneus calgar');
  assert.equal(normalize('Warhammer 40k - Ghazghkull Thraka'), 'ghazghkull thraka');
});

test('retire les accents', () => {
  assert.equal(normalize('Belisarius Cawl'), 'belisarius cawl');
  assert.equal(normalize('Bélisarius Cawl'), 'belisarius cawl');
});

test('retire le bruit commercial', () => {
  assert.equal(normalize('Citadel Miniatures - Commandant Dante (Figurine)'), 'commandant dante');
  assert.equal(normalize('Games Workshop Boxed Set: Lion El Jonson'), 'lion el jonson');
});

test('retire les codes produit et les suffixes de langue', () => {
  assert.equal(normalize('Kharn the Betrayer 43-32 (FR)'), 'kharn the betrayer');
});

test('normalise les espaces multiples', () => {
  assert.equal(normalize('  Abaddon    the   Despoiler '), 'abaddon the despoiler');
});

test('retourne une chaine vide pour une entree vide ou absente', () => {
  assert.equal(normalize(''), '');
  assert.equal(normalize(null), '');
  assert.equal(normalize('Warhammer 40,000'), '');
});
