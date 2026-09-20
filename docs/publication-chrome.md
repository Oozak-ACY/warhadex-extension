# Publication sur le Chrome Web Store

Couvre aussi Edge, Brave, Opera et Vivaldi, qui installent depuis ce magasin.
Les textes destines a la boutique sont accentues : ils sont affiches aux
utilisateurs, contrairement au code et a sa documentation.

## A prevoir avant de commencer

- **Compte developpeur** : 5 dollars une fois, par carte, sur
  https://chrome.google.com/webstore/devconsole. Il faut aussi confirmer une
  adresse de contact, qui sera publique sur la fiche.
- **Adresse de politique de confidentialite** : contrairement a Firefox, Chrome
  demande une **URL publique**, pas un texte a coller. Elle doit etre en ligne
  avant la soumission, par exemple sur `orion-sphere.fr`.
- **Archive** : `npm run package:chrome` produit
  `dist/paquets/warhadex-chrome-<version>.zip`. Elle contient la cle d'API et ne
  doit etre deposee que sur le tableau de bord Chrome.

## Soumission

1. Console developpeur, « Nouvel element », deposer l'archive.
2. Remplir l'onglet **Fiche du magasin** avec les textes ci-dessous.
3. Remplir l'onglet **Confidentialite** : usage unique, justification de chaque
   autorisation, declaration d'usage des donnees, adresse de la politique.
4. Choisir la visibilite : **publique**, ou **non repertoriee** pour diffuser par
   lien uniquement.
5. Envoyer pour examen. Le delai va de quelques jours a plus d'une semaine, et
   l'extension demandant l'acces a des sites precis, elle passe en relecture
   humaine.

## Fiche

**Nom** : Warhadex

**Description courte** (132 caracteres maximum, reprise du manifeste) :

> Affiche les caractéristiques, armes et aptitudes Warhammer 40,000 du
> personnage sur les pages produit des boutiques de figurines.

**Description** : identique a la fiche Firefox, voir
[publication-firefox.md](publication-firefox.md).

**Categorie** : Divertissement. **Langue** : francais.

**Images** :

- icone 128 x 128 : `design/logo/export/warhadex-128.png` ;
- captures 1280 x 800 : les quatre de `design/captures/`, une au minimum, cinq
  au maximum ;
- petite image promotionnelle 440 x 280 : facultative, mais requise pour
  apparaitre dans certaines mises en avant du magasin.

## Onglet Confidentialite

**Usage unique** :

> Afficher les règles et caractéristiques de jeu Warhammer 40,000 de la
> figurine présentée sur une page produit de boutique.

**Justification de `storage`** :

> Conserve localement les réglages de l'utilisateur (durée du cache, affichage
> du bouton) et un cache des fiches déjà consultées, afin d'éviter de répéter
> les mêmes requêtes.

**Justification des sites marchands** (`warhammer.com`, `elementgames.co.uk`,
`waylandgames.co.uk`, `philibertnet.com`) :

> L'extension lit le nom du produit affiché sur ces boutiques pour identifier la
> figurine, et y insère le panneau de règles. Elle ne s'active que sur ces
> quatre sites.

**Justification de `warhadex-api.orion-sphere.fr`** :

> Seule source des règles affichées. L'extension n'embarque aucune base de
> données de jeu et interroge cette API pour chaque fiche.

**Code distant** : repondre **non**. Tout le code est dans l'archive ; seules
des donnees JSON sont recuperees.

**Usage des donnees** : cocher **Contenu de sites web**, et rien d'autre. Ni
informations personnelles, ni historique de navigation, ni activite, ni
localisation.

**Certifications** : les trois cases peuvent etre cochees. Les donnees ne sont
ni vendues, ni transferees a des tiers, ni utilisees hors de l'usage unique, ni
employees pour evaluer une solvabilite ou accorder un pret.

## Politique de confidentialite a mettre en ligne

Le texte est le meme que pour Firefox, section « Politique de confidentialite »
de [publication-firefox.md](publication-firefox.md). Il doit etre servi a une
adresse publique et stable, indiquee dans l'onglet Confidentialite.
