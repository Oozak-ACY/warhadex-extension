# Warhadex - Extension multi-navigateur de consultation de fiches Warhammer 40,000

Date : 2026-08-31
Statut : design valide, pret pour plan d'implementation

## 1. Objectif

Quand l'utilisateur consulte la page d'achat d'une figurine de personnage
Warhammer 40,000 sur un site marchand, l'extension reconnait le personnage et
lui permet d'ouvrir, sans quitter la page, un panneau presentant les
statistiques et les regles de jeu de ce personnage.

## 2. Perimetre

Dans le perimetre :

- Warhammer 40,000, 10e edition, uniquement.
- Reconnaissance sur cinq sites marchands, plus un extracteur generique
  couvrant la longue traine des boutiques Shopify et WooCommerce. Le premier
  lot est : `warhammer.com`, la boutique Games Workshop, Element Games,
  Wayland Games et Philibert.
- Affichage des statistiques, profils d'armes, aptitudes, mots-cles et couts en
  points.
- Affichage de l'histoire du personnage et des livres associes, en second
  onglet du panneau. Fonctionnalite secondaire, mais prevue des le contrat
  d'API pour ne pas avoir a le casser plus tard.
- Chrome, Firefox et Safari, Manifest V3, a partir d'une source unique.

Hors perimetre :

- Age of Sigmar, The Old World, Horus Heresy.
- Constitution ou hebergement de la base de donnees. L'API est fournie par
  l'utilisateur ; ce projet en definit le contrat et en livre un mock.
- Construction de liste d'armee, comparaison d'unites, calculs de probabilite.
- Generation du projet Xcode Safari, qui exige un Mac et n'est pas
  reproductible ici. La procedure est documentee.

## 3. Decisions retenues

| Decision | Choix | Motif |
|---|---|---|
| Source des donnees | API distante hebergee par l'utilisateur | Choix du commanditaire. Permet de corriger la base sans republier l'extension. |
| Contrat d'API | Defini par ce projet, implemente par l'utilisateur | L'API n'existe pas encore. Un mock executable rend l'extension testable immediatement. |
| Surface d'affichage | Panneau injecte dans la page | Choix du commanditaire. |
| Ouverture du panneau | Manuelle, jamais automatique | S'imposer sur une page marchande est intrusif et perturbe le tunnel d'achat. |
| Detection | Registre d'adaptateurs par site plus repli generique | warhammer.com est une SPA React qui impose de toute facon un adaptateur dedie ; le cout du registre est donc deja paye. |
| Matching flou | Cote serveur | Garde le client stable et rend la reconnaissance corrigeable sans republication. |
| Outillage | Aucun bundler, aucune dependance runtime, ESM natif | L'extension se charge non empaquetee telle quelle ; la revue de code et la revue des stores sont simplifiees. |

## 4. Architecture

Quatre unites, chacune avec une responsabilite unique et une interface
explicite.

### 4.1 content/detect - page vers nom brut

Entree : le `document` de la page. Sortie : `{ raw, normalized, site, source }`
ou `null`, ou `source` indique quel extracteur a repondu, ce qui sert au
diagnostic et aux tests.

Un registre associe un motif de domaine a un adaptateur. Chaque adaptateur
expose `match(url)` et `extract(document)`. Quand aucun adaptateur ne
correspond, ou quand l'adaptateur retourne `null`, l'extracteur generique prend
le relais et lit dans l'ordre : le JSON-LD de type `Product`, puis `og:title`,
puis le premier `h1`.

La normalisation retire les accents, passe en minuscules, et supprime le bruit
commercial connu : `Warhammer 40,000`, `Warhammer 40k`, `Citadel`, mentions de
taille de boite, codes produit, suffixes de langue.

Cette unite est pure : aucune API navigateur autre que la lecture du DOM,
aucun acces reseau, aucun etat. Elle est testable dans Node sur des fixtures
HTML.

