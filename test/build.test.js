import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync } from 'node:fs';

test('build produit les trois cibles avec le bon manifeste', () => {
  rmSync('dist', { recursive: true, force: true });
  execFileSync(process.execPath, ['build.mjs']);

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
  for (const motif of ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*']) {
    assert.ok(chrome.optional_host_permissions.includes(motif), `motif manquant : ${motif}`);
  }
  assert.ok(!chrome.optional_host_permissions.includes('http://*/*'), 'http general ne doit pas etre declare');
});

test('firefox declare un socle de version compatible manifest v3', () => {
  const firefox = JSON.parse(readFileSync('dist/firefox/manifest.json', 'utf8'));
  const min = Number(firefox.browser_specific_settings.gecko.strict_min_version.split('.')[0]);
  assert.ok(min >= 109, `Manifest V3 exige Firefox 109 ou superieur, declare : ${min}`);
});
