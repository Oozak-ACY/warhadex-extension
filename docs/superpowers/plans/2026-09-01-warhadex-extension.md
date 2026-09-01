# Warhadex Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire une extension Manifest V3 pour Chrome, Firefox et Safari qui reconnait le personnage Warhammer 40,000 vendu sur une page produit et affiche ses statistiques et regles dans un panneau injecte.

**Architecture:** Le content script detecte le nom du produit via un registre d'adaptateurs par site avec repli generique, l'envoie au service worker qui seul accede au reseau, interroge l'API distante de l'utilisateur et met en cache. Le panneau est rendu dans un Shadow DOM par des fonctions pures. Aucune dependance runtime, aucun bundler.

**Tech Stack:** JavaScript ESM natif, WebExtensions MV3, `node:test` et `jsdom` pour les tests, `node:http` pour le serveur mock.

**Spec:** `docs/superpowers/specs/2026-08-31-warhadex-extension-design.md`

## Global Constraints

- Manifest V3. Socles de version : Chrome 111+, Firefox 101+, Safari 16.4+.
- Aucune dependance runtime. `jsdom` est la seule devDependency, reservee aux tests.
- Aucun bundler. Les content scripts MV3 ne supportant pas `import` statique, l'entree est un script classique qui charge les modules par `import()` dynamique sur `browser.runtime.getURL()`. Tous les modules charges ainsi doivent figurer dans `web_accessible_resources`.
- Style de code : commentaires concis et uniquement si necessaires, sans ponctuation finale ni emoji. Aucun `console.log` de debug dans le code livre.
- Interface utilisateur en francais.
- Jamais de `innerHTML`. Toute insertion de contenu venant de l'API passe par `textContent` et `createElement`.
- Le content script n'emet aucune requete vers un hote distant. Tout acces reseau passe par le service worker. Seule exception, un `fetch` sur une ressource interne de l'extension via `runtime.getURL`, qui ne sort pas du navigateur.
- La cle d'API ne quitte jamais le service worker.
- Le jeu de donnees du mock utilise des noms de personnages reels mais des textes de regles explicitement marques comme factices. Aucun contenu Games Workshop n'est reproduit dans ce depot.

---

## Structure des fichiers

```
WarhadexWebExtension/
  package.json
  build.mjs
  README.md
  docs/
    api-contract.md
    superpowers/
      specs/2026-08-31-warhadex-extension-design.md
      plans/2026-09-01-warhadex-extension.md
  mock-api/
    server.mjs                      serveur de reference node:http
    data/characters.json            jeu de donnees d'exemple
  src/
    manifest.json                   Chrome et Safari
    manifest.firefox.json           surcharges Gecko
    assets/icons/                   icon-16 48 128 .png
    vendor/browser.js               shim d'espace de noms browser
    core/
      settings.js                   lecture ecriture des reglages
      cache.js                      cache TTL sur storage.local
      api-client.js                 client HTTP et erreurs typees
      messages.js                   constantes de protocole
    background/
      service-worker.js             point d'entree, routage des messages
      badge.js                      etat du badge par onglet
    content/
      content.js                    entree classique, charge main.js
      main.js                       orchestration content script
      spa-observer.js               detection de navigation SPA
      detect/
        index.js                    orchestration de la detection
        normalize.js                nettoyage du nom produit
        generic.js                  extracteur JSON-LD og:title h1
        registry.js                 registre des adaptateurs
        adapters/
          warhammer-com.js
          games-workshop-store.js
          element-games.js
          wayland-games.js
          philibert.js
      panel/
        launcher.js                 bouton flottant
        panel.js                    coque, Shadow DOM, onglets
        panel.css                   styles du panneau
        render/
          el.js                     helper de creation DOM
          datasheet.js              profil et invulnerable
          weapons.js                tableaux d'armes
          abilities.js              aptitudes et mots-cles
          lore.js                   histoire et livres
          states.js                 etats vide erreur chargement
    options/
      options.html
      options.js
      options.css
  test/
    fixtures/
      warhammer-com-product.html
      gw-store-product.html
      element-games-product.html
      wayland-games-product.html
      philibert-product.html
      generic-jsonld-product.html
      no-metadata-category.html
    helpers/dom.js                  chargement de fixture en jsdom
    normalize.test.js
    generic.test.js
    adapters.test.js
    detect.test.js
    cache.test.js
    api-client.test.js
    render.test.js
    build.test.js
```

---

### Task 1: Squelette, manifestes, shim et build

**Files:**
- Create: `package.json`, `build.mjs`, `.gitignore`
- Create: `src/manifest.json`, `src/manifest.firefox.json`
- Create: `src/vendor/browser.js`
- Create: `src/assets/icons/icon-16.png`, `icon-48.png`, `icon-128.png`
- Test: `test/build.test.js`

**Interfaces:**
- Consumes: rien
- Produces: `src/vendor/browser.js` exporte par defaut l'objet `browser`. `node build.mjs` ecrit `dist/chrome`, `dist/firefox`, `dist/safari`.

- [ ] **Step 1: Initialiser le depot git**

Le dossier n'est pas encore un depot.

```bash
git init
git branch -M main
```

- [ ] **Step 2: Creer package.json et .gitignore**

`package.json` :

```json
{
  "name": "warhadex",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Extension multi-navigateur affichant les regles Warhammer 40000 sur les pages produit",
  "scripts": {
    "test": "node --test test/",
    "build": "node build.mjs",
    "mock": "node mock-api/server.mjs"
  },
  "devDependencies": {
    "jsdom": "^25.0.1"
  }
}
```

`.gitignore` :

```
node_modules/
dist/
*.zip
```

- [ ] **Step 3: Ecrire le test de build**

`test/build.test.js` :

```js
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
```

- [ ] **Step 4: Lancer le test et verifier qu'il echoue**

```bash
npm install
npm test -- --test-name-pattern="build"
```

Attendu : ECHEC, `build.mjs` introuvable.

- [ ] **Step 5: Ecrire src/manifest.json**

Les domaines marchands sont listes explicitement. `optional_host_permissions` couvre l'origine arbitraire de l'API utilisateur.

```json
{
  "manifest_version": 3,
  "name": "Warhadex",
  "version": "0.1.0",
  "description": "Affiche les statistiques et les regles Warhammer 40000 du personnage sur les pages produit",
  "icons": {
    "16": "assets/icons/icon-16.png",
    "48": "assets/icons/icon-48.png",
    "128": "assets/icons/icon-128.png"
  },
  "action": {
    "default_title": "Warhadex",
    "default_icon": {
      "16": "assets/icons/icon-16.png",
      "48": "assets/icons/icon-48.png"
    }
  },
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "options_ui": {
    "page": "options/options.html",
    "open_in_tab": true
  },
  "permissions": ["storage"],
  "optional_host_permissions": ["https://*/*"],
  "host_permissions": [
    "https://*.warhammer.com/*",
    "https://*.games-workshop.com/*",
    "https://*.elementgames.co.uk/*",
    "https://*.waylandgames.co.uk/*",
    "https://*.philibertnet.com/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://*.warhammer.com/*",
        "https://*.games-workshop.com/*",
        "https://*.elementgames.co.uk/*",
        "https://*.waylandgames.co.uk/*",
        "https://*.philibertnet.com/*"
      ],
      "js": ["content/content.js"],
      "run_at": "document_idle",
      "all_frames": false
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["content/*", "core/*", "vendor/*", "assets/icons/*"],
      "matches": [
        "https://*.warhammer.com/*",
        "https://*.games-workshop.com/*",
        "https://*.elementgames.co.uk/*",
        "https://*.waylandgames.co.uk/*",
        "https://*.philibertnet.com/*"
      ]
    }
  ]
}
```

- [ ] **Step 6: Ecrire src/manifest.firefox.json**

Surcharges fusionnees par le build. `background.service_worker` est retire par la valeur `null`.

```json
{
  "background": {
    "scripts": ["background/service-worker.js"],
    "type": "module",
    "service_worker": null
  },
  "browser_specific_settings": {
    "gecko": {
      "id": "warhadex@localhost",
      "strict_min_version": "101.0"
    }
  }
}
```

- [ ] **Step 7: Ecrire src/vendor/browser.js**

```js
// Chrome expose chrome, Firefox et Safari exposent browser
const api = globalThis.browser ?? globalThis.chrome;

export default api;
```

- [ ] **Step 8: Ecrire build.mjs**

```js
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'src';
const DIST = 'dist';
const TARGETS = ['chrome', 'firefox', 'safari'];

function mergeDeep(base, patch) {
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete out[key];
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = mergeDeep(out[key] ?? {}, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

async function buildTarget(target, base, overrides) {
  const outDir = path.join(DIST, target);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await cp(SRC, outDir, { recursive: true });
  await rm(path.join(outDir, 'manifest.firefox.json'), { force: true });

  const manifest = target === 'firefox' ? mergeDeep(base, overrides) : base;
  await writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

const base = JSON.parse(await readFile(path.join(SRC, 'manifest.json'), 'utf8'));
const overrides = JSON.parse(await readFile(path.join(SRC, 'manifest.firefox.json'), 'utf8'));

for (const target of TARGETS) {
  await buildTarget(target, base, overrides);
}
```

- [ ] **Step 9: Creer les icones et les fichiers d'entree provisoires**

Les icones sont trois PNG carres unis, generes sans dependance :

```bash
node -e "const{writeFileSync}=require('fs');const z=require('zlib');for(const s of [16,48,128]){const px=Buffer.alloc(s*(s*3+1));for(let y=0;y<s;y++){px[y*(s*3+1)]=0;for(let x=0;x<s;x++){const o=y*(s*3+1)+1+x*3;px[o]=17;px[o+1]=24;px[o+2]=39;}}const ch=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const b=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(z.crc32?z.crc32(b):require('zlib').crc32(b));return Buffer.concat([l,b,c]);};const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(s,0);ihdr.writeUInt32BE(s,4);ihdr[8]=8;ihdr[9]=2;const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ihdr),ch('IDAT',z.deflateSync(px)),ch('IEND',Buffer.alloc(0))]);writeFileSync('src/assets/icons/icon-'+s+'.png',png);}"
```

Si `zlib.crc32` n'est pas disponible sur la version de Node utilisee, remplacer les icones par n'importe quels PNG carres de 16, 48 et 128 pixels. Le contenu graphique n'a aucune incidence fonctionnelle.

Creer aussi les fichiers vides que le manifeste reference, pour que le build passe :

```bash
mkdir -p src/content src/background src/options
printf '' > src/content/content.js
printf '' > src/background/service-worker.js
printf '<!doctype html>\n<title>Warhadex</title>\n' > src/options/options.html
```

- [ ] **Step 10: Lancer le test et verifier qu'il passe**

