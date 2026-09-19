# Warhadex

Quand vous consultez la page d'achat d'une figurine de personnage
Warhammer 40 000 sur un site marchand pris en charge, Warhadex reconnait le
personnage vendu et affiche, dans un panneau injecte sans quitter la page,
ses statistiques de jeu, ses profils d'armes et ses regles. L'extension ne
contient elle-meme aucune base de regles : tout ce qui s'affiche provient de
l'API que vous configurez vous-meme dans les reglages. Elle fonctionne sur
Chrome, Firefox et Safari a partir d'une source unique, sans bundler ni
dependance runtime.

## Sommaire

- [Prerequis](#prerequis)
- [Structure du projet](#structure-du-projet)
- [Installation en developpement](#installation-en-developpement)
- [Configuration](#configuration)
- [Serveur mock](#serveur-mock)
- [Tests](#tests)
- [Ajouter un site marchand](#ajouter-un-site-marchand)
- [Verification manuelle en navigateur (a faire)](#verification-manuelle-en-navigateur-a-faire)
- [Copyright et responsabilite du contenu](#copyright-et-responsabilite-du-contenu)
- [Polices](#polices)
- [Confidentialite](#confidentialite)

## Prerequis

Node 20 ou superieur pour le build et les tests. Aucune autre dependance
n'est necessaire pour developper l'extension (pas de bundler, pas de
dependance runtime).

Cote navigateur, l'extension vise Manifest V3 : Chrome 111 ou superieur,
Firefox 140 ou superieur, Safari 16.4 ou superieur. Le socle Firefox est celui
qui lit la declaration de collecte de donnees exigee par Mozilla, voir
[Publication Firefox](#publication-firefox).

## Structure du projet

- `src/content` : detection du personnage sur la page produit (aucun acces
  reseau, aucune cle d'API) et rendu du panneau.
- `src/background` : service worker, seul composant autorise a contacter
  l'API distante. `service-worker.js` se limite au cablage des ecouteurs ;
  la resolution, le cache et la regle de certitude vivent dans `resolver.js`,
  le badge dans `badge.js`, tous deux testables hors navigateur.
- `src/core` : reglages (`settings.js`), client d'API (`api-client.js`),
  traduction des agregats de l'API vers la fiche affichee
  (`datasheet-mapper.js`), cache TTL (`cache.js`) et constantes de protocole
  (`messages.js`).
- `src/options` : page de reglages de l'extension.
- `src/vendor` : abstraction `browser`/`chrome` commune aux trois moteurs.
- `mock-api` : serveur HTTP reproduisant le sous-ensemble de routes consomme,
  servi depuis des agregats reels captures, pour developper et tester sans
  l'API distante.
- `docs/api-contract.md` : les routes et les champs que l'extension consomme
  reellement, et comment elle les interprete.

## Installation en developpement

```bash
npm install
npm run build
```

`npm run build` construit trois repertoires independants dans `dist/` :
`dist/chrome`, `dist/firefox` et `dist/safari`, chacun charge tel quel par
son navigateur.

### Chrome (et derives Chromium)

1. Ouvrir `chrome://extensions`.
2. Activer le mode developpeur.
3. Cliquer sur "Charger l'extension non empaquetee".
4. Choisir le dossier `dist/chrome`.

### Firefox

1. Ouvrir `about:debugging#/runtime/this-firefox`.
2. Cliquer sur "Charger un module temporaire".
3. Choisir le fichier `dist/firefox/manifest.json`.

Ce chargement est temporaire : il ne survit pas au redemarrage de Firefox et
doit etre refait a chaque session de test.

### Safari

Safari necessite macOS et Xcode ; cette etape ne peut pas etre executee
depuis ce depot sous Windows ou Linux. Sur une machine macOS avec les outils
en ligne de commande Xcode installes :

```bash
xcrun safari-web-extension-converter dist/safari --project-location build/safari --macos-only
```

Puis ouvrir le projet Xcode genere dans `build/safari`, le compiler, et
activer l'extension dans Safari via Reglages, Extensions, apres avoir coche
"Autoriser les extensions non signees" dans le menu Developpement de Safari.

## Configuration

L'extension interroge exclusivement l'API `https://warhadex-api.orion-sphere.fr`,
avec une cle integree au build. Ni l'adresse ni la cle ne sont des reglages : il
n'y a rien a configurer apres l'installation.

La cle est envoyee dans l'en-tete `X-API-Key`. Elle doit etre fournie au moment
du build :

```bash
WARHADEX_API_KEY=votre-cle npm run build
```

ou en placant la cle seule dans un fichier `cle-api.local` a la racine du depot,
puis `npm run build`. Ce fichier est ignore par git, et la cle n'est ecrite que
dans `dist/` : `src/core/config.js` reste vide dans le depot. **Sans cle, le
build echoue** : une extension sans cle serait installable mais incapable de
joindre l'API, sans aucun moyen de lui en fournir une.

Changer de cle impose donc un nouveau build et une nouvelle diffusion de
l'extension. Si l'API refuse la cle, le panneau affiche « Acces a l'API Warhadex
refuse ».

La cle etant dans l'archive de l'extension, elle est lisible par quiconque possede
le build : elle ne protege pas l'API, elle identifie le client.

La page d'options ne regle que la duree du cache et l'activation du lanceur. Les
routes appelees et les champs lus sont documentes dans `docs/api-contract.md`.

## Serveur mock

```bash
npm run mock
```

Demarre le serveur mock (`mock-api/server.mjs`) sur `http://127.0.0.1:8787`.
Il reproduit le sous-ensemble de routes que l'extension consomme, sur les memes
formes de reponse que l'API reelle, et sert deux agregats captures tels quels.
Il est utilise par les tests automatises ; l'extension elle-meme ne peut pas
l'interroger, son adresse d'API etant fixe.

Routes exposees :

- `GET /search?q=&type=datasheet` : correspondances avec un score sur 100.
- `GET /datasheets?q=` : liste avec faction, utilisee pour departager des
  homonymes.
- `GET /datasheets/{id}` : agregat complet, ou une erreur 404.
- `GET /abilities` : referentiel d'aptitudes.
- `GET /health`.

Exemple :

```bash
curl "http://127.0.0.1:8787/search?q=calgar&type=datasheet"
```

Les textes de regles et de lore du jeu de donnees proviennent d'agregats
reels : voir [Copyright et responsabilite du contenu](#copyright-et-responsabilite-du-contenu).

## Tests

```bash
npm test
```

Execute `node --test "test/**/*.test.js"` (la forme repertoire, `node --test
test/`, echoue avec `MODULE_NOT_FOUND` sur Node 24 sous Windows ; utiliser
le motif glob ci-dessus). A la date de redaction de ce document, la suite
compte 179 tests, tous passants, couvrant entre autres la detection sur
fixtures HTML capturees des quatre sites pris en charge, le client d'API
(succes, 404, 429, panne reseau), le cache, son expiration et son cache
negatif, la logique du service worker (regle de certitude, TTL, badge,
traduction des erreurs), la repartition des reglages entre `storage.sync` et
`storage.local`, ainsi que des tests d'integration jsdom qui montent le
panneau reel, cliquent les onglets, verifient le Shadow DOM, la page
d'options, le patch d'historique SPA et la reprise de detection sur mutation
du DOM.

```bash
npm run build
```

Construit `dist/chrome`, `dist/firefox` et `dist/safari` a partir de
`src/`. Un test (`test/build.test.js`) verifie la coherence des manifestes
generes.

## Ajouter un site marchand

La detection repose sur un registre d'adaptateurs, plus un repli generique
pour les sites non declares. Pour ajouter un site :

1. Creer un fichier `src/content/detect/adapters/<nom-du-site>.js` exportant
   un objet `{ id, match(url), extract(document) }`, sur le modele des
   adaptateurs existants (`warhammer-com.js`, `element-games.js`,
   `wayland-games.js`, `philibert.js`).
2. L'enregistrer dans `src/content/detect/registry.js` (import et ajout au
   tableau `adapters`).
3. Ajouter le domaine dans trois listes de `src/manifest.json` :
   `host_permissions`, `content_scripts[0].matches` et
   `web_accessible_resources[0].matches`. Les trois doivent rester
   synchronisees : un domaine present dans `content_scripts` mais absent de
   `web_accessible_resources` empeche le content script de charger ses
   propres modules.
4. Ajouter une fixture HTML dans `test/fixtures/` (page produit reelle ou
   reconstituee) et un cas correspondant dans `test/adapters.test.js` : le
   routage vers le nouvel adaptateur, l'extraction sur la fixture, et le cas
   "page sans produit" qui doit renvoyer `null` plutot que de deviner.

Le site n'a pas forcement besoin d'un adaptateur dedie : le repli generique
(JSON-LD `Product`, puis `og:title`, puis premier `h1`) est essaye des qu'un
adaptateur specifique ne repond pas. Mais le content script lui-meme n'est
injecte que sur les domaines listes dans `content_scripts[0].matches` du
manifeste : un site absent de cette liste n'execute aucun code de
l'extension, adaptateur ou repli generique confondus, quel que soit son
balisage. Ajouter un domaine a `content_scripts[0].matches` (et aux deux
autres listes ci-dessus) est donc necessaire pour couvrir un nouveau site,
avec ou sans adaptateur dedie.

## Verification manuelle en navigateur (a faire)

**Cette section documente un travail non realise, et non un simple
complement recommande.** L'environnement dans lequel ce projet a ete
implemente ne peut pas ouvrir `chrome://extensions` ni aucun navigateur
reel : toute la validation a ete faite par des tests automatises (179 tests
`node --test`, y compris des tests d'integration jsdom qui montent le
panneau, simulent des clics d'onglets, le Shadow DOM et la navigation SPA).
Personne n'a donc encore confirme que le service worker s'enregistre
reellement dans un navigateur, que l'API `action` (badge, icone) se comporte
comme attendu sur chaque moteur, ou que le panneau s'affiche correctement
sur une vraie page produit. La checklist ci-dessous doit etre executee et
cochee par une personne disposant d'un navigateur avant de considerer
l'extension pret pour un usage reel.

Prerequis pour cette verification : un build fait avec une cle d'API valide
(voir [Configuration](#configuration)). L'extension interroge l'API de
production, ni son adresse ni sa cle n'etant reglables.

### Chrome

- [ ] L'extension se charge sans erreur depuis `dist/chrome` en mode non
      empaquete.
- [ ] Le service worker apparait comme actif dans `chrome://extensions`
      (pas de mention "inactif" ou d'erreur).
- [ ] Sur une page produit warhammer.com correspondant a un personnage du
      jeu de donnees mock : le badge de l'icone passe a `1`.
- [ ] Le lanceur flottant apparait sur la page.
- [ ] Le clic sur le lanceur ouvre le panneau.
- [ ] L'onglet Regles affiche le profil (M, T, Sv, PV, Ld, OC) et les armes.
- [ ] Le pied de l'onglet Regles affiche la source servie par l'API
      (`Source : Serveur mock Warhadex` avec le jeu de donnees mock).
- [ ] L'onglet Histoire est present et affiche le lore ou les livres.
- [ ] Meme sequence (badge, lanceur, panneau, profil, armes, onglet
      Histoire) verifiee sur Element Games.
- [ ] Meme sequence verifiee sur Wayland Games.
- [ ] Meme sequence verifiee sur Philibert.
- [ ] Sur une boutique hors liste : le lanceur n'apparait pas, car aucun
      content script n'est injecte en dehors des quatre domaines declares
      dans `content_scripts[0].matches` du manifeste (le repli generique
      n'est donc jamais atteint sur un domaine non declare).
- [ ] Navigation SPA sur warhammer.com : depuis une fiche produit
      reconnue, naviguer vers une autre fiche produit differente sans
      recharger la page (lien interne). Le panneau se ferme puis se
      remet a jour avec le nouveau personnage, badge inclus, sans qu'un
      rechargement complet de la page n'ait eu lieu.
- [ ] Navigation SPA sur warhammer.com depuis une fiche produit reconnue vers
      une page de categorie sans personnage : le badge de l'onglet redevient
      vide au lieu de rester fige sur `1`.
- [ ] Sur warhammer.com, page rendue cote client : le lanceur apparait meme
      quand le titre du produit arrive apres le chargement initial (reprise
      par observation du DOM, abandonnee au bout de dix secondes).
- [ ] Reseau coupe : le lanceur reste visible et son clic ouvre le panneau
      sur le message "Votre API est injoignable".
- [ ] Avec un build dont la cle est revoquee : le panneau affiche "Acces a
      l API Warhadex refuse".
- [ ] La page d'options s'ouvre, ne propose ni adresse ni cle, et enregistre
      la duree du cache et l'activation du lanceur sans demande de permission.
- [ ] Le bouton "Vider le cache" fonctionne (verifiable en observant que la
      resolution suivante repasse par l'API, dans l'onglet Reseau de la console
      du service worker).

### Firefox

- [ ] L'extension se charge sans erreur depuis `dist/firefox/manifest.json`
      en module temporaire.
- [ ] Meme sequence complete que Chrome (badge, lanceur, panneau, profil,
      armes, onglet Histoire) verifiee sur au moins un des quatre sites.
- [ ] Navigation SPA sur warhammer.com verifiee comme ci-dessus.
- [ ] La page d'options fonctionne (enregistrement, vidage du cache).

### Safari

- [ ] Le projet Xcode genere par `xcrun safari-web-extension-converter`
      compile sans erreur.
- [ ] L'extension s'active dans Reglages > Extensions apres avoir autorise
      les extensions non signees.
- [ ] Meme sequence complete que Chrome verifiee sur au moins un des quatre
      sites.

### Resultat

A completer par la personne qui execute cette checklist, avec la date et le
navigateur utilise. Ne pas cocher une case sans l'avoir reellement
observee.

## Copyright et responsabilite du contenu

Warhadex ne contient, n'embarque et ne distribue aucune donnee de regles,
de profil, de lore ou de texte Warhammer 40 000. L'extension est un simple
client d'affichage : tout le contenu montre dans le panneau provient
integralement de l'API que vous configurez vous-meme dans les reglages.

Si cette API sert du contenu issu des publications Warhammer 40 000,
Games Workshop en detient le droit d'auteur, et l'usage de ce contenu (sa
constitution, son hebergement, sa republication au travers de votre API)
est **entierement de votre responsabilite**, pas de celle de ce projet.

Cela reste vrai du code livre. En revanche, depuis l'integration a l'API
reelle, **ce depot contient des extraits de contenu protege** : les fixtures
de test (`test/fixtures/api/`) et le jeu de donnees du serveur mock
(`mock-api/data/`) sont des agregats captures tels quels sur une API servant
des donnees derivees de Wahapedia, textes d'aptitudes et de lore compris.

Le volume est celui d'un echantillon de test — deux datasheets et quatre
aptitudes — et non d'une base redistribuee, mais la distinction est de fait,
pas de droit. Si ce depot doit devenir public, il faut soit remplacer ces
fixtures par des donnees fabriquees, soit les generer a la demande depuis
votre API plutot que les versionner.

## Polices

Le panneau utilise Cinzel pour les titres et EB Garamond pour le texte, deux
polices sous licence SIL Open Font License embarquees dans `src/assets/fonts/`
avec leur licence (`OFL-cinzel.txt`, `OFL-eb-garamond.txt`). Seul le
sous-ensemble latin des fichiers variables est inclus, graisses 400 a 600, soit
environ 70 Ko.

Chrome ignore les regles `@font-face` declarees dans un Shadow DOM : le content
script declare donc ces polices une fois dans le document de la page, sous des
noms propres a l'extension (`Warhadex Cinzel`, `Warhadex Garamond`) pour ne
jamais redefinir une police du site marchand. Si la politique de securite d'un
site bloque leur chargement, le panneau retombe sur une police systeme a
empattements.

## Logo

Les originaux du logo, en 1024 x 1024 avec fond transparent, sont dans
`design/logo/`, hors de `src` : le build copie tout `src` dans l'extension et ces
fichiers pesent pres de 200 Ko chacun. Les tailles utiles sont generees par :

```bash
python outils/generer-logos.py
```

Le script necessite Pillow. Il produit :

| Fichier | Variante | Usage |
|---|---|---|
| `assets/icons/icon-16.png`, `icon-32.png` | tete verte | icone de barre d'outils |
| `assets/icons/icon-48.png`, `icon-128.png` | buste vert | page des extensions, boutique |
| `assets/logo/tete-vert-56.png` | tete verte | bouton flottant |
| `assets/logo/buste-noir-128.png` | buste noir | en-tete du panneau et des options |
| `assets/logo/buste-noir-320.png` | buste noir | filigrane de l'accueil du panneau |

En dessous de 48 px le buste entier devient illisible : les petites icones sont
recadrees sur la casquette et la tete. Les images du panneau sont servies par
balise `img` depuis `web_accessible_resources`, car une `url()` dans la feuille
injectee se resoudrait contre l'adresse du site marchand. La variante blanche,
pour fond sombre, n'est pas encore utilisee.

## Publication Firefox

Les versions 1.0.0 et 1.0.1 ont ete signees en non repertorie : AMO reprend
par defaut le mode de la version precedente. La publication publique passe par
une version envoyee explicitement en « Sur ce site ».

```bash
npm run package:firefox
```

Cette commande refait le build, passe le linter de Mozilla sur `dist/firefox`
puis produit `dist/paquets/warhadex-firefox-<version>.zip`. L'archive contient la
cle d'API : elle ne doit etre deposee que sur addons.mozilla.org.

Trois points du manifeste Firefox sont contraints par la publication :

- l'identifiant `warhadex@orion-sphere.fr` est definitif des la premiere
  soumission, le changer creerait une autre extension ;
- `data_collection_permissions` declare `websiteContent`, car le nom de produit
  lu sur la page est transmis a l'API. Mozilla l'exige des nouvelles extensions ;
- `strict_min_version` vaut 140, premiere version qui lit cette declaration.

Chaque nouvelle version impose d'incrementer `version` dans `package.json` et
`src/manifest.json`. Les textes de la fiche et la politique de confidentialite
sont dans [docs/publication-firefox.md](docs/publication-firefox.md).

## Confidentialite

La cle d'API n'est jamais transmise a un script de contenu ni a une page web :
seul le service worker l'emploie, dans l'en-tete `X-API-Key`. Le script de
contenu n'emet aucune requete vers un hote distant. L'API ne recoit que le nom
de produit normalise lu sur la page, le texte saisi dans la recherche manuelle
et l'identifiant des fiches consultees : ni l'adresse de la page, ni son domaine,
ni aucune donnee personnelle. La cle fait partie de l'archive de l'extension et
reste lisible par quiconque la decompresse.

Les reglages (duree du cache, affichage du lanceur) sont dans `storage.sync` et
suivent donc votre profil. Le bouton "Vider le cache"
ne supprime que les entrees de cache prefixees, jamais vos reglages.
