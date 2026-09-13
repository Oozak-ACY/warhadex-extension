import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

test('build produit les trois cibles avec le bon manifeste', () => {
  rmSync('dist', { recursive: true, force: true });
  execFileSync(process.execPath, ['build.mjs'], { stdio: 'pipe' });

  for (const target of ['chrome', 'firefox', 'safari']) {
    assert.ok(existsSync(`dist/${target}/manifest.json`), `manifest manquant pour ${target}`);
    assert.ok(existsSync(`dist/${target}/content/content.js`), `sources manquantes pour ${target}`);
    assert.ok(!existsSync(`dist/${target}/manifest.firefox.json`), 'surcharge non nettoyee');
  }

  const chrome = JSON.parse(readFileSync('dist/chrome/manifest.json', 'utf8'));
  assert.equal(chrome.manifest_version, 3);
  assert.ok(chrome.background.service_worker);
  assert.ok(!chrome.background.scripts);
  assert.ok(!chrome.browser_specific_settings);

  const firefox = JSON.parse(readFileSync('dist/firefox/manifest.json', 'utf8'));
  assert.deepEqual(firefox.background.scripts, ['background/service-worker.js']);
  assert.equal(firefox.background.type, 'module');
  assert.ok(!firefox.background.service_worker);
  assert.ok(firefox.browser_specific_settings.gecko.id);

  const safari = JSON.parse(readFileSync('dist/safari/manifest.json', 'utf8'));
  assert.ok(safari.background.service_worker);
});

// L API locale documentee dans le README est sur http://127.0.0.1:8787 : sans motif
// http de bouclage declare, permissions.request rejette et la page d options ne peut
// rien enregistrer. On refuse en revanche tout http://*/* general.
test('les permissions d hote facultatives couvrent le bouclage http sans ouvrir tout http', () => {
  const chrome = JSON.parse(readFileSync('dist/chrome/manifest.json', 'utf8'));
  // l API de reference est locale et accordee des l installation : plus rien a
  // saisir ni a autoriser dans le cas courant
  for (const motif of ['http://localhost/*', 'http://127.0.0.1/*']) {
    assert.ok(chrome.host_permissions.includes(motif), `motif local manquant : ${motif}`);
  }
  assert.deepEqual(chrome.optional_host_permissions, ['https://*/*'], 'seule une API distante reste optionnelle');
  assert.ok(!chrome.host_permissions.includes('http://*/*'), 'http general ne doit pas etre declare');
});

test('firefox declare un socle de version compatible manifest v3', () => {
  const firefox = JSON.parse(readFileSync('dist/firefox/manifest.json', 'utf8'));
  const min = Number(firefox.browser_specific_settings.gecko.strict_min_version.split('.')[0]);
  assert.ok(min >= 116, `optional_host_permissions exige Firefox 116 ou superieur, declare : ${min}`);
});

// L API de production ne repond pas aux preflight CORS. Un service worker
// d extension ne contourne CORS que pour un hote accorde a l installation : en
// permission facultative non demandee, chaque appel serait bloque
test('l API de production est accordee des l installation', () => {
  const chrome = JSON.parse(readFileSync('dist/chrome/manifest.json', 'utf8'));
  assert.ok(chrome.host_permissions.includes('https://warhadex-api.orion-sphere.fr/*'));
});

// Le build ecrit dans un repertoire temporaire : npm test reconstruit dist, et y
// injecter une fausse cle ecraserait celle de l extension chargee dans le navigateur
test('la cle est injectee dans le build et jamais dans src', async () => {
  const sortie = mkdtempSync(path.join(tmpdir(), 'warhadex-build-'));
  // guillemets et antislash : la cle ne doit pas pouvoir casser le module genere
  const cle = 'cle-de-test"\avec`caracteres';

  try {
    execFileSync(process.execPath, ['build.mjs'], {
      stdio: 'pipe',
      env: { ...process.env, WARHADEX_DIST: sortie, WARHADEX_API_KEY: cle }
    });

    for (const target of ['chrome', 'firefox', 'safari']) {
      const module = await import(pathToFileURL(path.join(sortie, target, 'core', 'config.js')).href);
      assert.equal(module.CLE_API_PAR_DEFAUT, cle, `cle absente ou alteree pour ${target}`);
    }

    const source = await import(pathToFileURL(path.resolve('src/core/config.js')).href);
    assert.equal(source.CLE_API_PAR_DEFAUT, '', 'src doit garder sa valeur vide versionnee');
  } finally {
    rmSync(sortie, { recursive: true, force: true });
  }
});