```bash
npm test -- --test-name-pattern="build"
```

Attendu : SUCCES.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: squelette, manifestes MV3 et script de build multi-navigateur"
```

---

### Task 2: Normalisation du nom de produit

**Files:**
- Create: `src/content/detect/normalize.js`
- Test: `test/normalize.test.js`

**Interfaces:**
- Consumes: rien
- Produces: `normalize(raw: string) => string` exportee de `normalize.js`. Retourne une chaine minuscule sans accents, debarrassee du bruit commercial, ou la chaine vide si l'entree ne contient rien d'exploitable.

- [ ] **Step 1: Ecrire les tests qui echouent**

`test/normalize.test.js` :

```js
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
```

- [ ] **Step 2: Lancer les tests et verifier qu'ils echouent**

```bash
npm test -- --test-name-pattern="normalise|retire|retourne une chaine vide"
```

Attendu : ECHEC, module introuvable.

- [ ] **Step 3: Implementer normalize.js**

```js
const NOISE = [
  /warhammer\s*40[.,]?\s*000/gi,
  /warhammer\s*40k/gi,
  /\bcitadel\b/gi,
  /\bgames\s*workshop\b/gi,
  /\bminiatures?\b/gi,
  /\bfigurines?\b/gi,
  /\bboxed\b/gi,
  /\bboite\b/gi,
  /\bbox\b/gi,
  /\bset\b/gi,
  /\b\d{2}-\d{2,3}\b/g,
  /\((?:fr|en|de|es|it|pl)\)/gi
];

export function normalize(raw) {
  if (typeof raw !== 'string') return '';

  let value = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  for (const pattern of NOISE) {
    value = value.replace(pattern, ' ');
  }

  return value
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
```

- [ ] **Step 4: Lancer les tests et verifier qu'ils passent**

```bash
npm test
```

Attendu : SUCCES sur les six tests de normalisation.

- [ ] **Step 5: Commit**

```bash
git add src/content/detect/normalize.js test/normalize.test.js
git commit -m "feat: normalisation du nom de produit extrait de la page"
```

---

### Task 3: Extracteur generique

**Files:**
- Create: `src/content/detect/generic.js`
- Create: `test/helpers/dom.js`
- Create: `test/fixtures/generic-jsonld-product.html`, `test/fixtures/no-metadata-category.html`
- Test: `test/generic.test.js`

**Interfaces:**
- Consumes: rien
- Produces: `extractGeneric(doc: Document) => { raw: string, source: string } | null` exportee de `generic.js`. `source` vaut `jsonld`, `og` ou `heading`.

- [ ] **Step 1: Ecrire le helper de chargement DOM**

`test/helpers/dom.js` :

```js
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

export function loadFixture(name) {
  const html = readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');
  return new JSDOM(html).window.document;
}

export function loadHtml(html) {
  return new JSDOM(html).window.document;
}
```

- [ ] **Step 2: Ecrire les fixtures**

`test/fixtures/generic-jsonld-product.html` :

```html
<!doctype html>
<html lang="fr">
<head>
  <meta property="og:title" content="Titre OpenGraph a ignorer">
  <title>Boutique</title>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "BreadcrumbList", "itemListElement": [] },
      { "@type": "Product", "name": "Warhammer 40,000: Marneus Calgar", "sku": "48-25" }
    ]
  }
  </script>
</head>
<body><h1>Titre H1 a ignorer</h1></body>
</html>
```

`test/fixtures/no-metadata-category.html` :

```html
<!doctype html>
<html lang="fr">
<head><title>Toutes les figurines</title></head>
<body><nav>Catalogue</nav></body>
</html>
```

- [ ] **Step 3: Ecrire les tests qui echouent**

`test/generic.test.js` :

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractGeneric } from '../src/content/detect/generic.js';
import { loadFixture, loadHtml } from './helpers/dom.js';

test('preferer le JSON-LD Product y compris dans un @graph', () => {
  const result = extractGeneric(loadFixture('generic-jsonld-product.html'));
  assert.deepEqual(result, { raw: 'Warhammer 40,000: Marneus Calgar', source: 'jsonld' });
});

test('replier sur og:title quand il n y a pas de JSON-LD', () => {
  const doc = loadHtml('<meta property="og:title" content="Ghazghkull Thraka"><h1>Autre</h1>');
  assert.deepEqual(extractGeneric(doc), { raw: 'Ghazghkull Thraka', source: 'og' });
});

test('replier sur le premier h1 en dernier recours', () => {
  const doc = loadHtml('<h1>  Abaddon the Despoiler  </h1>');
  assert.deepEqual(extractGeneric(doc), { raw: 'Abaddon the Despoiler', source: 'heading' });
});

test('ignorer un JSON-LD illisible sans lever', () => {
  const doc = loadHtml('<script type="application/ld+json">{ pas du json</script><h1>Kharn</h1>');
  assert.deepEqual(extractGeneric(doc), { raw: 'Kharn', source: 'heading' });
});

test('retourner null sur une page sans metadonnee exploitable', () => {
  assert.equal(extractGeneric(loadFixture('no-metadata-category.html')), null);
});
```

- [ ] **Step 4: Lancer les tests et verifier qu'ils echouent**

```bash
npm test -- --test-name-pattern="JSON-LD|og:title|h1|metadonnee"
```

Attendu : ECHEC, module introuvable.

- [ ] **Step 5: Implementer generic.js**

```js
function flatten(node) {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (node && typeof node === 'object') {
    return node['@graph'] ? [node, ...flatten(node['@graph'])] : [node];
  }
  return [];
}

function isProduct(node) {
  const type = node['@type'];
  return Array.isArray(type) ? type.includes('Product') : type === 'Product';
}

function fromJsonLd(doc) {
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    let parsed;
    try {
      parsed = JSON.parse(script.textContent);
    } catch {
      continue;
    }
    const product = flatten(parsed).find((node) => isProduct(node) && typeof node.name === 'string');
    if (product) return { raw: product.name.trim(), source: 'jsonld' };
  }
  return null;
}

function fromMeta(doc) {
  const content = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
  return content?.trim() ? { raw: content.trim(), source: 'og' } : null;
}

function fromHeading(doc) {
  const text = doc.querySelector('h1')?.textContent;
  return text?.trim() ? { raw: text.trim(), source: 'heading' } : null;
}

export function extractGeneric(doc) {
  return fromJsonLd(doc) ?? fromMeta(doc) ?? fromHeading(doc);
}
```

- [ ] **Step 6: Lancer les tests et verifier qu'ils passent**

```bash
npm test
```

Attendu : SUCCES.

- [ ] **Step 7: Commit**

```bash
git add src/content/detect/generic.js test/generic.test.js test/helpers test/fixtures
git commit -m "feat: extracteur generique JSON-LD og:title et h1"
```

---

### Task 4: Registre et adaptateurs par site

**Files:**
- Create: `src/content/detect/registry.js`
- Create: `src/content/detect/adapters/warhammer-com.js`, `games-workshop-store.js`, `element-games.js`, `wayland-games.js`, `philibert.js`
- Create: `test/fixtures/warhammer-com-product.html`, `gw-store-product.html`, `element-games-product.html`, `wayland-games-product.html`, `philibert-product.html`
- Test: `test/adapters.test.js`

**Interfaces:**
- Consumes: rien
- Produces: `findAdapter(url: string) => Adapter | null` exportee de `registry.js`. Un `Adapter` est `{ id: string, match(url: string): boolean, extract(doc: Document): { raw: string, source: string } | null }`.

**Note importante pour l'implementeur :** les selecteurs CSS ci-dessous sont des hypotheses raisonnables, non verifiees contre le DOM en production de chaque site. L'etape 1 consiste a capturer de vraies fixtures et a ajuster les selecteurs en consequence. Chaque adaptateur reste volontairement court et retourne `null` plutot que de deviner, ce qui laisse l'extracteur generique reprendre la main.

- [ ] **Step 1: Capturer les fixtures reelles**

Pour chacun des cinq sites, ouvrir une page produit d'un personnage nomme, puis enregistrer le HTML :

```bash
mkdir -p test/fixtures
```

Dans la console du navigateur sur la page produit, executer `copy(document.documentElement.outerHTML)` puis coller dans le fichier de fixture correspondant. Si un site est inaccessible, creer une fixture minimale reproduisant la structure documentee dans les selecteurs de l'etape 3, et noter le fichier comme synthetique en commentaire HTML en tete.

- [ ] **Step 2: Ecrire les tests qui echouent**

`test/adapters.test.js` :

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { findAdapter } from '../src/content/detect/registry.js';
import { loadFixture, loadHtml } from './helpers/dom.js';

