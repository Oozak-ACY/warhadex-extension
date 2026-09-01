# Contrat d'API Warhadex

> Ce document decrit le contrat que votre backend doit respecter. L extension
> ne fait aucune hypothese au dela de ce qui est ecrit ici. Les champs
> facultatifs absents sont simplement masques dans le panneau.

Ce document reprend et detaille la section 5 de la spec de design
(`docs/superpowers/specs/2026-08-31-warhadex-extension-design.md`). En cas de
divergence, ce fichier fait foi pour les details d implementation ; la spec
fait foi pour les decisions d architecture.

L extension elle-meme ne contient et ne distribue aucune donnee de regles
Warhammer 40 000. Elle affiche uniquement ce que sert l API que vous
configurez dans les reglages. Voir la section Copyright du README pour le
detail des responsabilites.

Un serveur mock de reference implementant integralement ce contrat est fourni
dans `mock-api/`. Il constitue un exemple executable, pas une specification :
en cas de doute, ce document prevaut.

## Generalites

- Base configurable par l utilisateur dans les reglages de l extension
  (`apiBaseUrl`).
- Toutes les reponses sont en JSON, encodees en UTF-8.
- Le matching flou (tolerance aux fautes de frappe, variantes de nom,
  traductions) est **entierement de la responsabilite du serveur**. Le
  client envoie un nom normalise et une liste de correspondances scorees ;
  il n implemente lui-meme aucune logique de recherche approximative.
- `score` doit etre un flottant **normalise entre 0 et 1** ou 1 signifie une
  correspondance certaine.
- Le client considere une correspondance comme certaine (et charge la fiche
  automatiquement) si, et seulement si, les deux conditions suivantes sont
  vraies **ensemble** :
  - la liste `matches` ne contient qu un seul element ;
  - le score de cet element est **strictement superieur a 0.8**.

  Dans tous les autres cas, le panneau affiche un selecteur et laisse
  l utilisateur choisir. Cela inclut le cas d une correspondance unique mais
  peu sure, ou le selecteur ne propose qu une entree : c est volontaire,
  afficher a tort un personnage avec assurance est un echec plus grave que
  demander confirmation. Un serveur qui veut declencher l affichage direct
  doit donc renvoyer une seule correspondance et un score au dessus de 0.8.
- Authentification facultative : si une cle d API est renseignee dans les
  reglages, elle est envoyee dans l en-tete `Authorization: Bearer <cle>`
  sur chaque requete. La cle ne quitte jamais le service worker de
  l extension : elle n est jamais transmise au script de contenu ni a la
  page hote.

## GET /v1/resolve

Resout un nom de produit normalise en une liste de personnages candidats.

### Parametres (query string)

| Parametre | Obligatoire | Description |
|---|---|---|
| `q` | oui | Nom normalise du produit (accents retires, minuscules, bruit commercial filtre par l extension avant l envoi). |
| `site` | non | Domaine d origine (ex. `warhammer.com`). A visee statistique et de desambiguisation ; le serveur peut l ignorer. |

### Reponse 200

```json
{
  "matches": [
    { "id": "marneus-calgar", "name": "Marneus Calgar", "faction": "Adeptus Astartes", "score": 0.97 },
    { "id": "roboute-guilliman", "name": "Roboute Guilliman", "faction": "Adeptus Astartes", "score": 0.42 }
  ]
}
```

Exemple sans correspondance :

```json
{
  "matches": []
}
```

`matches` peut etre vide (aucun personnage reconnu). Le serveur trie les
elements par `score` decroissant.

### Champs de chaque element de `matches`

| Champ | Obligatoire | Type | Description |
|---|---|---|---|
| `id` | oui | string | Identifiant stable du personnage, utilise ensuite pour `GET /v1/characters/:id`. |
| `name` | oui | string | Nom affiche dans le selecteur en cas d ambiguite. |
| `score` | oui | number | Flottant entre 0 et 1, voir regle de certitude ci-dessus. |
| `faction` | non | string | Affiche a cote du nom dans le selecteur si presente. |

## GET /v1/characters/:id

Renvoie la fiche complete d un personnage.

### Parametre de chemin

| Parametre | Obligatoire | Description |
|---|---|---|
| `id` | oui | Identifiant retourne par `/v1/resolve`. |

