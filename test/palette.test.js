import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Lit les variables --wx-* de couleur declarees dans une feuille de style.
// Sans expression reguliere : un simple decoupage par ligne suffit ici
function palette(chemin) {
  const variables = {};
  for (const ligne of readFileSync(new URL(chemin, import.meta.url), 'utf8').split(String.fromCharCode(10))) {
    const brut = ligne.trim();
    if (!brut.startsWith('--wx-')) continue;
    const separateur = brut.indexOf(':');
    const nom = brut.slice(0, separateur).trim();
    const valeur = brut.slice(separateur + 1).split(';')[0].trim().toLowerCase();
    if (valeur.startsWith('#') && valeur.length === 7) variables[nom] = valeur;
  }
  return variables;
}

function luminance(hex) {
  const canaux = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lineaires = canaux.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lineaires[0] + 0.7152 * lineaires[1] + 0.0722 * lineaires[2];
}

function contraste(a, b) {
  const [claire, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (claire + 0.05) / (sombre + 0.05);
}

const SEUIL_AA = 4.5;

const panneau = palette('../src/content/panel/panel.css');
const options = palette('../src/options/options.css');

function verifier(feuille, paires) {
  for (const [texte, fond] of paires) {
    assert.ok(feuille[texte], `variable absente : ${texte}`);
    assert.ok(feuille[fond], `variable absente : ${fond}`);
    const ratio = contraste(feuille[texte], feuille[fond]);
    assert.ok(ratio >= SEUIL_AA, `${texte} sur ${fond} : ${ratio.toFixed(2)}:1, sous le seuil AA de ${SEUIL_AA}:1`);
  }
}

// chaque paire texte et fond reellement employee dans panel.css
test('le panneau tient le seuil AA pour chaque texte', () => {
  verifier(panneau, [
    ['--wx-encre', '--wx-parchemin'],
    ['--wx-encre', '--wx-parchemin-2'],
    ['--wx-encre', '--wx-champ'],
    ['--wx-encre-2', '--wx-parchemin'],
    ['--wx-encre-2', '--wx-parchemin-2'],
    ['--wx-encre-2', '--wx-champ'],
    ['--wx-gueules', '--wx-parchemin'],
    ['--wx-parchemin', '--wx-gueules']
  ]);
});

test('la page d options tient le seuil AA pour chaque texte', () => {
  verifier(options, [
    ['--wx-encre', '--wx-parchemin'],
    ['--wx-encre', '--wx-champ'],
    ['--wx-encre-2', '--wx-parchemin'],
    ['--wx-gueules', '--wx-parchemin'],
    ['--wx-gueules', '--wx-parchemin-2'],
    ['--wx-parchemin', '--wx-gueules'],
    ['--wx-parchemin', '--wx-gueules-fonce'],
    ['--wx-erreur', '--wx-parchemin']
  ]);
});

// deux feuilles, une seule palette : une teinte corrigee d un cote seulement
// ferait diverger le panneau et les options
test('le panneau et les options partagent les memes valeurs', () => {
  for (const [nom, valeur] of Object.entries(panneau)) {
    if (nom in options) assert.equal(options[nom], valeur, `${nom} differe entre panel.css et options.css`);
  }
});

// le lanceur vit dans son propre Shadow DOM et recopie les valeurs en dur
test('le lanceur reprend la palette du panneau', () => {
  const lanceur = readFileSync(new URL('../src/content/panel/launcher.js', import.meta.url), 'utf8').toLowerCase();
  for (const nom of ['--wx-gueules', '--wx-gueules-fonce', '--wx-parchemin', '--wx-encre']) {
    assert.ok(lanceur.includes(panneau[nom]), `le lanceur n emploie pas ${nom} (${panneau[nom]})`);
  }
  assert.ok(contraste(panneau['--wx-parchemin'], panneau['--wx-gueules']) >= SEUIL_AA);
  assert.ok(contraste(panneau['--wx-parchemin'], panneau['--wx-gueules-fonce']) >= SEUIL_AA);
});