test('router chaque domaine vers son adaptateur', () => {
  assert.equal(findAdapter('https://www.warhammer.com/fr-FR/shop/marneus-calgar-2020').id, 'warhammer-com');
  assert.equal(findAdapter('https://www.games-workshop.com/en-GB/Marneus-Calgar').id, 'games-workshop-store');
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
    ['https://www.games-workshop.com/en-GB/x', 'gw-store-product.html'],
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

test('un adaptateur retourne null plutot que de deviner sur une page sans produit', () => {
  const doc = loadHtml('<body><nav>Catalogue</nav></body>');
  assert.equal(findAdapter('https://www.warhammer.com/fr-FR/x').extract(doc), null);
});
```

- [ ] **Step 3: Implementer les cinq adaptateurs**

Chaque adaptateur suit la meme forme. `src/content/detect/adapters/warhammer-com.js` :

```js
// warhammer.com est une SPA React, le titre produit est expose en JSON-LD
// et duplique dans un heading porteur d'un attribut de test
const SELECTORS = [
  '[data-testid="product-title"]',
  'h1[class*="ProductName"]',
  'main h1'
];

export default {
  id: 'warhammer-com',
  match: (url) => /(^|\.)warhammer\.com$/.test(new URL(url).hostname),
  extract(doc) {
    for (const selector of SELECTORS) {
      const text = doc.querySelector(selector)?.textContent?.trim();
      if (text) return { raw: text, source: `adapter:warhammer-com:${selector}` };
    }
    return null;
  }
};
```

`src/content/detect/adapters/games-workshop-store.js` :

```js
const SELECTORS = ['h1.product-name', '[itemprop="name"]', 'main h1'];

export default {
  id: 'games-workshop-store',
  match: (url) => /(^|\.)games-workshop\.com$/.test(new URL(url).hostname),
  extract(doc) {
    for (const selector of SELECTORS) {
      const text = doc.querySelector(selector)?.textContent?.trim();
      if (text) return { raw: text, source: `adapter:games-workshop-store:${selector}` };
    }
    return null;
  }
};
```

`src/content/detect/adapters/element-games.js` :

```js
const SELECTORS = ['h1[itemprop="name"]', '.product-title h1', 'main h1'];

export default {
  id: 'element-games',
  match: (url) => /(^|\.)elementgames\.co\.uk$/.test(new URL(url).hostname),
  extract(doc) {
    for (const selector of SELECTORS) {
      const text = doc.querySelector(selector)?.textContent?.trim();
      if (text) return { raw: text, source: `adapter:element-games:${selector}` };
    }
    return null;
  }
};
```

`src/content/detect/adapters/wayland-games.js` :

```js
// boutique Shopify, le titre est dans un heading de la fiche produit
const SELECTORS = ['h1.product-single__title', '.product__title h1', 'main h1'];

export default {
  id: 'wayland-games',
  match: (url) => /(^|\.)waylandgames\.co\.uk$/.test(new URL(url).hostname),
  extract(doc) {
    for (const selector of SELECTORS) {
      const text = doc.querySelector(selector)?.textContent?.trim();
      if (text) return { raw: text, source: `adapter:wayland-games:${selector}` };
    }
    return null;
  }
};
```

`src/content/detect/adapters/philibert.js` :

```js
const SELECTORS = ['h1[itemprop="name"]', '#product-title', 'main h1'];

export default {
  id: 'philibert',
  match: (url) => /(^|\.)philibertnet\.com$/.test(new URL(url).hostname),
  extract(doc) {
    for (const selector of SELECTORS) {
      const text = doc.querySelector(selector)?.textContent?.trim();
      if (text) return { raw: text, source: `adapter:philibert:${selector}` };
    }
    return null;
  }
};
```

- [ ] **Step 4: Implementer le registre**

`src/content/detect/registry.js` :

```js
import warhammerCom from './adapters/warhammer-com.js';
import gamesWorkshopStore from './adapters/games-workshop-store.js';
import elementGames from './adapters/element-games.js';
import waylandGames from './adapters/wayland-games.js';
import philibert from './adapters/philibert.js';

export const adapters = [warhammerCom, gamesWorkshopStore, elementGames, waylandGames, philibert];

export function findAdapter(url) {
  try {
    return adapters.find((adapter) => adapter.match(url)) ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Lancer les tests et ajuster les selecteurs**

```bash
npm test -- --test-name-pattern="adaptateur|domaine"
```

Attendu : SUCCES. Si l'extraction echoue sur une fixture reelle, ajuster la liste `SELECTORS` de l'adaptateur concerne jusqu'a ce que le test passe. Ne pas modifier le test pour le faire passer.

- [ ] **Step 6: Commit**

```bash
git add src/content/detect/registry.js src/content/detect/adapters test/adapters.test.js test/fixtures
git commit -m "feat: registre et adaptateurs de detection pour cinq sites marchands"
```

---

### Task 5: Orchestration de la detection

**Files:**
- Create: `src/content/detect/index.js`
- Test: `test/detect.test.js`

**Interfaces:**
- Consumes: `findAdapter` de `registry.js`, `extractGeneric` de `generic.js`, `normalize` de `normalize.js`
- Produces: `detect(doc: Document, url: string) => { raw: string, normalized: string, site: string, source: string } | null` exportee de `index.js`

- [ ] **Step 1: Ecrire les tests qui echouent**

`test/detect.test.js` :

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { detect } from '../src/content/detect/index.js';
import { loadFixture, loadHtml } from './helpers/dom.js';

test('utiliser l adaptateur du site quand il repond', () => {
  const result = detect(loadFixture('warhammer-com-product.html'), 'https://www.warhammer.com/fr-FR/shop/x');
  assert.equal(result.site, 'www.warhammer.com');
  assert.ok(result.source.startsWith('adapter:warhammer-com'));
  assert.ok(result.normalized.length > 0);
  assert.equal(result.normalized, result.normalized.toLowerCase());
  assert.doesNotMatch(result.normalized, /warhammer|citadel/);
});

test('replier sur l extracteur generique quand l adaptateur ne trouve rien', () => {
  const doc = loadHtml('<meta property="og:title" content="Ghazghkull Thraka">');
  const result = detect(doc, 'https://www.warhammer.com/fr-FR/shop/x');
  assert.equal(result.source, 'og');
  assert.equal(result.normalized, 'ghazghkull thraka');
});

test('utiliser l extracteur generique sur un site inconnu', () => {
  const doc = loadHtml('<h1>Abaddon the Despoiler</h1>');
  const result = detect(doc, 'https://boutique-inconnue.example/produit');
  assert.equal(result.site, 'boutique-inconnue.example');
  assert.equal(result.normalized, 'abaddon the despoiler');
});

test('retourner null quand rien n est exploitable', () => {
  assert.equal(detect(loadFixture('no-metadata-category.html'), 'https://example.com/c'), null);
});

test('retourner null quand la normalisation vide le nom', () => {
  const doc = loadHtml('<h1>Warhammer 40,000</h1>');
  assert.equal(detect(doc, 'https://example.com/p'), null);
});

test('retourner null sur une url invalide', () => {
  const doc = loadHtml('<h1>Kharn the Betrayer</h1>');
  assert.equal(detect(doc, 'pas-une-url'), null);
});
```

- [ ] **Step 2: Lancer les tests et verifier qu'ils echouent**

```bash
npm test -- --test-name-pattern="adaptateur du site|generique|rien n est exploitable|url invalide"
```

Attendu : ECHEC, module introuvable.

- [ ] **Step 3: Implementer index.js**

```js
import { findAdapter } from './registry.js';
import { extractGeneric } from './generic.js';
import { normalize } from './normalize.js';

export function detect(doc, url) {
  let site;
  try {
    site = new URL(url).hostname;
  } catch {
    return null;
  }

  const adapter = findAdapter(url);
  const extracted = adapter?.extract(doc) ?? extractGeneric(doc);
  if (!extracted) return null;

  const normalized = normalize(extracted.raw);
  if (!normalized) return null;

  return { raw: extracted.raw, normalized, site, source: extracted.source };
}
```

- [ ] **Step 4: Lancer les tests et verifier qu'ils passent**

```bash
npm test
```

Attendu : SUCCES.

- [ ] **Step 5: Commit**

```bash
git add src/content/detect/index.js test/detect.test.js
git commit -m "feat: orchestration de la detection avec repli generique"
```

---

### Task 6: Reglages et cache

**Files:**
- Create: `src/core/settings.js`, `src/core/cache.js`, `src/core/messages.js`
- Test: `test/cache.test.js`

**Interfaces:**
- Consumes: `src/vendor/browser.js`
- Produces:
  - `DEFAULTS`, `getSettings() => Promise<Settings>`, `setSettings(patch) => Promise<Settings>` de `settings.js`. `Settings` est `{ apiBaseUrl: string, apiKey: string, showLauncher: boolean, cacheTtlDays: number }`.
  - `createCache({ storage, now }) => { get(key), set(key, value, ttlMs), clear() }` de `cache.js`, plus `cache` deja cable sur `browser.storage.local`.
  - Constantes `MSG.RESOLVE`, `MSG.CHARACTER`, `MSG.CLEAR_CACHE` de `messages.js`.

- [ ] **Step 1: Ecrire les tests de cache qui echouent**

`test/cache.test.js` :

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCache } from '../src/core/cache.js';

function fakeStorage() {
  const data = new Map();
  return {
    async get(key) {
      return data.has(key) ? { [key]: data.get(key) } : {};
    },
    async set(entries) {
      for (const [key, value] of Object.entries(entries)) data.set(key, value);
    },
    async remove(key) {
      data.delete(key);
    },
    async clear() {
      data.clear();
    },
    size: () => data.size
  };
}

test('rendre une valeur stockee avant expiration', async () => {
  let clock = 1000;
  const storage = fakeStorage();
  const cache = createCache({ storage, now: () => clock });

  await cache.set('a', { name: 'Calgar' }, 5000);
  clock = 4000;
  assert.deepEqual(await cache.get('a'), { name: 'Calgar' });
});

test('rendre undefined et purger apres expiration', async () => {
  let clock = 1000;
  const storage = fakeStorage();
  const cache = createCache({ storage, now: () => clock });

  await cache.set('a', { name: 'Calgar' }, 5000);
  clock = 6001;
  assert.equal(await cache.get('a'), undefined);
  assert.equal(storage.size(), 0);
});

test('distinguer une valeur null memorisee d une absence', async () => {
  const storage = fakeStorage();
  const cache = createCache({ storage, now: () => 0 });

  await cache.set('vide', null, 1000);
  assert.equal(await cache.get('vide'), null);
  assert.equal(await cache.get('jamais-ecrit'), undefined);
});

test('vider entierement le cache', async () => {
  const storage = fakeStorage();
  const cache = createCache({ storage, now: () => 0 });

  await cache.set('a', 1, 1000);
  await cache.clear();
  assert.equal(await cache.get('a'), undefined);
});
```

Le troisieme test verrouille le cache negatif : memoriser `null` signifie que le serveur a repondu sans correspondance, ce qui doit etre distingue d'une entree jamais ecrite.

- [ ] **Step 2: Lancer les tests et verifier qu'ils echouent**

```bash
npm test -- --test-name-pattern="cache|expiration|null memorisee"
```

Attendu : ECHEC, module introuvable.

- [ ] **Step 3: Implementer cache.js**

```js
import browser from '../vendor/browser.js';

const PREFIX = 'cache:';

export function createCache({ storage, now = () => Date.now() }) {
  return {
    async get(key) {
      const full = PREFIX + key;
      const stored = (await storage.get(full))[full];
      if (!stored) return undefined;
      if (stored.expiresAt <= now()) {
        await storage.remove(full);
        return undefined;
      }
      return stored.value;
    },

    async set(key, value, ttlMs) {
      await storage.set({ [PREFIX + key]: { value, expiresAt: now() + ttlMs } });
    },

    async clear() {
      await storage.clear();
    }
  };
}

export const cache = createCache({ storage: browser.storage.local });
```

- [ ] **Step 4: Implementer settings.js et messages.js**

`src/core/settings.js` :

```js
import browser from '../vendor/browser.js';

export const DEFAULTS = {
  apiBaseUrl: '',
  apiKey: '',
  showLauncher: true,
  cacheTtlDays: 7
};

export async function getSettings() {
  const stored = await browser.storage.sync.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...stored };
}

export async function setSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await browser.storage.sync.set(next);
  return next;
}
```

`src/core/messages.js` :

```js
export const MSG = {
  RESOLVE: 'warhadex:resolve',
  CHARACTER: 'warhadex:character',
  CLEAR_CACHE: 'warhadex:clear-cache'
};

export const STATUS = {
  MATCH: 'match',
  AMBIGUOUS: 'ambiguous',
  NOT_FOUND: 'not-found',
  NOT_CONFIGURED: 'not-configured',
  OFFLINE: 'offline',
  ERROR: 'error'
};
```

`storage.sync` est utilise pour les reglages, ce qui les propage entre appareils. Safari le supporte et bascule sur un stockage local si la synchronisation est desactivee.

- [ ] **Step 5: Lancer les tests et verifier qu'ils passent**

```bash
npm test
```

Attendu : SUCCES.

- [ ] **Step 6: Commit**

```bash
git add src/core test/cache.test.js
git commit -m "feat: reglages, cache TTL avec cache negatif et constantes de protocole"
```

---

### Task 7: Serveur mock et jeu de donnees

**Files:**
- Create: `mock-api/server.mjs`, `mock-api/data/characters.json`
- Modify: `README.md` (creation)

**Interfaces:**
- Consumes: rien
- Produces: un serveur HTTP sur `http://127.0.0.1:8787` exposant `GET /v1/resolve?q=&site=` et `GET /v1/characters/:id`. `startServer({ port }) => Promise<{ url, close }>` est exportee pour les tests.

- [ ] **Step 1: Ecrire le jeu de donnees**

`mock-api/data/characters.json`. Les valeurs de profil sont plausibles, les textes de regles et de lore sont explicitement factices afin de ne reproduire aucun contenu Games Workshop dans ce depot.

```json
[
  {
    "id": "marneus-calgar",
    "name": "Marneus Calgar",
    "aliases": ["marneus calgar", "calgar", "marneus calgar chapter master"],
    "faction": "Adeptus Astartes",
    "role": "Epic Hero",
    "profile": { "m": "5\"", "t": 5, "sv": "2+", "w": 6, "ld": "5+", "oc": 1 },
    "invulnerable": "4+",
    "weapons": [
      { "name": "Gantelets d Ultramar", "type": "ranged", "range": "18\"", "a": 3, "skill": "2+", "s": 4, "ap": 0, "d": 1, "keywords": ["Twin-linked"] },
      { "name": "Gantelets d Ultramar", "type": "melee", "range": "Melee", "a": 6, "skill": "2+", "s": 8, "ap": -2, "d": 2, "keywords": [] }
    ],
    "abilities": [
      { "name": "Tacticien hors pair", "type": "core", "text": "Texte de regle factice fourni par le serveur mock. Votre API renverra ici le texte reel." }
    ],
    "keywords": ["Infantry", "Character", "Epic Hero", "Marneus Calgar"],
    "points": [{ "models": 1, "cost": 95 }],
    "lore": "Notice historique factice servie par le serveur mock.",
    "books": [{ "title": "Exemple de roman", "author": "Auteur d exemple", "year": 2000, "url": "" }],
    "source": { "label": "Serveur mock Warhadex", "url": "" }
  },
  {
    "id": "ghazghkull-thraka",
    "name": "Ghazghkull Thraka",
    "aliases": ["ghazghkull thraka", "ghazghkull mag uruk thraka", "ghazghkull"],
    "faction": "Orks",
    "role": "Epic Hero",
    "profile": { "m": "8\"", "t": 9, "sv": "2+", "w": 12, "ld": "6+", "oc": 5 },
    "invulnerable": "4+",
    "weapons": [
      { "name": "Gros flingue", "type": "ranged", "range": "18\"", "a": 3, "skill": "5+", "s": 6, "ap": -1, "d": 2, "keywords": [] },
      { "name": "Gnashteef", "type": "melee", "range": "Melee", "a": 6, "skill": "2+", "s": 14, "ap": -3, "d": 3, "keywords": [] }
    ],
    "abilities": [
      { "name": "Waaagh", "type": "faction", "text": "Texte de regle factice fourni par le serveur mock." }
    ],
    "keywords": ["Monster", "Character", "Epic Hero", "Ghazghkull Thraka"],
    "points": [{ "models": 1, "cost": 235 }],
    "lore": "Notice historique factice servie par le serveur mock.",
    "books": [],
    "source": { "label": "Serveur mock Warhadex", "url": "" }
  },
  {
    "id": "abaddon-the-despoiler",
    "name": "Abaddon the Despoiler",
    "aliases": ["abaddon the despoiler", "abaddon", "abaddon le spoliateur"],
    "faction": "Chaos Space Marines",
    "role": "Epic Hero",
    "profile": { "m": "6\"", "t": 6, "sv": "2+", "w": 9, "ld": "5+", "oc": 1 },
    "invulnerable": "4+",
    "weapons": [
      { "name": "Drach nyen", "type": "melee", "range": "Melee", "a": 6, "skill": "2+", "s": 8, "ap": -3, "d": 3, "keywords": ["Devastating wounds"] }
    ],
    "abilities": [
      { "name": "Marque du Chaos", "type": "core", "text": "Texte de regle factice fourni par le serveur mock." }
    ],
    "keywords": ["Infantry", "Character", "Epic Hero", "Abaddon"],
    "points": [{ "models": 1, "cost": 235 }],
    "lore": "Notice historique factice servie par le serveur mock.",
    "books": [],
    "source": { "label": "Serveur mock Warhadex", "url": "" }
  },
  {
    "id": "belisarius-cawl",
    "name": "Belisarius Cawl",
    "aliases": ["belisarius cawl", "cawl", "archimagos belisarius cawl"],
    "faction": "Adeptus Mechanicus",
    "role": "Epic Hero",
    "profile": { "m": "6\"", "t": 6, "sv": "2+", "w": 8, "ld": "6+", "oc": 2 },
    "invulnerable": "5+",
    "weapons": [
      { "name": "Solemnus Aggressor", "type": "ranged", "range": "24\"", "a": 3, "skill": "3+", "s": 6, "ap": -1, "d": 2, "keywords": [] }
    ],
    "abilities": [
      { "name": "Maitre des rites", "type": "core", "text": "Texte de regle factice fourni par le serveur mock." }
    ],
    "keywords": ["Infantry", "Character", "Epic Hero", "Belisarius Cawl"],
    "points": [{ "models": 1, "cost": 100 }],
    "lore": "Notice historique factice servie par le serveur mock.",
    "books": [],
    "source": { "label": "Serveur mock Warhadex", "url": "" }
  },
  {
    "id": "commander-dante",
    "name": "Commander Dante",
    "aliases": ["commander dante", "dante", "commandant dante"],
    "faction": "Blood Angels",
    "role": "Epic Hero",
    "profile": { "m": "12\"", "t": 5, "sv": "2+", "w": 6, "ld": "5+", "oc": 1 },
    "invulnerable": "4+",
    "weapons": [
      { "name": "Perdition Pistol", "type": "ranged", "range": "12\"", "a": 2, "skill": "2+", "s": 8, "ap": -3, "d": 3, "keywords": [] },
      { "name": "Axe Mortalis", "type": "melee", "range": "Melee", "a": 6, "skill": "2+", "s": 6, "ap": -2, "d": 2, "keywords": ["Precision"] }
    ],
    "abilities": [
      { "name": "Chapitre de sang", "type": "core", "text": "Texte de regle factice fourni par le serveur mock." }
    ],
    "keywords": ["Infantry", "Character", "Epic Hero", "Fly", "Commander Dante"],
    "points": [{ "models": 1, "cost": 130 }],
    "lore": "Notice historique factice servie par le serveur mock.",
    "books": [],
    "source": { "label": "Serveur mock Warhadex", "url": "" }
  }
]
```

- [ ] **Step 2: Implementer le serveur**

`mock-api/server.mjs` :

```js
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const characters = JSON.parse(
  await readFile(new URL('./data/characters.json', import.meta.url), 'utf8')
);

function score(query, alias) {
  if (query === alias) return 1;
  if (alias.includes(query) || query.includes(alias)) return 0.9;

  const queryTokens = new Set(query.split(' '));
  const aliasTokens = new Set(alias.split(' '));
  let shared = 0;
  for (const token of queryTokens) if (aliasTokens.has(token)) shared += 1;

  const union = new Set([...queryTokens, ...aliasTokens]).size;
  return union === 0 ? 0 : shared / union;
}

function resolve(query) {
  return characters
    .map((character) => ({
      character,
      score: Math.max(...character.aliases.map((alias) => score(query, alias)))
    }))
    .filter((entry) => entry.score >= 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ character, score: value }) => ({
      id: character.id,
      name: character.name,
      faction: character.faction,
      score: Number(value.toFixed(2))
    }));
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'content-length': Buffer.byteLength(payload)
  });
  res.end(payload);
}

export function startServer({ port = 8787 } = {}) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');

    if (url.pathname === '/v1/resolve') {
      const query = (url.searchParams.get('q') ?? '').trim();
      if (!query) return send(res, 400, { error: 'parametre q obligatoire' });
      return send(res, 200, { matches: resolve(query) });
    }

    const match = url.pathname.match(/^\/v1\/characters\/([\w-]+)$/);
    if (match) {
      const character = characters.find((entry) => entry.id === match[1]);
      return character
        ? send(res, 200, character)
        : send(res, 404, { error: 'fiche inconnue' });
    }

    return send(res, 404, { error: 'route inconnue' });
  });

  return new Promise((resolve_) => {
    server.listen(port, '127.0.0.1', () => {
      const { port: actual } = server.address();
      resolve_({
        url: `http://127.0.0.1:${actual}`,
        close: () => new Promise((done) => server.close(done))
      });
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { url } = await startServer({ port: Number(process.env.PORT ?? 8787) });
  process.stdout.write(`Warhadex mock API sur ${url}\n`);
}
```

L'ecriture sur `process.stdout` est la sortie utile du serveur, pas un log de debug.

- [ ] **Step 3: Verifier le serveur manuellement**

```bash
npm run mock
```

Dans un autre terminal :

```bash
curl "http://127.0.0.1:8787/v1/resolve?q=marneus%20calgar"
```

Attendu : un objet `matches` dont la premiere entree est `marneus-calgar` avec un score de 1.

- [ ] **Step 4: Commit**

```bash
git add mock-api
git commit -m "feat: serveur mock de reference et jeu de donnees d exemple"
```

---

### Task 8: Client d'API

**Files:**
- Create: `src/core/api-client.js`
- Test: `test/api-client.test.js`

**Interfaces:**
- Consumes: `getSettings` de `settings.js`, `STATUS` de `messages.js`
- Produces: `createApiClient({ getSettings, fetchImpl }) => { resolve(name, site), character(id) }` et la classe `ApiError` avec la propriete `status` prise dans `STATUS`.

- [ ] **Step 1: Ecrire les tests qui echouent**

`test/api-client.test.js` :

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient, ApiError } from '../src/core/api-client.js';
import { startServer } from '../mock-api/server.mjs';

function clientFor(url, extra = {}) {
  return createApiClient({
    getSettings: async () => ({ apiBaseUrl: url, apiKey: '', ...extra })
  });
}

test('resolve retourne les correspondances du serveur', async () => {
  const server = await startServer({ port: 0 });
  const client = clientFor(server.url);

  const matches = await client.resolve('marneus calgar', 'www.warhammer.com');
  assert.equal(matches[0].id, 'marneus-calgar');
  assert.equal(matches[0].score, 1);

  await server.close();
});

test('character retourne la fiche complete', async () => {
  const server = await startServer({ port: 0 });
  const client = clientFor(server.url);

  const fiche = await client.character('ghazghkull-thraka');
  assert.equal(fiche.name, 'Ghazghkull Thraka');
  assert.equal(fiche.profile.w, 12);

  await server.close();
});

test('character leve une ApiError not-found sur 404', async () => {
  const server = await startServer({ port: 0 });
  const client = clientFor(server.url);

  await assert.rejects(
    () => client.character('inconnu'),
    (error) => error instanceof ApiError && error.status === 'not-found'
  );

  await server.close();
});

test('lever not-configured quand aucune url n est reglee', async () => {
  const client = clientFor('');
  await assert.rejects(
    () => client.resolve('calgar', 'x'),
    (error) => error.status === 'not-configured'
  );
});

test('lever offline quand fetch echoue', async () => {
  const client = createApiClient({
    getSettings: async () => ({ apiBaseUrl: 'https://api.example', apiKey: '' }),
    fetchImpl: async () => {
      throw new TypeError('network error');
    }
  });

  await assert.rejects(
    () => client.resolve('calgar', 'x'),
    (error) => error.status === 'offline'
  );
});

test('lever rate-limited sur 429', async () => {
  const client = createApiClient({
    getSettings: async () => ({ apiBaseUrl: 'https://api.example', apiKey: '' }),
    fetchImpl: async () => new Response('{}', { status: 429, headers: { 'retry-after': '30' } })
  });

  await assert.rejects(
    () => client.resolve('calgar', 'x'),
    (error) => error.status === 'rate-limited' && error.retryAfter === 30
  );
});

test('envoyer la cle d api en Bearer quand elle est reglee', async () => {
  let seen;
  const client = createApiClient({
    getSettings: async () => ({ apiBaseUrl: 'https://api.example', apiKey: 'secret' }),
    fetchImpl: async (url, init) => {
      seen = init.headers;
      return new Response(JSON.stringify({ matches: [] }), { status: 200 });
    }
  });

  await client.resolve('calgar', 'x');
  assert.equal(seen.Authorization, 'Bearer secret');
});
```

- [ ] **Step 2: Lancer les tests et verifier qu'ils echouent**

```bash
npm test -- --test-name-pattern="resolve|character|not-configured|offline|rate-limited|Bearer"
```

Attendu : ECHEC, module introuvable.

- [ ] **Step 3: Implementer api-client.js**

```js
export class ApiError extends Error {
  constructor(status, message, retryAfter) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function mapHttpError(response) {
  if (response.status === 404) return new ApiError('not-found', 'fiche inconnue');
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after')) || undefined;
    return new ApiError('rate-limited', 'quota depasse', retryAfter);
  }
  return new ApiError('error', `reponse ${response.status}`);
}

export function createApiClient({ getSettings, fetchImpl = fetch }) {
  async function request(path, params) {
    const { apiBaseUrl, apiKey } = await getSettings();
    if (!apiBaseUrl) throw new ApiError('not-configured', 'url d api non reglee');

    const url = new URL(path, apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`);
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value) url.searchParams.set(key, value);
    }

    const headers = { Accept: 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    let response;
    try {
      response = await fetchImpl(url, { headers, credentials: 'omit' });
    } catch {
      throw new ApiError('offline', 'api injoignable');
    }

    if (!response.ok) throw mapHttpError(response);

    try {
      return await response.json();
    } catch {
      throw new ApiError('error', 'reponse illisible');
    }
  }

  return {
    async resolve(name, site) {
      const body = await request('v1/resolve', { q: name, site });
      return Array.isArray(body?.matches) ? body.matches : [];
    },

    character(id) {
      return request(`v1/characters/${encodeURIComponent(id)}`);
    }
  };
}
```

L'URL de base est resolue avec un slash final force, ce qui evite qu'un chemin de base comme `https://api.example/warhadex` ne perde son dernier segment.

