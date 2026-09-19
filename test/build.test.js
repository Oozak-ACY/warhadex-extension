import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync, mkdtempSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Les tests ne construisent jamais dans dist : le build exige une cle, et y ecrire
// une cle de test remplacerait celle de l extension chargee dans le navigateur
const temporaires = [];
let sortie;

function repertoireTemporaire() {
  const dossier = mkdtempSync(path.join(tmpdir(), 'warhadex-build-'));
  temporaires.push(dossier);
  return dossier;
}

function manifeste(target) {
  return JSON.parse(readFileSync(path.join(sortie, target, 'manifest.json'), 'utf8'));
}

before(() => {
  sortie = repertoireTemporaire();
  execFileSync(process.execPath, ['build.mjs'], {
    stdio: 'pipe',
    env: { ...process.env, WARHADEX_DIST: sortie, WARHADEX_API_KEY: 'cle-de-test' }
  });
});

after(() => {
  for (const dossier of temporaires) rmSync(dossier, { recursive: true, force: true });
});

test('build produit les trois cibles avec le bon manifeste', () => {
  for (const target of ['chrome', 'firefox', 'safari']) {
    assert.ok(existsSync(path.join(sortie, target, 'manifest.json')), `manifest manquant pour ${target}`);
    assert.ok(existsSync(path.join(sortie, target, 'content', 'content.js')), `sources manquantes pour ${target}`);
    assert.ok(!existsSync(path.join(sortie, target, 'manifest.firefox.json')), 'surcharge non nettoyee');
  }

  const chrome = manifeste('chrome');
  assert.equal(chrome.manifest_version, 3);
  assert.ok(chrome.background.service_worker);
  assert.ok(!chrome.background.scripts);
  assert.ok(!chrome.browser_specific_settings);

  const firefox = manifeste('firefox');
  assert.deepEqual(firefox.background.scripts, ['background/service-worker.js']);
  assert.equal(firefox.background.type, 'module');
  assert.ok(!firefox.background.service_worker);
  assert.ok(firefox.browser_specific_settings.gecko.id);

  assert.ok(manifeste('safari').background.service_worker);
});

// L extension ne parle qu a warhadex-api : aucune autre API ne doit etre joignable,
// ni par une permission accordee ni par une permission facultative demandable
test('seule l API warhadex est joignable en plus des sites marchands', () => {
  const chrome = manifeste('chrome');
  assert.equal(chrome.optional_host_permissions, undefined, 'aucune permission d hote facultative');

  const autres = chrome.host_permissions.filter(
    (motif) => !/\.(warhammer\.com|elementgames\.co\.uk|waylandgames\.co\.uk|philibertnet\.com)\//.test(motif)
  );
  assert.deepEqual(autres, ['https://warhadex-api.orion-sphere.fr/*']);
});

// l identifiant est definitif des la premiere soumission sur addons.mozilla.org
test('firefox garde l identifiant publie', () => {
  assert.equal(manifeste('firefox').browser_specific_settings.gecko.id, 'extension-warhadex@orion-sphere.fr');
});

// Mozilla impose la declaration de collecte aux nouvelles extensions. Elle n est
// lue qu a partir de Firefox 140 : un socle plus bas installerait sans consentement
test('firefox declare la transmission du nom de produit et le socle qui la lit', () => {
  const reglages = manifeste('firefox').browser_specific_settings;
  const majeure = (version) => Number(version.split('.')[0]);
  const min = majeure(reglages.gecko.strict_min_version);
  assert.ok(min >= 140, `la declaration de collecte exige Firefox 140, declare : ${min}`);
  // Firefox pour Android ne la lit qu a partir de 142
  const minAndroid = majeure(reglages.gecko_android.strict_min_version);
  assert.ok(minAndroid >= 142, `Firefox pour Android exige 142, declare : ${minAndroid}`);
  assert.deepEqual(reglages.gecko.data_collection_permissions, { required: ['websiteContent'] });
});

test('la cle est injectee dans le build et jamais dans src', async () => {
  const dossier = repertoireTemporaire();
  // guillemet, antislash et accent grave : la cle ne doit pas pouvoir casser le module genere
  const antislash = String.fromCharCode(92);
  const cle = 'cle-de-test"' + antislash + 'avec' + '`' + 'caracteres';
  assert.ok(cle.includes(antislash), 'le test doit bien porter un antislash');

  execFileSync(process.execPath, ['build.mjs'], {
    stdio: 'pipe',
    env: { ...process.env, WARHADEX_DIST: dossier, WARHADEX_API_KEY: cle }
  });

  for (const target of ['chrome', 'firefox', 'safari']) {
    const module = await import(pathToFileURL(path.join(dossier, target, 'core', 'config.js')).href);
    assert.equal(module.CLE_API_PAR_DEFAUT, cle, `cle absente ou alteree pour ${target}`);
  }

  const source = await import(pathToFileURL(path.resolve('src/core/config.js')).href);
  assert.equal(source.CLE_API_PAR_DEFAUT, '', 'src doit garder sa valeur vide versionnee');
});

// Sans cle l extension serait installable mais incapable de joindre l API, et plus
// rien ne permet de la lui fournir : le build doit echouer au lieu de livrer ca.
// Execute dans une copie du depot pour ne pas dependre d un cle-api.local local
test('le build refuse de produire une extension sans cle', () => {
  const depot = repertoireTemporaire();
  cpSync('src', path.join(depot, 'src'), { recursive: true });
  cpSync('build.mjs', path.join(depot, 'build.mjs'));

  let erreur;
  try {
    execFileSync(process.execPath, ['build.mjs'], {
      cwd: depot,
      stdio: 'pipe',
      env: { ...process.env, WARHADEX_API_KEY: '', WARHADEX_DIST: '' }
    });
  } catch (err) {
    erreur = err;
  }

  assert.ok(erreur, 'le build aurait du echouer');
  assert.notEqual(erreur.status, 0);
  assert.match(String(erreur.stderr), /aucune cle d API/);
  assert.ok(!existsSync(path.join(depot, 'dist')), 'aucun build ne doit etre produit');
});
