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
- [Confidentialite](#confidentialite)

## Prerequis

Node 20 ou superieur pour le build et les tests. Aucune autre dependance
n'est necessaire pour developper l'extension (pas de bundler, pas de
dependance runtime).

Cote navigateur, l'extension vise Manifest V3 : Chrome 111 ou superieur,
Firefox 109 ou superieur (version a partir de laquelle Gecko prend en charge
Manifest V3, et valeur declaree en `strict_min_version`), Safari 16.4 ou
superieur.

## Structure du projet

- `src/content` : detection du personnage sur la page produit (aucun acces
  reseau, aucune cle d'API) et rendu du panneau.
- `src/background` : service worker, seul composant autorise a contacter
  l'API distante.
- `src/core` : reglages (`settings.js`), client d'API (`api-client.js`),
  cache TTL (`cache.js`) et constantes de protocole (`messages.js`).
- `src/options` : page de reglages de l'extension.
- `src/vendor` : abstraction `browser`/`chrome` commune aux trois moteurs.
- `mock-api` : serveur HTTP de reference et jeu de donnees d'exemple pour
  developper et tester sans API distante reelle.
- `docs/api-contract.md` : contrat d'API detaille, destine a quiconque
  implemente le backend.

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

L'extension ne fonctionne pas tant qu'elle n'a pas d'API a interroger.

1. Ouvrir la page d'options de l'extension (via l'icone de la barre
   d'outils, ou `chrome://extensions` / `about:addons` selon le navigateur).
2. Renseigner l'adresse de base de votre API dans "Adresse de votre API".
3. Au moment d'enregistrer, le navigateur demande la permission d'acceder a
   ce domaine (`permissions.request`, declenchee par le clic sur
   "Enregistrer") : l'accorder est necessaire, sinon Warhadex ne pourra pas
   joindre l'API et affichera l'etat "API non configuree" sur les pages
   produit.
   Les origines demandables sont declarees dans
   `optional_host_permissions` : tout `https://`, plus `http://localhost` et
   `http://127.0.0.1` pour le serveur mock de developpement. Une adresse en
   `http://` sur un autre hote est refusee par le navigateur, et la page
   d'options l'indique explicitement. Le port n'entre jamais dans le motif de
   permission demande : une permission d'hote couvre tous les ports de cet
   hote.
4. Une cle d'API est facultative ; si renseignee, elle est envoyee en
   en-tete `Authorization: Bearer <cle>` par le service worker uniquement.
5. La duree du cache (en jours) et l'activation du lanceur sur les pages
   produit sont egalement reglables depuis cette page.

Le format exact des reponses attendues par l'extension est documente dans
`docs/api-contract.md`.

## Serveur mock

```bash
npm run mock
```

Demarre le serveur mock de reference (`mock-api/server.mjs`) sur
`http://127.0.0.1:8787`, une implementation executable du contrat d'API,
utile pour renseigner `apiBaseUrl` dans les reglages pendant le
developpement, et utilisee par les tests automatises.

Il expose deux routes en lecture seule :

- `GET /v1/resolve?q=<nom>&site=<site>` : renvoie jusqu'a 5 correspondances
  triees par score de similarite.
- `GET /v1/characters/:id` : renvoie la fiche complete d'un personnage, ou
  une erreur 404 si l'identifiant est inconnu.

Exemple :

```bash
curl "http://127.0.0.1:8787/v1/resolve?q=marneus%20calgar"
```

Le jeu de donnees (`mock-api/data/characters.json`) utilise des noms de
personnages et des valeurs de profil plausibles, mais tous les textes de
regles, de lore et les references d'ouvrages sont explicitement factices :
voir [Copyright et responsabilite du contenu](#copyright-et-responsabilite-du-contenu).

## Tests

```bash
npm test
```

Execute `node --test "test/**/*.test.js"` (la forme repertoire, `node --test
test/`, echoue avec `MODULE_NOT_FOUND` sur Node 24 sous Windows ; utiliser
le motif glob ci-dessus). A la date de redaction de ce document, la suite
compte 72 tests, tous passants, couvrant entre autres la detection sur
fixtures HTML capturees des quatre sites pris en charge, le client d'API
(succes, 404, 429, panne reseau), le cache et son expiration, ainsi que des
tests d'integration jsdom qui montent le panneau reel, cliquent les onglets,
verifient le Shadow DOM, la page d'options, et le patch d'historique SPA.

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
reel : toute la validation a ete faite par des tests automatises (72 tests
`node --test`, y compris des tests d'integration jsdom qui montent le
panneau, simulent des clics d'onglets, le Shadow DOM et la navigation SPA).
Personne n'a donc encore confirme que le service worker s'enregistre
reellement dans un navigateur, que l'API `action` (badge, icone) se comporte
comme attendu sur chaque moteur, ou que le panneau s'affiche correctement
sur une vraie page produit. La checklist ci-dessous doit etre executee et
cochee par une personne disposant d'un navigateur avant de considerer
l'extension pret pour un usage reel.

Prerequis pour cette verification : `npm run mock` lance, et l'API
configuree sur `http://127.0.0.1:8787` dans les reglages de l'extension
chargee (voir [Configuration](#configuration)). Utiliser un nom de
personnage present dans `mock-api/data/characters.json`.

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
- [ ] La page d'options s'ouvre, accepte une URL d'API, demande la
      permission d'hote correspondante, et enregistre les reglages.
- [ ] Le bouton "Vider le cache" fonctionne (verifiable en observant que la
      resolution suivante repasse par le mock, ex. via les logs du serveur
      mock).

### Firefox

- [ ] L'extension se charge sans erreur depuis `dist/firefox/manifest.json`
      en module temporaire.
- [ ] Meme sequence complete que Chrome (badge, lanceur, panneau, profil,
      armes, onglet Histoire) verifiee sur au moins un des quatre sites.
- [ ] Navigation SPA sur warhammer.com verifiee comme ci-dessus.
- [ ] La page d'options fonctionne (permission d'hote, enregistrement,
      vidage du cache).

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

Pour cette raison, le jeu de donnees fourni avec le serveur mock
(`mock-api/data/characters.json`) utilise des noms de personnages reels et
des valeurs de profil plausibles a des fins de demonstration, mais tous les
textes d'aptitudes, de lore et les references d'ouvrages sont
deliberement factices : ce depot ne reproduit aucun texte de regle ou de
lore protege.

## Confidentialite

La cle d'API renseignee dans les reglages ne quitte jamais le service
worker : le script de contenu n'emet aucune requete vers un hote distant, et
seul le nom de produit normalise ainsi que le domaine d'origine sont envoyes
a l'API que vous avez vous-meme configuree.