- [ ] **Step 4: Lancer les tests et verifier qu'ils passent**

```bash
npm test
```

Attendu : SUCCES.

- [ ] **Step 5: Commit**

```bash
git add src/core/api-client.js test/api-client.test.js
git commit -m "feat: client d api avec erreurs typees et authentification Bearer optionnelle"
```

---

### Task 9: Service worker et badge

**Files:**
- Create: `src/background/badge.js`
- Modify: `src/background/service-worker.js` (remplace le fichier vide de la tache 1)

**Interfaces:**
- Consumes: `cache` de `cache.js`, `getSettings` de `settings.js`, `createApiClient` et `ApiError` de `api-client.js`, `MSG` et `STATUS` de `messages.js`
- Produces: le service worker repond a `{ type: MSG.RESOLVE, name, site }` par `{ status, character?, matches? }` et a `{ type: MSG.CHARACTER, id }` par `{ status, character? }`. `setBadge(tabId, state)` de `badge.js` avec `state` valant `match`, `ambiguous` ou `none`.

- [ ] **Step 1: Implementer badge.js**

```js
import browser from '../vendor/browser.js';

const STYLES = {
  match: { text: '1', color: '#166534' },
  ambiguous: { text: '?', color: '#92400e' },
  none: { text: '', color: '#000000' }
};

export async function setBadge(tabId, state) {
  const style = STYLES[state] ?? STYLES.none;
  try {
    await browser.action.setBadgeText({ tabId, text: style.text });
    await browser.action.setBadgeBackgroundColor({ tabId, color: style.color });
  } catch {
    // l onglet peut avoir disparu entre la detection et la mise a jour
  }
}
```

