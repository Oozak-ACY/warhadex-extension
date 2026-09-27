# Publication sur addons.mozilla.org

Historique : les versions 1.0.0 et 1.0.1 ont ete signees en non repertorie
(« On your own »). AMO reprend par defaut le mode de la version precedente, et
l'etape de distribution peut passer inapercue. La publication publique (« On
this site ») passe par une nouvelle version, un numero de version ne servant
qu'une fois par extension.

Pour savoir si une version est publique sans se connecter :
`https://addons.mozilla.org/api/v5/addons/addon/warhadex/` repond 200 pour une
extension publique et 401 sinon.

Les textes destines a la boutique, plus bas, sont accentues : ils sont affiches
aux utilisateurs, contrairement au code et a sa documentation.

## Nouvelle version publique

1. Produire l'archive : `npm run package:firefox` donne
   `dist/paquets/warhadex-firefox-<version>.zip`.
2. Sur https://addons.mozilla.org/developers/addon/3074568/versions, choisir
   « Upload New Version » (« Soumettre une nouvelle version »).
3. A l'etape de distribution, choisir **On this site** (« Sur ce site »).
4. Deposer l'archive, puis cocher Firefox pour ordinateur.
5. Code source : repondre **non**. Le code n'est ni minifie ni concatene ;
   seul `core/config.js` est reecrit au build, et il ne contient que la cle d'API.
6. Remplir la fiche avec les textes ci-dessous. Les captures d'ecran sont
   facultatives mais fortement conseillees.
7. Notes au relecteur : coller l'explication de l'avertissement du linter.

Une version publique peut attendre une relecture humaine avant d'apparaitre
dans les recherches.

## Avertissement attendu du linter

`web-ext lint` et la validation d'addons.mozilla.org signalent
`UNSAFE_VAR_ASSIGNMENT` (« Unsafe call to import for argument 0 ») sur
`content/content.js`. C'est un avertissement, il ne bloque pas la signature, et
il ne peut pas disparaitre sans bundler le code : l'adresse d'un module
d'extension change avec chaque installation, elle ne peut donc pas etre ecrite
en dur, et un bundle obligerait a fournir le code source a chaque soumission.
Note a donner au relecteur :

> content/content.js loads the extension's own ES module with
> `import(api.runtime.getURL('content/main.js'))`. Content scripts cannot use
> static imports, and the URL is built from a constant path inside the
> extension package, never from page data.

## Fiche

L'extension est en anglais par defaut (`default_locale`) et traduite en
francais. La fiche AMO suit : langue par defaut **English**, puis ajouter la
traduction **Français** depuis le selecteur de langue de la fiche.

**Nom** : Warhadex

### English (langue par defaut)

**Summary** (250 caracteres maximum) :

> Shows the game stats, weapons and abilities of a miniature right on the
> product pages of tabletop miniature stores.

**Description** :

> Warhadex detects the miniature shown on a product page and opens its game
> datasheet in one click: profiles, invulnerable save, base size, ranged and
> melee weapons, abilities and keywords.
>
> Supported games: Warhammer 40,000 (10th edition) to start with, more tabletop
> miniature games to come. Data powered by Wahapedia.
>
> Supported stores: warhammer.com, Element Games, Wayland Games and Philibert.
> When detection is unsure, for example on a box holding several units, a name
> search lets you pick the right datasheet.
>
> The interface is available in English and French.
>
> Warhadex is an unofficial fan tool, not affiliated with the publishers of the
> games shown (Games Workshop, etc.) nor with Wahapedia.

### Français

**Résumé** :

> Affiche les caractéristiques, armes et aptitudes de jeu d'une figurine sur
> les pages produit des boutiques de jeux de figurines.

**Description** :

> Warhadex détecte la figurine présentée sur une page produit et ouvre, d'un
> clic, sa fiche de jeu : profils, sauvegarde invulnérable, taille de socle,
> armes de tir et de mêlée, aptitudes et mots-clés.
>
> Jeux pris en charge : Warhammer 40,000 (10e édition) pour commencer, d'autres
> jeux de figurines suivront. Données fournies par Wahapedia.
>
> Boutiques prises en charge : warhammer.com, Element Games, Wayland Games et
> Philibert. Si la détection hésite, par exemple sur une boîte contenant
> plusieurs unités, une recherche par nom permet de choisir la bonne fiche.
>
> L'interface est disponible en anglais et en français.
>
> Warhadex est un outil de fan non officiel, sans lien avec les éditeurs des
> jeux présentés (Games Workshop, etc.) ni avec Wahapedia.

**Catégorie** : Games & Entertainment (« Jeux et divertissement »)

**Licence** : à choisir par l'auteur (« All Rights Reserved » par défaut).

**Adresse de contact** : loan.kvl.dev@gmail.com

## Captures d'écran

Quatre captures en 1280 x 800 sont dans `design/captures/`, dans l'ordre de la
fiche : fiche ouverte, tableau des armes, recherche par nom, bouton flottant.
Elles montrent le vrai panneau, avec de vraies fiches de l'API, sur une page de
boutique fictive et neutre qui n'imite aucun marchand reel.

Légendes proposées :

1. Le profil complet du personnage s'ouvre à côté de la page produit.
2. Armes de tir et de mêlée, avec leurs caractéristiques et mots-clés.
3. Une recherche par nom pour choisir la bonne fiche dans une boîte.
4. Un bouton discret apparaît sur les pages produit reconnues.

Pour les régénérer, par exemple après un changement de design :

```bash
npm run build
node outils/generer-captures.mjs
```

Le script interroge la vraie API avec la clé du build et photographie les pages
avec Edge en mode headless.

## Collecte de données

Le formulaire reprend la déclaration du manifeste : **contenu de sites web**
(`websiteContent`), requis.

Justification à donner si elle est demandée :

> Le nom du produit affiché sur la page est envoyé à l'API Warhadex pour
> retrouver la fiche du personnage correspondant. Aucune adresse de page, aucun
> historique et aucune donnée personnelle ne sont transmis.

## Politique de confidentialité

À coller dans le champ « Politique de confidentialité » de la fiche.

> **Politique de confidentialité de Warhadex**
>
> Warhadex ne collecte aucune donnée personnelle et n'utilise ni publicité, ni
> traceur, ni statistiques d'usage.
>
> Pour afficher une fiche, l'extension envoie à son serveur
> (warhadex-api.orion-sphere.fr) uniquement :
>
> - le nom du produit lu sur la page produit d'une boutique prise en charge ;
> - le texte saisi dans la recherche par nom du panneau ;
> - l'identifiant de la fiche consultée.
>
> Ni l'adresse de la page, ni le site visité, ni l'historique de navigation ne
> sont transmis. Comme pour toute requête web, le serveur reçoit l'adresse IP de
> l'appareil pour y répondre, mais il ne tient aucun journal et ne conserve
> aucune donnée liée aux utilisateurs : ni adresse IP, ni recherche.
>
> Les fiches reçues sont conservées localement dans le navigateur, sept jours
> par défaut, pour éviter des requêtes répétées. Les réglages sont stockés dans
> le profil Firefox et suivent la synchronisation si elle est activée. Le cache
> se vide depuis la page d'options de l'extension.
>
> Contact : loan.kvl.dev@gmail.com
