// Genere les captures 1280 x 800 des fiches boutique depuis le build et la vraie API
// Usage : npm run build puis node outils/generer-captures.mjs (necessite Edge et la cle)
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const BUILD = path.join(RACINE, 'dist', 'chrome');
const PAGES = path.join(RACINE, 'dist', 'captures');
const SORTIE = path.join(RACINE, 'design', 'captures');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const module = (chemin) => import(pathToFileURL(path.join(BUILD, chemin)).href);
const { createApiClient } = await module('core/api-client.js');
const { createResolver } = await module('background/resolver.js');
const { STATUS } = await module('core/messages.js');

const memoire = new Map();
const cache = {
  get: async (cle) => memoire.get(cle),
  set: async (cle, valeur) => void memoire.set(cle, valeur),
  clear: async () => memoire.clear()
};
const resolver = createResolver({ api: createApiClient(), cache, getSettings: async () => ({ cacheTtlDays: 7 }) });

const css = readFileSync(path.join(BUILD, 'content', 'panel', 'panel.css'), 'utf8');
// les pages de capture vivent dans dist/captures, a cote du build
const versBuild = (chemin) => `../chrome/${chemin}`;
globalThis.browser = { runtime: { getURL: versBuild } };
globalThis.fetch = ((reel) => async (url, options) =>
  String(url).endsWith('panel.css') ? { text: async () => css } : reel(url, options))(globalThis.fetch);

const { createPanel } = await module('content/panel/panel.js');
const { createLauncher } = await module('content/panel/launcher.js');
const { LOGOS } = await module('content/panel/logos.js');

async function panneau(prepare) {
  const doc = new JSDOM('<!doctype html><body>').window.document;
  const panel = await createPanel({ doc, onSelect: () => {}, onSearch: async () => [] });
  await prepare(panel, doc.body.firstElementChild.shadowRoot);
  const racine = doc.body.firstElementChild.shadowRoot.querySelector('.wx-root');
  racine.setAttribute('data-open', 'true');
  return racine.outerHTML;
}

function lanceur() {
  const doc = new JSDOM('<!doctype html><body>').window.document;
  createLauncher({ doc, onClick: () => {}, iconUrl: versBuild(LOGOS.lanceur) }).show();
  const ombre = doc.body.firstElementChild.shadowRoot;
  const style = ombre.querySelector('style').textContent.replace(':host { all: initial; }', '');
  return `<style>${style}</style>${ombre.querySelector('button').outerHTML}`;
}

// boutique fictive et neutre : aucune marque reelle n est imitee
function boutique({ fil, titre, prix, panneauOuvert }) {
  return `<header class="b-tete"><span class="b-logo">Boutique de figurines</span>
<nav><span>Nouveautes</span><span>Armees</span><span>Peintures</span><span>Livres</span></nav></header>
<main class="b-produit${panneauOuvert ? ' b-etroit' : ''}">
<div class="b-visuel" aria-hidden="true"></div>
<div class="b-infos"><p class="b-fil">${fil}</p><h1>${titre}</h1>
<p class="b-prix">${prix}</p><p class="b-stock">En stock, expedie sous 48 h</p>
<button class="b-panier" type="button">Ajouter au panier</button>
<p class="b-texte">Figurines en plastique livrees non montees et non peintes. Colle et peinture vendues separement.</p></div>
</main>`;
}