- [ ] **Step 2: Implementer service-worker.js**

```js
import browser from '../vendor/browser.js';
import { cache } from '../core/cache.js';
import { getSettings } from '../core/settings.js';
import { createApiClient, ApiError } from '../core/api-client.js';
import { MSG, STATUS } from '../core/messages.js';
import { setBadge } from './badge.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = DAY_MS;
const CERTAIN_SCORE = 0.8;

const api = createApiClient({ getSettings });

async function ficheTtl() {
  const { cacheTtlDays } = await getSettings();
  return Math.max(1, Number(cacheTtlDays) || 7) * DAY_MS;
}

async function loadCharacter(id) {
  const cached = await cache.get(`character:${id}`);
  if (cached !== undefined) return cached;

  const character = await api.character(id);
  await cache.set(`character:${id}`, character, await ficheTtl());
  return character;
}

async function resolveName(name, site) {
  const key = `resolve:${name}`;
  let matches = await cache.get(key);

  if (matches === undefined) {
    matches = await api.resolve(name, site);
    await cache.set(key, matches, matches.length ? await ficheTtl() : NEGATIVE_TTL_MS);
  }

  if (!matches.length) return { status: STATUS.NOT_FOUND };

  const [best] = matches;
  if (matches.length === 1 || best.score >= CERTAIN_SCORE) {
    return { status: STATUS.MATCH, character: await loadCharacter(best.id) };
  }
  return { status: STATUS.AMBIGUOUS, matches };
}

function toFailure(error) {
  if (error instanceof ApiError) {
    if (error.status === 'not-configured') return { status: STATUS.NOT_CONFIGURED };
    if (error.status === 'offline') return { status: STATUS.OFFLINE };
    if (error.status === 'not-found') return { status: STATUS.NOT_FOUND };
  }
  return { status: STATUS.ERROR };
}

async function handle(message) {
  if (message.type === MSG.RESOLVE) return resolveName(message.name, message.site);
  if (message.type === MSG.CHARACTER) {
    return { status: STATUS.MATCH, character: await loadCharacter(message.id) };
  }
  if (message.type === MSG.CLEAR_CACHE) {
    await cache.clear();
    return { status: STATUS.MATCH };
  }
  return { status: STATUS.ERROR };
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handle(message)
    .catch(toFailure)
    .then(async (result) => {
      if (sender.tab?.id != null && message.type === MSG.RESOLVE) {
        const state =
          result.status === STATUS.MATCH
            ? 'match'
            : result.status === STATUS.AMBIGUOUS
              ? 'ambiguous'
              : 'none';
        await setBadge(sender.tab.id, state);
      }
      sendResponse(result);
    });

  return true;
});

browser.action.onClicked.addListener(() => browser.runtime.openOptionsPage());
```

Le `return true` maintient le canal de reponse ouvert pour la reponse asynchrone, requis sur les trois moteurs. `handle` peut lever, `toFailure` convertit toute erreur en statut affichable plutot que de laisser le content script sans reponse.

- [ ] **Step 3: Verifier le chargement de l extension**

```bash
npm run build
```

Charger `dist/chrome` via `chrome://extensions` en mode developpeur. Attendu : aucune erreur de service worker dans la carte de l'extension.

- [ ] **Step 4: Commit**

```bash
git add src/background
git commit -m "feat: service worker de resolution avec cache et badge par onglet"
```

---

### Task 10: Fonctions de rendu du panneau

**Files:**
- Create: `src/content/panel/render/el.js`, `datasheet.js`, `weapons.js`, `abilities.js`, `lore.js`, `states.js`
- Test: `test/render.test.js`

**Interfaces:**
- Consumes: rien
- Produces:
  - `el(tag, props, ...children) => Element` de `el.js`
  - `renderDatasheet(doc, character) => Element` de `datasheet.js`
  - `renderWeapons(doc, weapons) => Element | null` de `weapons.js`
  - `renderAbilities(doc, character) => Element | null` de `abilities.js`
  - `renderLore(doc, character) => Element | null` de `lore.js`
  - `renderState(doc, status) => Element` de `states.js`

Chaque fonction prend le `Document` en premier argument, ce qui les rend testables sous jsdom sans variable globale.

- [ ] **Step 1: Ecrire les tests qui echouent**

`test/render.test.js` :

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { el } from '../src/content/panel/render/el.js';
import { renderDatasheet } from '../src/content/panel/render/datasheet.js';
import { renderWeapons } from '../src/content/panel/render/weapons.js';
import { renderAbilities } from '../src/content/panel/render/abilities.js';
import { renderLore } from '../src/content/panel/render/lore.js';
import { renderState } from '../src/content/panel/render/states.js';
import { STATUS } from '../src/core/messages.js';

const doc = new JSDOM('<!doctype html><body>').window.document;

