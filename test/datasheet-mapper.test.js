import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapDatasheet, indexAbilities } from '../src/core/datasheet-mapper.js';

function fixture(name) {
  return JSON.parse(readFileSync(new URL(`./fixtures/api/${name}`, import.meta.url), 'utf8'));
}

const calgar = fixture('datasheet-calgar.json');
const intercessors = fixture('datasheet-intercessors.json');
const index = indexAbilities(fixture('abilities-extrait.json').items);

test('indexAbilities cle les aptitudes par id', () => {
  assert.equal(index.get('000008343').name, 'Deep Strike');
  assert.equal(index.get('inconnu'), undefined);
});

test('mappe l identite et la faction aplatie', () => {
  const fiche = mapDatasheet(calgar, index);
  assert.equal(fiche.id, '000004183');
  assert.equal(fiche.name, 'Marneus Calgar in Armour of Antilochus');
  assert.equal(fiche.faction, 'Space Marines');
  assert.equal(fiche.role, 'Characters');
});

test('mappe une ligne de profil par modele', () => {
  const fiche = mapDatasheet(calgar, index);
  assert.equal(fiche.profiles.length, 1);
  assert.deepEqual(fiche.profiles[0], {
    name: 'MARNEUS CALGAR',
    m: '6"',
    t: '6',
    sv: '2+',
    w: '6',
    ld: '6+',
    oc: '1',
    base: '50mm',
    baseNote: null
  });
});

test('garde la taille de socle brute et ignore une precision vide', () => {
  const fiche = mapDatasheet(intercessors, index);
  assert.equal(fiche.profiles[0].base, '32mm');
  assert.equal(fiche.profiles[0].baseNote, null);

  const sansSocle = mapDatasheet({ id: 'x', name: 'Test', models: [{ base_size: ' ', base_size_descr: 'Oval' }] });
  assert.equal(sansSocle.profiles[0].base, null);
  assert.equal(sansSocle.profiles[0].baseNote, 'Oval');
});

test('deduit la sauvegarde invulnerable en ajoutant le plus', () => {
  assert.equal(mapDatasheet(calgar, index).invulnerable, '4+');
});

test('ignore une invulnerable absente notee tiret', () => {
  assert.equal(mapDatasheet(intercessors, index).invulnerable, null);
});

test('separe les armes de tir et de melee et complete les unites', () => {
  const fiche = mapDatasheet(calgar, index);
  const tir = fiche.weapons.filter((w) => w.type === 'ranged');
  const melee = fiche.weapons.filter((w) => w.type === 'melee');

  assert.equal(tir.length, 1);
  assert.equal(melee.length, 1);
  assert.deepEqual(tir[0], {
    name: 'Gauntlets of Ultramar',
    type: 'ranged',
    range: '18"',
    a: '4',
    skill: '2+',
    s: '4',
    ap: '-1',
    d: '2',
    keywords: ['pistol', 'twin-linked']
  });
  assert.equal(melee[0].range, 'Melee');
  assert.equal(melee[0].skill, '2+');
});

test('resout les aptitudes vides via l index', () => {
  const fiche = mapDatasheet(calgar, index);
  const deepStrike = fiche.abilities.find((a) => a.name === 'Deep Strike');
  assert.ok(deepStrike, 'Deep Strike absente');
  assert.equal(deepStrike.type, 'Core');
  assert.match(deepStrike.text, /Reserves/);
});

test('conserve les aptitudes deja inlinees sans toucher a l index', () => {
  const fiche = mapDatasheet(calgar, index);
  const tacticien = fiche.abilities.find((a) => a.name === 'Master Tactician');
  assert.ok(tacticien);
  assert.equal(tacticien.type, 'Datasheet');
  assert.match(tacticien.text, /Command phase/);
});

test('degrade une aptitude non resolvable en affichant son type sans texte', () => {
  const fiche = mapDatasheet(calgar, new Map());
  const core = fiche.abilities.find((a) => a.name === 'Core');
  assert.ok(core, 'aptitude non resolue absente');
  assert.equal(core.text, '');
});

test('n utilise jamais le html des descriptions', () => {
  const fiche = mapDatasheet(calgar, index);
  for (const ability of fiche.abilities) {
    assert.doesNotMatch(ability.text, /<span|<b>/);
  }
});

test('aplatit les mots cles de faction et les autres sans doublon', () => {
  const fiche = mapDatasheet(calgar, index);
  assert.ok(fiche.keywords.includes('Adeptus Astartes'));
  assert.ok(fiche.keywords.includes('Epic Hero'));
  assert.equal(new Set(fiche.keywords).size, fiche.keywords.length);
});

test('mappe les paliers de cout en extrayant le nombre de figurines', () => {
  const fiche = mapDatasheet(intercessors, index);
  assert.deepEqual(fiche.points, [
    { models: 5, label: '5 models', cost: 80 },
    { models: 10, label: '10 models', cost: 160 }
  ]);
});

test('mappe la legende en histoire et la source en attribution', () => {
  const fiche = mapDatasheet(calgar, index);
  assert.match(fiche.lore, /Marneus Calgar/);
  assert.equal(fiche.source.label, 'Space Marines');
  assert.match(fiche.source.url, /^https:\/\/wahapedia\.ru\//);
});

test('ignore silencieusement les references non rendues', () => {
  const fiche = mapDatasheet(calgar, index);
  assert.equal(fiche.stratagem_refs, undefined);
  assert.equal(fiche.leaders, undefined);
  assert.equal(fiche.detachment_ability_refs, undefined);
});

test('retourne null sur une entree inexploitable', () => {
  assert.equal(mapDatasheet(null, index), null);
  assert.equal(mapDatasheet({}, index), null);
});

test('survit a un agregat aux tableaux absents', () => {
  const fiche = mapDatasheet({ id: 'x', name: 'Test' }, index);
  assert.equal(fiche.name, 'Test');
  assert.deepEqual(fiche.profiles, []);
  assert.deepEqual(fiche.weapons, []);
  assert.deepEqual(fiche.abilities, []);
  assert.deepEqual(fiche.keywords, []);
  assert.deepEqual(fiche.points, []);
  assert.equal(fiche.invulnerable, null);
});
