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

// L extension ne parle qu a warhadex-api : aucune autre API ne doit etre joignable,
// ni par une permission accordee ni par une permission facultative demandable
test('seule l API warhadex est joignable en plus des sites marchands', () => {
  const chrome = JSON.parse(readFileSync('dist/chrome/manifest.json', 'utf8'));
  assert.equal(chrome.optional_host_permissions, undefined, 'aucune permission d hote facultative');

  const autres = chrome.host_permissions.filter(
    (motif) => !/\.(warhammer\.com|elementgames\.co\.uk|waylandgames\.co\.uk|philibertnet\.com)\//.test(motif)
  );
  assert.deepEqual(autres, ['https://warhadex-api.orion-sphere.fr/*']);
});

test('firefox declare un socle de version compatible manifest v3', () => {
  const firefox = JSON.parse(readFileSync('dist/firefox/manifest.json', 'utf8'));
  const min = Number(firefox.browser_specific_settings.gecko.strict_min_version.split('.')[0]);
  assert.ok(min >= 109, `Manifest V3 exige Firefox 109 ou superieur, declare : ${min}`);
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