const character = {
  id: 'marneus-calgar',
  name: 'Marneus Calgar',
  faction: 'Adeptus Astartes',
  role: 'Epic Hero',
  profile: { m: '5"', t: 5, sv: '2+', w: 6, ld: '5+', oc: 1 },
  invulnerable: '4+',
  weapons: [
    { name: 'Gantelets', type: 'ranged', range: '18"', a: 3, skill: '2+', s: 4, ap: 0, d: 1, keywords: ['Twin-linked'] },
    { name: 'Gantelets', type: 'melee', range: 'Melee', a: 6, skill: '2+', s: 8, ap: -2, d: 2, keywords: [] }
  ],
  abilities: [{ name: 'Tacticien', type: 'core', text: 'Texte factice.' }],
  keywords: ['Infantry', 'Character'],
  points: [{ models: 1, cost: 95 }],
  lore: 'Notice factice.',
  books: [{ title: 'Roman', author: 'Auteur', year: 2000, url: '' }]
};

test('el cree un element avec classe et texte', () => {
  const node = el(doc, 'span', { class: 'x' }, 'bonjour');
  assert.equal(node.tagName, 'SPAN');
  assert.equal(node.className, 'x');
  assert.equal(node.textContent, 'bonjour');
});

test('el n interprete jamais le html', () => {
  const node = el(doc, 'p', {}, '<img src=x onerror=alert(1)>');
  assert.equal(node.querySelector('img'), null);
  assert.equal(node.textContent, '<img src=x onerror=alert(1)>');
});

test('renderDatasheet affiche les six caracteristiques et l invulnerable', () => {
  const node = renderDatasheet(doc, character);
  const labels = [...node.querySelectorAll('.wx-stat-label')].map((n) => n.textContent);
  assert.deepEqual(labels, ['M', 'T', 'SV', 'W', 'LD', 'OC']);
  assert.match(node.textContent, /4\+/);
  assert.match(node.textContent, /95/);
});

test('renderWeapons separe les armes de tir et de melee', () => {
  const node = renderWeapons(doc, character.weapons);
  const titres = [...node.querySelectorAll('h3')].map((n) => n.textContent);
  assert.deepEqual(titres, ['Armes de tir', 'Armes de melee']);
  assert.equal(node.querySelectorAll('tbody tr').length, 2);
});

test('renderWeapons retourne null sans arme', () => {
  assert.equal(renderWeapons(doc, []), null);
  assert.equal(renderWeapons(doc, undefined), null);
});

test('renderAbilities liste les aptitudes et les mots cles', () => {
  const node = renderAbilities(doc, character);
  assert.match(node.textContent, /Tacticien/);
  assert.match(node.textContent, /Infantry/);
});

test('renderLore retourne null quand la fiche n a ni lore ni livres', () => {
  assert.equal(renderLore(doc, { ...character, lore: '', books: [] }), null);
});

test('renderLore affiche l histoire et les livres', () => {
  const node = renderLore(doc, character);
  assert.match(node.textContent, /Notice factice/);
  assert.match(node.textContent, /Roman/);
});

test('renderState produit un message par statut', () => {
  for (const status of [STATUS.NOT_FOUND, STATUS.NOT_CONFIGURED, STATUS.OFFLINE, STATUS.ERROR]) {
    assert.ok(renderState(doc, status).textContent.length > 0, `message vide pour ${status}`);
  }
});
```

- [ ] **Step 2: Lancer les tests et verifier qu'ils echouent**

```bash
npm test -- --test-name-pattern="el cree|renderDatasheet|renderWeapons|renderAbilities|renderLore|renderState"
```

Attendu : ECHEC, modules introuvables.

- [ ] **Step 3: Implementer el.js**

```js
export function el(doc, tag, props = {}, ...children) {
  const node = doc.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    node.setAttribute(key, String(value));
  }

  for (const child of children.flat()) {
    if (child === undefined || child === null || child === false) continue;
    node.append(typeof child === 'object' ? child : doc.createTextNode(String(child)));
  }

  return node;
}
```

`createTextNode` garantit qu'aucune chaine venant de l'API n'est interpretee comme du balisage.

- [ ] **Step 4: Implementer datasheet.js**

```js
import { el } from './el.js';

const STATS = [
  ['M', 'm'],
  ['T', 't'],
  ['SV', 'sv'],
  ['W', 'w'],
  ['LD', 'ld'],
  ['OC', 'oc']
];

function points(doc, entries) {
  if (!entries?.length) return null;
  const texte = entries.map((entry) => `${entry.models} figurine ${entry.cost} pts`).join(' | ');
  return el(doc, 'p', { class: 'wx-points' }, texte);
}

export function renderDatasheet(doc, character) {
  const cases = STATS.map(([label, key]) =>
    el(
      doc,
      'div',
      { class: 'wx-stat' },
      el(doc, 'span', { class: 'wx-stat-label' }, label),
      el(doc, 'span', { class: 'wx-stat-value' }, character.profile?.[key] ?? '-')
    )
  );

  return el(
    doc,
    'section',
    { class: 'wx-datasheet' },
    el(
      doc,
      'header',
      { class: 'wx-head' },
      el(doc, 'h2', {}, character.name),
      el(doc, 'p', { class: 'wx-sub' }, [character.faction, character.role].filter(Boolean).join(' - '))
    ),
    el(doc, 'div', { class: 'wx-stats' }, cases),
    character.invulnerable
      ? el(doc, 'p', { class: 'wx-invul' }, `Sauvegarde invulnerable ${character.invulnerable}`)
      : null,
    points(doc, character.points)
  );
}
```

- [ ] **Step 5: Implementer weapons.js**

```js
import { el } from './el.js';

const COLONNES = ['Arme', 'Portee', 'A', 'CT/CC', 'F', 'PA', 'D', 'Mots cles'];

function ligne(doc, weapon) {
  const valeurs = [
    weapon.name,
    weapon.range ?? '-',
    weapon.a ?? '-',
    weapon.skill ?? '-',
    weapon.s ?? '-',
    weapon.ap ?? '-',
    weapon.d ?? '-',
    weapon.keywords?.join(', ') || '-'
  ];
  return el(doc, 'tr', {}, valeurs.map((valeur) => el(doc, 'td', {}, valeur)));
}

function tableau(doc, titre, armes) {
  if (!armes.length) return null;
  return el(
    doc,
    'div',
    { class: 'wx-weapon-group' },
    el(doc, 'h3', {}, titre),
    el(
      doc,
      'table',
      { class: 'wx-table' },
      el(doc, 'thead', {}, el(doc, 'tr', {}, COLONNES.map((c) => el(doc, 'th', {}, c)))),
      el(doc, 'tbody', {}, armes.map((arme) => ligne(doc, arme)))
    )
  );
}

export function renderWeapons(doc, weapons) {
  if (!weapons?.length) return null;

  const tir = weapons.filter((weapon) => weapon.type === 'ranged');
  const melee = weapons.filter((weapon) => weapon.type !== 'ranged');

  const groupes = [tableau(doc, 'Armes de tir', tir), tableau(doc, 'Armes de melee', melee)].filter(Boolean);
  return groupes.length ? el(doc, 'section', { class: 'wx-weapons' }, groupes) : null;
}
```

- [ ] **Step 6: Implementer abilities.js et lore.js**

`abilities.js` :

```js
import { el } from './el.js';

export function renderAbilities(doc, character) {
  const abilities = character.abilities ?? [];
  const keywords = character.keywords ?? [];
  if (!abilities.length && !keywords.length) return null;

  return el(
    doc,
    'section',
    { class: 'wx-abilities' },
    abilities.length ? el(doc, 'h3', {}, 'Aptitudes') : null,
    abilities.map((ability) =>
      el(
        doc,
        'div',
        { class: 'wx-ability' },
        el(doc, 'h4', {}, ability.name),
        el(doc, 'p', {}, ability.text ?? '')
      )
    ),
    keywords.length ? el(doc, 'h3', {}, 'Mots cles') : null,
    keywords.length
      ? el(doc, 'ul', { class: 'wx-keywords' }, keywords.map((keyword) => el(doc, 'li', {}, keyword)))
      : null
  );
}
```

`lore.js` :

```js
import { el } from './el.js';

function livre(doc, book) {
  const detail = [book.author, book.year].filter(Boolean).join(', ');
  const titre = book.url
    ? el(doc, 'a', { href: book.url, target: '_blank', rel: 'noopener noreferrer' }, book.title)
    : el(doc, 'span', {}, book.title);
  return el(doc, 'li', {}, titre, detail ? el(doc, 'span', { class: 'wx-book-meta' }, ` ${detail}`) : null);
}

export function renderLore(doc, character) {
  const books = character.books ?? [];
  if (!character.lore && !books.length) return null;

  return el(
    doc,
    'section',
    { class: 'wx-lore' },
    character.lore ? el(doc, 'h3', {}, 'Histoire') : null,
    character.lore ? el(doc, 'p', {}, character.lore) : null,
    books.length ? el(doc, 'h3', {}, 'Livres') : null,
    books.length ? el(doc, 'ul', { class: 'wx-books' }, books.map((book) => livre(doc, book))) : null
  );
}
```

- [ ] **Step 7: Implementer states.js**

```js
import { el } from './el.js';
import { STATUS } from '../../../core/messages.js';

const MESSAGES = {
  [STATUS.NOT_FOUND]: 'Aucun personnage reconnu sur cette page',
  [STATUS.NOT_CONFIGURED]: 'Renseignez l adresse de votre API dans les options de Warhadex',
  [STATUS.OFFLINE]: 'Votre API est injoignable',
  [STATUS.AMBIGUOUS]: 'Plusieurs personnages correspondent',
  [STATUS.ERROR]: 'Une erreur est survenue lors de la recuperation de la fiche'
};

export function renderState(doc, status) {
  return el(doc, 'p', { class: 'wx-state' }, MESSAGES[status] ?? MESSAGES[STATUS.ERROR]);
}
```

- [ ] **Step 8: Lancer les tests et verifier qu'ils passent**

```bash
npm test
```

Attendu : SUCCES.

- [ ] **Step 9: Commit**

```bash
git add src/content/panel/render test/render.test.js
git commit -m "feat: fonctions pures de rendu de la fiche personnage"
```

---

### Task 11: Coque du panneau, lanceur et styles

**Files:**
- Create: `src/content/panel/panel.js`, `src/content/panel/panel.css`, `src/content/panel/launcher.js`

**Interfaces:**
- Consumes: les fonctions de rendu de la tache 10, `STATUS` de `messages.js`
- Produces:
  - `createPanel({ doc, onSelect }) => { showCharacter(character), showState(status), showMatches(matches), open(), close(), destroy() }` de `panel.js`
  - `createLauncher({ doc, onClick }) => { show(), hide(), destroy() }` de `launcher.js`

- [ ] **Step 1: Ecrire panel.css**

```css
:host {
  all: initial;
}

