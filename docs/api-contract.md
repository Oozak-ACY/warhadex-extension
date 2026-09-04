# Ce que Warhadex consomme de votre API

Ce document decrit les routes et les champs que l'extension utilise reellement.
Il ne specifie plus une API a implementer : il documente l'integration avec
l'API existante, telle qu'elle a ete verifiee en direct.

L'adresse de base se regle dans les options de l'extension, sans suffixe de
version. En developpement c'est typiquement `http://localhost:8000`.

## Routes utilisees

L'extension n'appelle que quatre routes.

| Route | Quand | Pourquoi |
|---|---|---|
| `GET /search?q=&type=datasheet&limit=5` | a chaque resolution | seule route qui porte un `score` |
| `GET /datasheets?q=&limit=5` | uniquement avant d'afficher un selecteur | seule route qui porte la faction |
| `GET /datasheets/{id}` | quand une fiche est retenue | l'agregat complet en un appel |
| `GET /abilities?limit=200` | une fois, puis cache 30 jours | resout les aptitudes servies vides |

Les autres routes de l'API — stratagemes, enhancements, detachements,
leadership, sources, factions — ne sont pas appelees. Le mapper les ignore
silencieusement, elles restent disponibles pour un ajout ulterieur.

## Resolution d'un nom

L'extension extrait le titre du produit de la page marchande, le normalise
(minuscules, sans accents, sans bruit commercial) et interroge `/search`.

Les scores de l'API sont sur 100 ; le client les ramene sur 1.

**Repli par troncature.** Un titre marchand encadre souvent le nom de l'unite
par la gamme ou la faction, et l'API n'a pas de recherche approchante. Les
marchands ne s'accordent pas sur le cote : warhammer.com et Philibert prefixent,
Wayland suffixe. L'extension retente donc en retirant des mots **des deux
bouts**, jusqu'a trois de chaque cote, et **retient la meilleure tentative
plutot que la premiere qui repond** :

```
adeptus custodes custodian guard -> aucun resultat
custodes custodian guard         -> Custodian Guard (77)
custodian guard                  -> Custodian Guard (100)   <- retenue

weirdboy orks                    -> Weirdboy (76)
orks                             -> bruit (40)
weirdboy                         -> Weirdboy (100)          <- retenue
```

La recherche s'arrete des qu'un score atteint 100, ce qui la ramene le plus
souvent a deux ou trois appels. Au pire, sur une page sans personnage, elle en
fait sept, et le resultat vide est mis en cache vingt-quatre heures.

**Regle de certitude.** Une correspondance est affichee directement si son score
depasse 0.8 et qu'elle bat strictement la suivante. Sinon l'extension propose un
selecteur.

Le critere n'est volontairement pas l'unicite : l'API renvoie tout ce qui
depasse un seuil bas, si bien que `intercessor squad` sort a 100 avec deux
trainards a 40. Exiger l'unicite ferait apparaitre un selecteur sur presque
chaque page. L'egalite en tete, elle, reste ambigue : deux `Terminator Squad`
a 100 ne se tranchent pas automatiquement.

**Enrichissement.** `/search` ne renvoie pas la faction, ce qui rendrait deux
homonymes indistinguables dans le selecteur. Quand un selecteur va s'afficher,
et seulement dans ce cas, l'extension fait un appel a `/datasheets?q=` et joint
la faction par `id`. Cet appel est du confort : s'il echoue, le selecteur
s'affiche sans faction.

## Champs lus dans l'agregat

`GET /datasheets/{id}` renvoie beaucoup plus que ce que le panneau affiche.
Voici la correspondance exacte.

| Champ de l'API | Usage dans le panneau |
|---|---|
| `id`, `name` | identite, obligatoires |
| `faction.name` | sous-titre |
| `role` | sous-titre |
| `models[]` | une ligne de profil par entree : `M`, `T`, `Sv`, `W`, `Ld`, `OC` |
| `models[].name` | affiche seulement si l'unite porte plusieurs profils |
| `models[].inv_sv` | sauvegarde invulnerable, `-` signifie aucune |
| `wargear[]` | tableaux d'armes : `A`, `BS_WS`, `S`, `AP`, `D`, `range`, `type` |
| `wargear[].description` | mots cles de l'arme, decoupes sur les virgules |
| `abilities[]` | aptitudes, voir ci-dessous |
| `keywords.faction` + `keywords.other` | mots cles, aplatis et dedoublonnes |
| `costs[]` | paliers de points, le nombre de figurines est extrait du libelle |
| `legend` | onglet Histoire |
| `source.name` + `link` | attribution en pied de panneau |

Les valeurs numeriques nues sont completees a l'affichage : `BS_WS` `2` devient
`2+`, `inv_sv` `4` devient `4+`, une portee `18` devient `18"`.

### Aptitudes servies vides

Sur une datasheet, seules les aptitudes de type `Datasheet` arrivent avec leur
nom et leur texte. Les types `Core` et `Faction` arrivent avec un `name` vide,
une `description` vide et un `ability_id` a resoudre. Ni `expand=abilities` ni
`expand=all` ne les inlinent.

L'extension recupere donc `/abilities?limit=200` une fois — 70 entrees, environ
220 Ko — et resout localement. Le referentiel est cache 30 jours.

Si ce referentiel est injoignable, la fiche reste servie : les aptitudes non
resolues affichent leur type sans leur texte, et la fiche n'est mise en cache
que 24 heures pour qu'elle se repare d'elle-meme au prochain passage.

### Le champ `html` n'est jamais lu

Les descriptions arrivent en `text` et en `html`, le `html` contenant des
balises de mise en forme des mots cles. **L'extension ne lit que `text`.**
Injecter le `html` exigerait `innerHTML`, ce que l'extension s'interdit :
tout ce qui vient de l'API est traite comme non fiable.

Pour la meme raison, une URL de livre ou de source n'est transformee en lien
que si elle commence par `http://` ou `https://`. Toute autre valeur est
affichee en texte brut.

## Erreurs

| Reponse | Etat affiche |
|---|---|
| adresse absente ou malformee | « Renseignez l'adresse de votre API » |
| reseau injoignable | « Votre API est injoignable » |
| `404` | « Aucun personnage reconnu sur cette page » |
| `429` | message d'erreur generique |
| `5xx` ou corps illisible | message d'erreur generique |

Un `429` n'a volontairement pas d'etat dedie : l'API est celle de
l'utilisateur, le cas est rare, et l'en-tete `Retry-After` n'est pas affiche.

## Authentification

Facultative. Si une cle est renseignee dans les options, elle est envoyee en
`Authorization: Bearer <cle>`. Elle est stockee dans `storage.local`, jamais
synchronisee, et n'est jamais transmise a un content script ni a une page.

## Mise en cache

| Donnee | Duree |
|---|---|
| resolution positive | reglable, 7 jours par defaut |
| resolution vide | 24 heures |
| fiche | reglable, 7 jours par defaut |
| fiche degradee (referentiel absent) | 24 heures |
| referentiel d'aptitudes | 30 jours |

Le cache vit dans `storage.local` sous le prefixe `cache:`. Le vidage depuis la
page d'options ne supprime que les cles portant ce prefixe.
