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

test('firefox declare un socle de version compatible manifest v3', () => {
  const firefox = manifeste('firefox');
  const min = Number(firefox.browser_specific_settings.gecko.strict_min_version.split('.')[0]);
  assert.ok(min >= 109, `Manifest V3 exige Firefox 109 ou superieur, declare : ${min}`);
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