function page({ scene, defilerVers }) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Capture</title><style>
@font-face { font-family: 'Warhadex Cinzel'; src: url('${versBuild('assets/fonts/cinzel.woff2')}') format('woff2'); font-weight: 400 600; font-display: block; }
@font-face { font-family: 'Warhadex Garamond'; src: url('${versBuild('assets/fonts/eb-garamond.woff2')}') format('woff2'); font-weight: 400 600; font-display: block; }
html, body { margin: 0; height: 100%; overflow: hidden; }
body { background: #f4f4f2; color: #26262b; font: 15px/1.5 'Segoe UI', Arial, sans-serif; }
.b-tete { align-items: center; background: #26262b; color: #f4f4f2; display: flex; gap: 40px; height: 64px; padding: 0 40px; }
.b-logo { font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
.b-tete nav { display: flex; gap: 24px; font-size: 14px; opacity: 0.85; }
.b-produit { display: flex; gap: 40px; padding: 48px 40px; }
.b-etroit { padding-right: 460px; }
.b-visuel { background: repeating-linear-gradient(135deg, #deded9 0 18px, #d4d4ce 18px 36px); border-radius: 6px; flex: none; height: 420px; width: 380px; }
.b-etroit .b-visuel { height: 340px; width: 300px; }
.b-infos { max-width: 460px; }
.b-fil { color: #6b6b72; font-size: 13px; margin: 0 0 8px; }
.b-infos h1 { font-size: 30px; line-height: 1.2; margin: 0 0 16px; }
.b-prix { font-size: 24px; font-weight: 700; margin: 0; }
.b-stock { color: #2f7a3e; margin: 4px 0 20px; }
.b-panier { background: #26262b; border: 0; border-radius: 4px; color: #fff; font: 600 15px 'Segoe UI', Arial, sans-serif; padding: 12px 28px; }
.b-texte { color: #55555c; margin-top: 24px; }
${css}
</style></head><body>${scene}
<script>
const racine = document.querySelector('.wx-root');
const cible = ${JSON.stringify(defilerVers ?? null)};
if (racine && cible) {
  const titre = [...racine.querySelectorAll('h3')].find((h) => h.textContent === cible);
  // le bouton de fermeture reste colle en haut : le titre doit passer dessous
  if (titre) racine.scrollTop = titre.offsetTop - 56;
}
</script></body></html>`;
}

async function main() {
  if (!existsSync(BUILD)) throw new Error('lancer npm run build avant');
  await mkdir(PAGES, { recursive: true });
  await mkdir(SORTIE, { recursive: true });

  const calgar = await resolver.resolveName('marneus calgar in armour of antilochus');
  const intercessors = await resolver.resolveName('intercessor squad');
  const recherche = await resolver.rechercher('intercessor');
  for (const [nom, r] of [['calgar', calgar], ['intercessors', intercessors]]) {
    if (r.status !== STATUS.MATCH) throw new Error(`${nom} non resolu : ${r.status}`);
  }

  const fil = 'Accueil / Space Marines / Personnages';
  const scenes = {
    '01-fiche': page({
      scene:
        boutique({ fil, titre: 'Marneus Calgar in Armour of Antilochus', prix: '45,00 EUR', panneauOuvert: true }) +
        (await panneau((p) => p.showCharacter(calgar.character)))
    }),
    '02-armes': page({
      scene:
        boutique({ fil: 'Accueil / Space Marines / Infanterie', titre: 'Intercessor Squad', prix: '52,50 EUR', panneauOuvert: true }) +
        (await panneau((p) => p.showCharacter(intercessors.character))),
      defilerVers: 'Armes de tir'
    }),
    '03-recherche': page({
      scene:
        boutique({ fil: 'Accueil / Space Marines / Boites', titre: 'Space Marines Combat Patrol', prix: '140,00 EUR', panneauOuvert: true }) +
        (await panneau((p, ombre) => {
          p.showHome();
          ombre.querySelector('.wx-search').setAttribute('value', 'intercessor');
          p.setHome(recherche.matches);
          p.showHome();
          if (recherche.matches.length > 5) ombre.querySelector('.wx-home-message').textContent = '5 premiers resultats';
        }))
    }),
    '04-lanceur': page({
      scene: boutique({ fil, titre: 'Marneus Calgar in Armour of Antilochus', prix: '45,00 EUR', panneauOuvert: false }) + lanceur()
    })
  };

  for (const [nom, html] of Object.entries(scenes)) {
    const fichier = path.join(PAGES, `${nom}.html`);
    await writeFile(fichier, html);
    execFileSync(EDGE, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--allow-file-access-from-files',
      // un profil par capture : sinon Edge confie la page a l instance precedente et sort sans capturer
      `--user-data-dir=${path.join(PAGES, `profil-${nom}`)}`,
      '--window-size=1280,800',
      '--virtual-time-budget=5000',
      `--screenshot=${path.join(SORTIE, `${nom}.png`)}`,
      pathToFileURL(fichier).href
    ]);
  }
}

await main();
