# Publication sur addons.mozilla.org

Mode choisi : non repertorie (« On your own »). Ce parcours ne demande que
l'archive, les plateformes et la question du code source : il n'a aucun champ de
fiche ni de politique de confidentialite. Les sections Fiche, Collecte de donnees
et Politique de confidentialite ne servent qu'en cas de passage en publique.

## Soumission

1. Se connecter sur https://addons.mozilla.org/developers/ avec un compte Mozilla.
2. « Submit a New Add-on », choisir **On your own** (non repertorie).
3. Deposer `dist/paquets/warhadex-firefox-1.0.0.zip` produit par
   `npm run package:firefox`.
4. Compatibilite : Firefox pour ordinateur uniquement.
5. Code source : repondre **non**. Le code n'est ni minifie ni concatene ni
   genere par un outil, a l'exception de `core/config.js` qui ne contient que la
   cle d'API.
6. Une fois signe, telecharger le `.xpi` depuis la page de la version et le
   distribuer. Il s'installe par glisser-deposer dans Firefox.

## Avertissement attendu du linter

`web-ext lint` et la validation d'addons.mozilla.org signalent
`UNSAFE_VAR_ASSIGNMENT` (« Unsafe call to import for argument 0 ») sur
`content/content.js`. C'est un avertissement, il ne bloque pas la signature, et
il ne peut pas disparaitre sans bundler le code : l'adresse d'un module
d'extension change avec chaque installation, elle ne peut donc pas etre ecrite
en dur, et un bundle obligerait a fournir le code source a chaque soumission. Il
peut etre explique ainsi dans les notes au relecteur :

> content/content.js loads the extension's own ES module with
> `import(api.runtime.getURL('content/main.js'))`. Content scripts cannot use
> static imports, and the URL is built from a constant path inside the
> extension package, never from page data.

## Fiche (publication publique uniquement)

**Nom** : Warhadex

**Resume** (250 caracteres maximum) :

> Affiche les caracteristiques, armes et aptitudes Warhammer 40,000 du
> personnage sur les pages produit des boutiques de figurines.

**Description** :

> Warhadex detecte le personnage presente sur une page produit et ouvre, d'un
> clic, sa fiche de jeu Warhammer 40,000 (10e edition) : profils, sauvegarde
> invulnerable, taille de socle, armes de tir et de melee, aptitudes et mots
> cles.
>
> Boutiques prises en charge : warhammer.com, Element Games, Wayland Games et
> Philibert. Si la detection hesite, par exemple sur une boite contenant
> plusieurs unites, une recherche par nom permet de choisir la bonne fiche.
>
> Warhadex est un outil de fan non officiel, sans lien avec Games Workshop.

**Categorie** : Games & Entertainment

**Licence** : a choisir par l'auteur (« All Rights Reserved » par defaut).

## Collecte de donnees

Le formulaire reprend la declaration du manifeste : **contenu de sites web**
(`websiteContent`), requis.

Justification a donner si elle est demandee :

> Le nom du produit affiche sur la page est envoye a l'API Warhadex pour
> retrouver la fiche du personnage correspondant. Aucune adresse de page, aucun
> historique et aucune donnee personnelle ne sont transmis.

## Politique de confidentialite

A coller dans le champ « Privacy Policy » de la fiche, en publication publique
uniquement.

> **Politique de confidentialite de Warhadex**
>
> Warhadex ne collecte aucune donnee personnelle et n'utilise ni publicite, ni
> traceur, ni statistiques d'usage.
>
> Pour afficher une fiche, l'extension envoie a son serveur
> (warhadex-api.orion-sphere.fr) uniquement :
>
> - le nom du produit lu sur la page produit d'une boutique prise en charge ;
> - le texte saisi dans la recherche par nom du panneau ;
> - l'identifiant de la fiche consultee.
>
> Ni l'adresse de la page, ni le site visite, ni l'historique de navigation ne
> sont transmis. Comme pour toute requete web, le serveur recoit l'adresse IP de
> l'appareil pour y repondre, mais il ne tient aucun journal et ne conserve
> aucune donnee liee aux utilisateurs : ni adresse IP, ni recherche.
>
> Les fiches recues sont conservees localement dans le navigateur, sept jours
> par defaut, pour eviter des requetes repetees. Les reglages sont stockes dans
> le profil Firefox et suivent la synchronisation si elle est activee. Le cache
> se vide depuis la page d'options de l'extension.
>
> Contact : loan.kvl.dev@gmail.com