### 4.2 content/panel - fiche vers interface

Entree : un objet fiche conforme au schema. Sortie : un arbre DOM.

Le panneau est monte dans un Shadow DOM, avec un `all: initial` sur l'hote, ce
qui garantit qu'aucune feuille de style du site marchand ne le traverse et
reciproquement. Il comporte deux onglets : Regles, affiche par defaut, et
Histoire, present uniquement si la fiche porte des donnees de lore.

Un lanceur flottant, discret, apparait uniquement quand un personnage a ete
reconnu. Le clic ouvre le panneau. Aucune ouverture automatique.

Les fonctions de rendu sont pures : fiche vers DOM, sans acces reseau ni
stockage.

### 4.3 background - resolution, cache, permissions

Le service worker est le seul composant qui parle au reseau. Il recoit les
messages du content script, consulte le cache, appelle l'API si necessaire, et
repond.

Le cache vit dans `storage.local`, avec un TTL par defaut de sept jours pour
les fiches et de vingt-quatre heures pour les resolutions negatives. Le cache
negatif evite de solliciter le serveur sur chaque page sans personnage.

Le badge de l'icone signale la reconnaissance d'un personnage sur l'onglet
courant.

### 4.4 options - configuration

Page d'options permettant de saisir l'URL de base de l'API, une cle d'API
facultative, et les reglages d'affichage. A l'enregistrement de l'URL,
l'extension demande la permission d'hote correspondante via
`permissions.request`, declenchee par le geste utilisateur.

### 4.5 Flux de donnees

1. Le content script s'execute sur les domaines declares.
2. `detect` produit un nom normalise, ou rien, auquel cas le flux s'arrete.
3. Le content script envoie `{ type: 'resolve', name, site }` au service worker.
4. Le service worker consulte le cache, sinon appelle `GET /v1/resolve`.
5. En cas de correspondance unique et suffisamment sure, il appelle
   `GET /v1/characters/:id` et renvoie la fiche. En cas de correspondances
   multiples, il renvoie la liste et le panneau affiche un selecteur.
6. Le content script affiche le lanceur. Le panneau ne s'ouvre qu'au clic.
7. Sur les SPA, un observateur de `pushState`, `replaceState` et `popstate`
   relance le cycle a chaque changement d'URL.

## 5. Contrat d'API

Base configurable. Toutes les reponses sont en JSON, encodees en UTF-8.

### GET /v1/resolve

Parametres : `q` le nom normalise, obligatoire ; `site` le domaine d'origine,
facultatif, a visee statistique et de desambiguisation.

Reponse 200 :

```json
{
  "matches": [
    { "id": "marneus-calgar", "name": "Marneus Calgar", "faction": "Adeptus Astartes", "score": 0.97 }
  ]
}
```

`matches` peut etre vide. `score` est un flottant entre 0 et 1. Le serveur trie
par score decroissant. Le client considere une correspondance comme certaine si
elle est unique et que son score depasse 0.8 ; sinon il propose un choix.

### GET /v1/characters/:id

Reponse 200 : une fiche complete.

```json
{
  "id": "marneus-calgar",
  "name": "Marneus Calgar",
  "faction": "Adeptus Astartes",
  "role": "Epic Hero",
  "profile": { "m": "5\"", "t": 5, "sv": "2+", "w": 6, "ld": "5+", "oc": 1 },
  "invulnerable": "4+",
  "weapons": [
    {
      "name": "Gauntlets of Ultramar",
      "type": "ranged",
      "range": "18\"",
      "a": 3, "skill": "2+", "s": 4, "ap": -1, "d": 1,
      "keywords": ["Twin-linked"]
    }
  ],
  "abilities": [
    { "name": "Master Tactician", "type": "core", "text": "..." }
  ],
  "keywords": ["Infantry", "Character", "Epic Hero", "Marneus Calgar"],
  "points": [{ "models": 1, "cost": 95 }],
  "lore": "...",
  "books": [{ "title": "...", "author": "...", "year": 1993, "url": "..." }],
  "source": { "label": "...", "url": "..." }
}
```