.wx-root {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 2147483647;
  width: min(420px, 100vw);
  height: 100vh;
  overflow-y: auto;
  transform: translateX(100%);
  transition: transform 160ms ease-out;
  background: #0f172a;
  color: #e2e8f0;
  font: 14px/1.5 system-ui, -apple-system, Segoe UI, sans-serif;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.35);
  box-sizing: border-box;
  padding: 16px;
}

.wx-root[data-open='true'] {
  transform: translateX(0);
}

.wx-close {
  position: sticky;
  top: 0;
  float: right;
  background: transparent;
  border: 1px solid #334155;
  border-radius: 4px;
  color: #e2e8f0;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 4px 8px;
}

.wx-tabs {
  display: flex;
  gap: 8px;
  margin: 8px 0 16px;
  border-bottom: 1px solid #334155;
}

.wx-tab {
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  color: #94a3b8;
  cursor: pointer;
  font: inherit;
  padding: 8px 4px;
}

.wx-tab[aria-selected='true'] {
  border-bottom-color: #38bdf8;
  color: #f8fafc;
}

.wx-head h2 {
  font-size: 18px;
  margin: 0;
}

.wx-sub {
  color: #94a3b8;
  margin: 2px 0 12px;
}

.wx-stats {
  display: grid;
  gap: 4px;
  grid-template-columns: repeat(6, 1fr);
  margin-bottom: 12px;
}

.wx-stat {
  background: #1e293b;
  border-radius: 4px;
  padding: 6px 2px;
  text-align: center;
}

.wx-stat-label {
  color: #94a3b8;
  display: block;
  font-size: 11px;
}

.wx-stat-value {
  display: block;
  font-weight: 600;
}

.wx-table {
  border-collapse: collapse;
  font-size: 12px;
  width: 100%;
}

.wx-table th,
.wx-table td {
  border-bottom: 1px solid #1e293b;
  padding: 4px;
  text-align: left;
}

.wx-table th {
  color: #94a3b8;
  font-weight: 500;
}

.wx-keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  list-style: none;
  padding: 0;
}

.wx-keywords li {
  background: #1e293b;
  border-radius: 3px;
  font-size: 11px;
  padding: 2px 6px;
}

.wx-books {
  padding-left: 18px;
}

.wx-book-meta {
  color: #94a3b8;
}

.wx-state {
  color: #94a3b8;
  padding: 24px 0;
  text-align: center;
}

.wx-match {
  background: #1e293b;
  border: 0;
  border-radius: 4px;
  color: inherit;
  cursor: pointer;
  display: block;
  font: inherit;
  margin-bottom: 6px;
  padding: 8px;
  text-align: left;
  width: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .wx-root {
    transition: none;
  }
}
```

- [ ] **Step 2: Implementer launcher.js**

```js
const STYLE = `
:host { all: initial; }
.wx-launcher {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483646;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 999px;
  color: #e2e8f0;
  cursor: pointer;
  font: 13px/1 system-ui, -apple-system, Segoe UI, sans-serif;
  padding: 10px 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.wx-launcher[hidden] { display: none; }
`;

export function createLauncher({ doc, onClick }) {
  const host = doc.createElement('div');
  const root = host.attachShadow({ mode: 'open' });

  const style = doc.createElement('style');
  style.textContent = STYLE;

  const button = doc.createElement('button');
  button.className = 'wx-launcher';
  button.type = 'button';
  button.textContent = 'Voir les regles';
  button.hidden = true;
  button.addEventListener('click', onClick);

  root.append(style, button);
  doc.body.append(host);

  return {
    show: () => {
      button.hidden = false;
    },
    hide: () => {
      button.hidden = true;
    },
    destroy: () => host.remove()
  };
}
```

- [ ] **Step 3: Implementer panel.js**

```js
import browser from '../../vendor/browser.js';
import { STATUS } from '../../core/messages.js';
import { el } from './render/el.js';
import { renderDatasheet } from './render/datasheet.js';
import { renderWeapons } from './render/weapons.js';
import { renderAbilities } from './render/abilities.js';
import { renderLore } from './render/lore.js';
import { renderState } from './render/states.js';

async function loadStyles(doc) {
  const style = doc.createElement('style');
  const url = browser.runtime.getURL('content/panel/panel.css');
  style.textContent = await (await fetch(url)).text();
  return style;
}

export async function createPanel({ doc, onSelect }) {
  const host = doc.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });

  const root = el(doc, 'div', { class: 'wx-root', 'data-open': 'false' });
  const close = el(doc, 'button', { class: 'wx-close', type: 'button', 'aria-label': 'Fermer' }, 'x');
  const tabs = el(doc, 'div', { class: 'wx-tabs', role: 'tablist' });
  const body = el(doc, 'div', { class: 'wx-body' });

  root.append(close, tabs, body);
  shadow.append(await loadStyles(doc), root);
  doc.body.append(host);

  const open = () => root.setAttribute('data-open', 'true');
  const closePanel = () => root.setAttribute('data-open', 'false');

  close.addEventListener('click', closePanel);
  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePanel();
  });

  function showSections(sections) {
    body.replaceChildren(...sections.filter(Boolean));
  }

  function buildTabs(entries) {
    tabs.replaceChildren();
    if (entries.length < 2) return;

    for (const [index, entry] of entries.entries()) {
      const tab = el(
        doc,
        'button',
        { class: 'wx-tab', type: 'button', role: 'tab', 'aria-selected': String(index === 0) },
        entry.label
      );
      tab.addEventListener('click', () => {
        for (const other of tabs.children) other.setAttribute('aria-selected', 'false');
        tab.setAttribute('aria-selected', 'true');
        showSections(entry.sections());
      });
      tabs.append(tab);
    }
  }

  return {
    open,
    close: closePanel,
    destroy: () => host.remove(),

    showCharacter(character) {
      const regles = () => [
        renderDatasheet(doc, character),
        renderWeapons(doc, character.weapons),
        renderAbilities(doc, character)
      ];
      const histoire = () => [renderLore(doc, character)];

      const entries = [{ label: 'Regles', sections: regles }];
      if (renderLore(doc, character)) entries.push({ label: 'Histoire', sections: histoire });

      buildTabs(entries);
      showSections(regles());
    },

    showState(status) {
      tabs.replaceChildren();
      showSections([renderState(doc, status)]);
    },

    showMatches(matches) {
      tabs.replaceChildren();
      const boutons = matches.map((match) => {
        const bouton = el(
          doc,
          'button',
          { class: 'wx-match', type: 'button' },
          `${match.name} - ${match.faction ?? ''}`
        );
        bouton.addEventListener('click', () => onSelect(match.id));
        return bouton;
      });
      showSections([el(doc, 'div', {}, renderState(doc, STATUS.AMBIGUOUS), ...boutons)]);
    }
  };
}
```

Le CSS est charge par `fetch` sur une ressource de l'extension puis injecte dans le Shadow DOM. C'est necessaire car une balise `link` vers une ressource `chrome-extension://` est bloquee par la CSP de nombreux sites marchands. Cet appel vise `runtime.getURL`, donc une ressource empaquetee dans l'extension : il ne sort pas du navigateur et ne contredit pas la regle interdisant au content script de joindre un hote distant.

- [ ] **Step 4: Verifier visuellement**

```bash
npm run build
```

Recharger l'extension, ouvrir une page produit d'un site cible. Le panneau n'apparait pas encore, il sera cable a la tache 12. Verifier uniquement l'absence d'erreur de chargement de module dans la console de la page.

- [ ] **Step 5: Commit**

```bash
git add src/content/panel
git commit -m "feat: coque du panneau en Shadow DOM, onglets et lanceur flottant"
```

---

### Task 12: Content script et observation des SPA

**Files:**
- Create: `src/content/spa-observer.js`, `src/content/main.js`
- Modify: `src/content/content.js` (remplace le fichier vide de la tache 1)

**Interfaces:**
- Consumes: `detect` de `detect/index.js`, `createPanel` de `panel.js`, `createLauncher` de `launcher.js`, `MSG` et `STATUS` de `messages.js`
- Produces: `observeUrlChanges(win, callback) => stop()` de `spa-observer.js`. `start()` de `main.js`.

- [ ] **Step 1: Implementer spa-observer.js**

```js
export function observeUrlChanges(win, callback, delayMs = 400) {
  const { history } = win;
  let last = win.location.href;
  let timer;

  const check = () => {
    win.clearTimeout(timer);
    timer = win.setTimeout(() => {
      if (win.location.href === last) return;
      last = win.location.href;
      callback(last);
    }, delayMs);
  };

  const pushState = history.pushState;
  const replaceState = history.replaceState;

  history.pushState = function (...args) {
    pushState.apply(this, args);
    check();
  };
  history.replaceState = function (...args) {
    replaceState.apply(this, args);
    check();
  };

  win.addEventListener('popstate', check);

  return () => {
    history.pushState = pushState;
    history.replaceState = replaceState;
    win.removeEventListener('popstate', check);
    win.clearTimeout(timer);
  };
}
```

Le delai absorbe le rendu asynchrone de la SPA, qui met a jour le DOM apres le changement d'URL.

- [ ] **Step 2: Implementer main.js**

```js
import browser from '../vendor/browser.js';
import { detect } from './detect/index.js';
import { createPanel } from './panel/panel.js';
import { createLauncher } from './panel/launcher.js';
import { observeUrlChanges } from './spa-observer.js';
import { MSG, STATUS } from '../core/messages.js';
import { getSettings } from '../core/settings.js';

let panel;
let launcher;
let dernier = null;

async function ouvrirFiche(id) {
  const reponse = await browser.runtime.sendMessage({ type: MSG.CHARACTER, id });
  if (reponse?.status === STATUS.MATCH) panel.showCharacter(reponse.character);
  else panel.showState(reponse?.status ?? STATUS.ERROR);
}

function appliquer(reponse) {
  if (reponse.status === STATUS.MATCH) panel.showCharacter(reponse.character);
  else if (reponse.status === STATUS.AMBIGUOUS) panel.showMatches(reponse.matches);
  else panel.showState(reponse.status);
}

async function analyser() {
  const trouve = detect(document, location.href);

  if (!trouve) {
    dernier = null;
    launcher.hide();
    return;
  }
  if (trouve.normalized === dernier) return;
  dernier = trouve.normalized;

  const reponse = await browser.runtime.sendMessage({
    type: MSG.RESOLVE,
    name: trouve.normalized,
    site: trouve.site
  });

  if (!reponse || reponse.status === STATUS.NOT_FOUND) {
    launcher.hide();
    return;
  }

  launcher.show();
  appliquer(reponse);
}

export async function start() {
  const { showLauncher } = await getSettings();
  if (!showLauncher) return;

  panel = await createPanel({ doc: document, onSelect: ouvrirFiche });
  launcher = createLauncher({ doc: document, onClick: () => panel.open() });

  await analyser();
  observeUrlChanges(window, () => {
    panel.close();
    analyser();
  });
}
```