### Reponse 200

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
      "a": 3,
      "skill": "2+",
      "s": 4,
      "ap": -1,
      "d": 1,
      "keywords": ["Twin-linked"]
    },
    {
      "name": "Fist of Ultramar",
      "type": "melee",
      "a": 4,
      "skill": "2+",
      "s": 8,
      "ap": -2,
      "d": 3,
      "keywords": []
    }
  ],
  "abilities": [
    { "name": "Master Tactician", "type": "core", "text": "Texte de l aptitude." }
  ],
  "keywords": ["Infantry", "Character", "Epic Hero", "Marneus Calgar"],
  "points": [{ "models": 1, "cost": 95 }],
  "lore": "Texte d histoire du personnage.",
  "books": [
    { "title": "Codex: Space Marines", "author": "Games Workshop", "year": 2023, "url": "https://www.warhammer-community.com/" },
    { "title": "Ouvrage sans lien", "author": "Games Workshop", "year": 1993 }
  ],
  "source": { "label": "Codex: Space Marines 10e ed.", "url": "https://www.warhammer-community.com/" }
}
```

Exemple minimal (uniquement les champs obligatoires) :

```json
{
  "id": "marneus-calgar",
  "name": "Marneus Calgar",
  "profile": { "m": "5\"", "t": 5, "sv": "2+", "w": 6, "ld": "5+", "oc": 1 }
}
```

Une fiche ainsi reduite s affiche sans erreur : seul le profil est rendu, et
les sections armes, aptitudes, points, histoire et livres sont simplement
absentes du panneau.

### Champs de la fiche

| Champ | Obligatoire | Type | Description |
|---|---|---|---|
| `id` | oui | string | Identifiant du personnage. |
| `name` | oui | string | Nom affiche en entete du panneau. |
| `profile` | oui | object | Caracteristiques (`m`, `t`, `sv`, `w`, `ld`, `oc`). Les six sont attendues par le rendu ; une caracteristique absente s affiche comme vide plutot que de faire echouer le rendu. |
| `faction` | non | string | Affichee en sous-titre. |
| `role` | non | string | Affiche en sous-titre (ex. `Epic Hero`, `Battleline`). |
| `invulnerable` | non | string | Sauvegarde invulnerable, affichee a cote du profil si presente. |
| `weapons` | non | array | Liste de profils d armes. Section masquee si absente ou vide. Chaque arme : `name` (string), `type` (`"ranged"` ou `"melee"`), `range` (string, tir uniquement), `a`, `skill`, `s`, `ap`, `d` (valeurs de profil), `keywords` (array de string). |
| `abilities` | non | array | Liste d aptitudes. Chaque element : `name` (string), `type` (string libre, ex. `"core"`, `"faction"`, `"wargear"`), `text` (string). |
| `keywords` | non | array | Mots-cles du datasheet, affiches sous forme d etiquettes. |
| `points` | non | array | Cout en points. Chaque element : `models` (nombre de figurines), `cost` (nombre de points). |
| `lore` | non | string | Texte d histoire. Determine, avec `books`, l apparition de l onglet Histoire : l onglet n existe que si l un des deux est present. |
| `books` | non | array | Ouvrages associes. Chaque element : `title` (string, obligatoire au sein de l objet), `author` (string), `year` (number), `url` (string). |
| `source` | non | object | Reference de la source des regles (`label`, `url`), affichee en pied de panneau. |

### Note sur `books[].url`

L extension n insere jamais de HTML brut issu de l API (voir section 6 de la
spec de design) et applique une regle de securite simple sur les liens de
livres : une URL n est transformee en lien cliquable **que si elle
correspond a l expression reguliere `^https?://`**. Toute autre valeur
(chemin relatif, `javascript:`, chaine vide, schema non http) est affichee
en texte brut, sans lien. Un backend qui sert des chemins relatifs ou des
identifiants internes dans `books[].url` doit s attendre a voir ces valeurs
rendues comme du texte simple, pas comme des liens.

## Erreurs

| Code | Signification | Comportement client |
|---|---|---|
| `404` | Fiche ou resolution inconnue. | Etat "personnage introuvable" dans le panneau. |
| `429` | Quota depasse. Le serveur devrait inclure l en-tete `Retry-After` (secondes). | Le client extrait la valeur de `Retry-After` en interne mais ne l affiche pas : le `429` est signale a l utilisateur via le meme message d erreur generique que les autres pannes serveur, sans distinction visuelle avec un `5xx`. C est un choix delibere pour garder l interface simple. |
| `5xx` | Erreur serveur. | Etat d erreur generique. |
| Reseau injoignable / timeout | Panne reseau, API arretee, mauvaise URL. | Etat "hors ligne". |
| URL d API absente ou invalide dans les reglages | Configuration manquante. | Etat "API non configuree". Ce cas couvre a la fois une `apiBaseUrl` vide et une `apiBaseUrl` qui n est pas une URL valide : les deux produisent le meme etat cote client. |

Le client distingue donc, dans l interface, quatre etats de non-succes :
hors ligne, API non configuree, personnage introuvable, et erreur generique
(qui recouvre toutes les erreurs serveur non specifiquement gerees,
`429` inclus).
