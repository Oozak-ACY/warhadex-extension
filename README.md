# Warhadex

Extension multi-navigateur (Manifest V3) qui detecte le personnage
Warhammer 40 000 vendu sur une page produit marchande et affiche ses
regles de jeu dans un panneau injecte.

Navigateurs cibles : Chrome 111+, Firefox 101+, Safari 16.4+.

## Structure du projet

- `src/content` : detection du personnage sur la page produit (aucun
  acces reseau, aucune cle d api).
- `src/background` : service worker, seul composant autorise a
  contacter l API distante.
- `src/core` : reglages (`settings.js`), cache TTL (`cache.js`) et
  constantes de protocole (`messages.js`), consommes par le service
  worker.
- `src/options` : page de reglages de l extension.
- `src/vendor` : abstraction `browser`/`chrome`.
- `mock-api` : serveur HTTP de reference et jeu de donnees d exemple
  pour developper et tester sans API distante reelle.

## Developpement

```bash
npm test
```

Lance la suite de tests (`node --test`).

```bash
npm run build
```

Construit l extension dans `dist/`.

```bash
npm run mock
```

Demarre le serveur mock de reference sur `http://127.0.0.1:8787`,
utile pour renseigner `apiBaseUrl` dans les reglages pendant le
developpement.

## Serveur mock

Le serveur mock (`mock-api/server.mjs`) expose deux routes en lecture
seule :

- `GET /v1/resolve?q=<nom>&site=<site>` : renvoie jusqu a 5
  correspondances triees par score de similarite.
- `GET /v1/characters/:id` : renvoie la fiche complete d un
  personnage, ou une erreur 404 si l identifiant est inconnu.

Le jeu de donnees (`mock-api/data/characters.json`) utilise des noms
de personnages et des valeurs de profil plausibles, mais tous les
textes de regles, de lore et les references d ouvrages sont
explicitement factices : ce depot ne reproduit aucun contenu
Games Workshop.

Exemple :

```bash
curl "http://127.0.0.1:8787/v1/resolve?q=marneus%20calgar"
```

## Confidentialite

La cle d API renseignee dans les reglages ne quitte jamais le service
worker : le script de contenu n emet aucune requete vers un hote
distant.