Champs obligatoires : `id`, `name`, `profile`. Tous les autres sont facultatifs
et le panneau masque proprement les sections absentes.

### Erreurs

`404` fiche inconnue, `429` quota depasse avec en-tete `Retry-After`, `5xx`
erreur serveur. Le client distingue trois etats dans l'interface : hors ligne,
API non configuree, personnage introuvable.

### Authentification

Facultative. Si une cle est configuree, elle est envoyee dans l'en-tete
`Authorization: Bearer <cle>`. La cle ne quitte jamais le service worker et
n'est jamais exposee au content script ni a la page hote.

## 6. Securite et vie privee

- Le content script n'a aucun acces reseau. Tout passe par le service worker.
- Aucune donnee de navigation n'est transmise en dehors du nom de produit
  normalise et du domaine, et uniquement vers l'API que l'utilisateur a
  lui-meme configuree.
- Les permissions d'hote marchandes sont declarees et limitees a cinq domaines
  plus le repli. L'origine de l'API est en permission facultative, accordee
  explicitement.
- Le contenu renvoye par l'API est insere via `textContent` et creation de
  noeuds, jamais via `innerHTML`, pour ecarter toute injection depuis la base.
- Aucune permission `tabs`, `history`, `cookies` ou `webRequest`.

## 7. Compatibilite multi-navigateur

Source unique. Un script de build assemble trois repertoires de distribution en
substituant le manifeste.

- Chrome et derives Chromium : `background.service_worker`, MV3 natif.
- Firefox : `background.scripts` avec `type: module`, plus
  `browser_specific_settings.gecko.id`, requis pour la publication.
- Safari 16.4 et superieur : meme manifeste que Chrome, puis conversion en
  projet Xcode via `xcrun safari-web-extension-converter`. Cette etape exige
  macOS et n'est pas automatisable depuis ce depot ; elle est documentee dans le
  README.

Un shim d'espace de noms expose `browser` avec promesses sur les trois moteurs,
sans dependance externe.

## 8. Strategie de test

- `content/detect` et `content/panel/render` sont purs et testes avec
  `node:test` sur des fixtures HTML capturees des cinq sites cibles, plus des
  fixtures degenerees : produit sans JSON-LD, titre bruite, page de categorie
  plutot que de produit.
- Le client d'API est teste contre le serveur mock, y compris les chemins
  d'erreur 404, 429 et reseau coupe.
- Le cache est teste sur l'expiration, l'invalidation et le cache negatif.
- La verification manuelle consiste a charger `dist/chrome` non empaquete et a
  parcourir les cinq sites cibles.

## 9. Livrables

- Arborescence complete de l'extension, chargeable non empaquetee.
- `manifest.json` Chrome et Safari, `manifest.firefox.json` Firefox.
- Serveur mock avec un jeu de donnees d'exemple couvrant au moins cinq
  personnages nommes.
- `docs/api-contract.md`, contrat detaille destine a l'implementeur du backend.
- README couvrant l'installation par navigateur, la configuration et la
  procedure Safari.

## 10. Risques

| Risque | Impact | Attenuation |
|---|---|---|
| warhammer.com change son DOM | Perte de la detection sur le site prioritaire | Adaptateur isole et court, repli generique toujours actif, fixtures de test pour detecter la regression |
| L'API de l'utilisateur n'existe pas encore | Extension non demontrable | Serveur mock livre et pointe par defaut en developpement |
| Rejet par les stores pour permissions trop larges | Publication bloquee | Domaines enumeres, origine d'API en permission facultative, aucune permission sensible |
| Contenu de regles soumis au droit d'auteur | Risque juridique | L'extension ne contient et ne distribue aucune donnee de regles ; elle affiche uniquement ce que sert l'API de l'utilisateur, dont il est responsable |
