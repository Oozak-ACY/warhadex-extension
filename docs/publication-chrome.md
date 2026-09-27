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

**Description courte** (132 caracteres maximum) : lue par le magasin dans
`_locales/<langue>/messages.json` (cle `extDescription`), il n'y a rien a
saisir. Anglais :

> Shows the game stats, weapons and abilities of a miniature right on the
> product pages of tabletop miniature stores.

Francais :

> Affiche les caractéristiques, armes et aptitudes de jeu d'une figurine sur
> les pages produit des boutiques de jeux de figurines.

**Description** : identique a la fiche Firefox, en anglais et en francais, voir
[publication-firefox.md](publication-firefox.md).

**Categorie** : Divertissement. **Langues** : anglais (par defaut, deduit de
`default_locale`) et francais. Dans l'onglet Fiche, choisir la langue dans le
selecteur en haut pour saisir la description et les captures de chacune.

**Images** :

- icone 128 x 128 : `design/logo/export/warhadex-128.png` ;
- captures 1280 x 800 : les quatre de `design/captures/`, une au minimum, cinq
  au maximum ;
- petite image promotionnelle 440 x 280 : facultative, mais requise pour
  apparaitre dans certaines mises en avant du magasin.

## Onglet Confidentialite

**Usage unique** :

> Show the game rules and stats of the miniature displayed on a tabletop
> miniature store's product page.

Ces champs sont lus par les relecteurs du magasin : ils sont rediges en
anglais.

**Justification de `storage`** :

> Stores the user's settings locally (cache duration, launcher button display)
> and a cache of datasheets already viewed, to avoid repeating the same
> requests.

**Justification de l'autorisation d'acces a l'hote** : un seul champ couvre
tous les domaines, ceux de `permissions` comme ceux de `content_scripts`, en
1000 caracteres maximum.

> The extension only accesses five domains, all required by its single purpose.
>
> The four miniature stores (warhammer.com, elementgames.co.uk,
> waylandgames.co.uk, philibertnet.com): the content script reads the title of
> the displayed product to identify the miniature, and inserts into the page the
> panel showing its game rules. Without this access, the extension can neither
> recognise the character nor show its panel. It never runs on any other site.
>
> warhadex-api.orion-sphere.fr: the only source of the rules shown. The
> extension bundles no game database; the service worker sends the product name
> to this API to fetch the matching datasheet. No personal data, page address or
> browsing history is sent.

**Code distant** : repondre **non**. Tout le code est dans l'archive ; seules
des donnees JSON sont recuperees.

**Usage des donnees** : cocher **Contenu de sites web**, et rien d'autre. Ni
informations personnelles, ni historique de navigation, ni activite, ni
localisation.

**Certifications** : les trois cases peuvent etre cochees. Les donnees ne sont
ni vendues, ni transferees a des tiers, ni utilisees hors de l'usage unique, ni
employees pour evaluer une solvabilite ou accorder un pret.

## Politique de confidentialite en ligne

La page source est `site/confidentialite.html` (anglais puis francais). Elle est
publiee par GitHub Pages depuis le depot `oozak-acy/warhadex-site` a l'adresse :

https://oozak-acy.github.io/warhadex-site/confidentialite.html

C'est cette adresse qui est indiquee sur AMO et dans l'onglet Confidentialite du
Chrome Web Store. Apres toute modification de `site/confidentialite.html`,
copier le fichier dans `warhadex-site` et pousser sur `main` : l'adresse ne
change pas. Son contenu doit rester identique a la politique donnee a Mozilla.