Le panneau est prepare mais reste ferme. Seul le clic sur le lanceur l'ouvre, conformement a la decision de ne jamais s'imposer sur la page marchande.

- [ ] **Step 3: Implementer content.js**

C'est le seul fichier declare dans `content_scripts`, et il doit rester un script classique.

```js
(async () => {
  const api = globalThis.browser ?? globalThis.chrome;
  const { start } = await import(api.runtime.getURL('content/main.js'));
  await start();
})();
```

- [ ] **Step 4: Verifier de bout en bout**

```bash
npm run mock
```

Dans un autre terminal :

```bash
npm run build
```

Recharger `dist/chrome`, ouvrir les options, renseigner `http://127.0.0.1:8787` comme URL d'API. Les options n'existent qu'a la tache 13 ; en attendant, regler la valeur depuis la console du service worker :

```js
chrome.storage.sync.set({ apiBaseUrl: 'http://127.0.0.1:8787' })
```

Ouvrir une page produit de Marneus Calgar sur un site cible. Attendu : le badge affiche 1, le bouton Voir les regles apparait en bas a droite, le clic ouvre le panneau avec le profil.

- [ ] **Step 5: Commit**

```bash
git add src/content/content.js src/content/main.js src/content/spa-observer.js
git commit -m "feat: content script, cablage du panneau et observation des navigations SPA"
```

---

### Task 13: Page d'options et permission d'hote

**Files:**
- Create: `src/options/options.js`, `src/options/options.css`
- Modify: `src/options/options.html` (remplace le fichier provisoire de la tache 1)

**Interfaces:**
- Consumes: `getSettings` et `setSettings` de `settings.js`, `MSG` de `messages.js`
- Produces: rien pour les autres taches

- [ ] **Step 1: Ecrire options.html**

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Options Warhadex</title>
  <link rel="stylesheet" href="options.css">
</head>
<body>
  <main>
    <h1>Warhadex</h1>

    <form id="reglages">
      <label for="apiBaseUrl">Adresse de votre API</label>
      <input id="apiBaseUrl" name="apiBaseUrl" type="url" placeholder="https://api.exemple.fr" required>
      <p class="aide">Warhadex demandera l autorisation d acceder a ce domaine lors de l enregistrement</p>

      <label for="apiKey">Cle d API</label>
      <input id="apiKey" name="apiKey" type="password" autocomplete="off">
      <p class="aide">Facultative. Envoyee en en-tete Authorization Bearer</p>

      <label for="cacheTtlDays">Duree du cache en jours</label>
      <input id="cacheTtlDays" name="cacheTtlDays" type="number" min="1" max="90" value="7">

      <label class="case">
        <input id="showLauncher" name="showLauncher" type="checkbox" checked>
        Afficher le bouton sur les pages produit
      </label>

      <div class="actions">
        <button type="submit">Enregistrer</button>
        <button type="button" id="vider">Vider le cache</button>
      </div>
    </form>

    <p id="etat" role="status"></p>
  </main>

  <script type="module" src="options.js"></script>
</body>
</html>
```

- [ ] **Step 2: Ecrire options.css**

```css
body {
  background: #0f172a;
  color: #e2e8f0;
  font: 15px/1.6 system-ui, -apple-system, Segoe UI, sans-serif;
  margin: 0;
  padding: 32px 16px;
}

main {
  margin: 0 auto;
  max-width: 520px;
}

h1 {
  font-size: 20px;
}

label {
  display: block;
  font-weight: 600;
  margin-top: 16px;
}

label.case {
  align-items: center;
  display: flex;
  font-weight: 400;
  gap: 8px;
}

input[type='url'],
input[type='password'],
input[type='number'] {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 4px;
  box-sizing: border-box;
  color: inherit;
  font: inherit;
  padding: 8px;
  width: 100%;
}

.aide {
  color: #94a3b8;
  font-size: 13px;
  margin: 4px 0 0;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 24px;
}

button {
  background: #38bdf8;
  border: 0;
  border-radius: 4px;
  color: #0f172a;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  padding: 8px 16px;
}

#vider {
  background: transparent;
  border: 1px solid #334155;
  color: #e2e8f0;
}

#etat {
  margin-top: 16px;
  min-height: 1.6em;
}

#etat[data-erreur='true'] {
  color: #fca5a5;
}
```

- [ ] **Step 3: Ecrire options.js**

```js
import browser from '../vendor/browser.js';
import { getSettings, setSettings } from '../core/settings.js';
import { MSG } from '../core/messages.js';

const form = document.querySelector('#reglages');
const etat = document.querySelector('#etat');

function afficher(message, erreur = false) {
  etat.textContent = message;
  etat.dataset.erreur = String(erreur);
}

function motifOrigine(valeur) {
  return `${new URL(valeur).origin}/*`;
}

async function charger() {
  const reglages = await getSettings();
  form.apiBaseUrl.value = reglages.apiBaseUrl;
  form.apiKey.value = reglages.apiKey;
  form.cacheTtlDays.value = reglages.cacheTtlDays;
  form.showLauncher.checked = reglages.showLauncher;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  let origine;
  try {
    origine = motifOrigine(form.apiBaseUrl.value);
  } catch {
    afficher('Adresse invalide', true);
    return;
  }

  // la demande doit partir du geste utilisateur, donc avant toute attente
  const accorde = await browser.permissions.request({ origins: [origine] });
  if (!accorde) {
    afficher('Permission refusee, Warhadex ne pourra pas joindre votre API', true);
    return;
  }

  await setSettings({
    apiBaseUrl: form.apiBaseUrl.value.trim(),
    apiKey: form.apiKey.value,
    cacheTtlDays: Number(form.cacheTtlDays.value),
    showLauncher: form.showLauncher.checked
  });

  afficher('Reglages enregistres');
});

document.querySelector('#vider').addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: MSG.CLEAR_CACHE });
  afficher('Cache vide');
});

await charger();
```

- [ ] **Step 4: Verifier manuellement**

```bash
npm run build
```

Recharger l'extension, ouvrir les options. Saisir `http://127.0.0.1:8787`, enregistrer. Attendu : le navigateur demande l'autorisation pour l'origine, puis le message Reglages enregistres apparait.

Note : sur Chrome, `optional_host_permissions` est declare en `https://*/*`. Pour tester avec le mock en HTTP local, ajouter temporairement `"http://127.0.0.1/*"` a `optional_host_permissions` dans `src/manifest.json`, ou lancer le mock derriere HTTPS. Retirer cette entree avant toute publication.

- [ ] **Step 5: Commit**

```bash
git add src/options
git commit -m "feat: page d options avec demande de permission d hote et vidage du cache"
```

---

### Task 14: Documentation et validation finale

**Files:**
- Create: `README.md`, `docs/api-contract.md`

**Interfaces:**
- Consumes: rien
- Produces: rien

- [ ] **Step 1: Ecrire docs/api-contract.md**

Reprendre integralement la section 5 de la spec, en y ajoutant un exemple de reponse pour chacun des deux endpoints, la liste des champs obligatoires et facultatifs, et la note suivante en preambule :

> Ce document decrit le contrat que votre backend doit respecter. L extension ne fait aucune hypothese au dela de ce qui est ecrit ici. Les champs facultatifs absents sont simplement masques dans le panneau.

Documenter explicitement que le matching flou est de la responsabilite du serveur, que `score` doit etre normalise entre 0 et 1, et que le client considere une correspondance comme certaine si elle est unique ou si son score atteint 0.8.

- [ ] **Step 2: Ecrire README.md**

Sections a couvrir :

1. Ce que fait l'extension, en trois phrases.
2. Prerequis : Node 20 ou superieur pour le build et les tests.
3. Installation en developpement :

```bash
npm install
npm run build
```

Chrome : `chrome://extensions`, activer le mode developpeur, Charger l'extension non empaquetee, choisir `dist/chrome`.

Firefox : `about:debugging#/runtime/this-firefox`, Charger un module temporaire, choisir `dist/firefox/manifest.json`.

Safari : necessite macOS et Xcode.

```bash
xcrun safari-web-extension-converter dist/safari --project-location build/safari --macos-only
```

Ouvrir le projet genere dans Xcode, le compiler, puis activer l'extension dans Safari via Reglages, Extensions, apres avoir coche Autoriser les extensions non signees dans le menu Developpement.

4. Configuration : ouvrir les options, renseigner l'adresse de l'API, accorder la permission.
5. Serveur mock :

```bash
npm run mock
```

6. Tests :

```bash
npm test
```

7. Ajouter un site marchand : creer un fichier dans `src/content/detect/adapters/`, l'enregistrer dans `registry.js`, ajouter le domaine dans `host_permissions`, `content_scripts.matches` et `web_accessible_resources.matches` du manifeste, ajouter une fixture et un cas dans `test/adapters.test.js`.
8. Avertissement : l'extension ne contient aucune donnee de regles. Le contenu servi par votre API releve du droit d'auteur de Games Workshop et son usage est de votre responsabilite.

- [ ] **Step 3: Lancer la suite complete**

```bash
npm test
```

Attendu : tous les tests passent.

- [ ] **Step 4: Validation manuelle sur les cinq sites**

Avec le mock lance et l'API configuree, ouvrir une page produit d'un personnage present dans le jeu de donnees sur chacun des cinq sites, plus une boutique hors liste pour verifier que le repli generique ne s'active pas hors des domaines declares.

Pour chaque site, verifier : le badge passe a 1, le lanceur apparait, le panneau s'ouvre au clic, le profil et les armes s'affichent, l'onglet Histoire est present. Consigner le resultat dans un tableau ajoute au README.

Sur warhammer.com, verifier en plus la navigation SPA : passer d'une fiche produit a une autre sans rechargement et confirmer que le panneau se ferme puis se met a jour.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/api-contract.md
git commit -m "docs: README d installation et contrat d API detaille"
```

---

## Notes d'execution

- Les taches 2, 3, 6, 7, 8 et 10 sont purement testables et peuvent etre menees sans navigateur.
- Les taches 4, 9, 11, 12 et 13 exigent une verification manuelle en navigateur.
- La tache 4 depend de fixtures reelles. Si un site est inaccessible au moment de l'execution, produire une fixture synthetique et le signaler en commentaire dans le fichier, puis revenir la corriger avant la tache 14.
- L'ordre 1 a 14 est un ordre de dependance. Les taches 6 et 7 sont interchangeables, tout comme 10 et 11.
