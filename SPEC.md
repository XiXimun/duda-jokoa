# duda2 — app d'entraînement à la conjugaison basque (NOR / NORI / NORK)

## Contexte

L'utilisateur veut une appli web responsive pour s'entraîner à la conjugaison
des auxiliaires basques (izan/ukan). **L'exercice n'est pas une récitation
abstraite** (pas de simple "Nork: nik · Nor: hura → ???") **mais une phrase à
trou avec un vrai verbe lexical**, par exemple :

> NORK bi sagar jaten ADITZA  → Modua: indikatiboa, Aldia: orain, Mota: nor-nork, Nor: haiek

`NORK` est un jeton qui sera remplacé au hasard par un pronom ergatif valide
(nik, hik, hark, guk, zuk, zuek, haiek) ; `ADITZA` est le trou que le joueur
doit compléter, dont la bonne réponse est lue dans la table de conjugaison
générée (`conjugations.json`) pour la combinaison (Modua, Aldia, Mota,
Nor=haiek, Nork=<pronom tiré>). Ici, par ex. si `NORK`→hik, la phrase devient
"Hik bi sagar jaten ___" et la réponse attendue est "dituk".

L'utilisateur fournira sa propre banque de phrases de ce type (au format
texte décrit ci-dessous), qui s'enrichira dans le temps. Le sélecteur
Modua/Aldia/Mota reste présent comme **filtre optionnel** ("tous" par défaut)
: la phrase à compléter ET le pronom du rôle libre sont tirés au hasard parmi
ce qui correspond au filtre actif. Un système de points compte les bonnes
réponses.

Les trois axes de la table de conjugaison sous-jacente (utilisée pour le
lookup d'ADITZA) :

- **Mota** (type d'accord) : Nor, Nor-Nori, Nor-Nork, Nor(sg)-Nori-Nork, Nor(pl)-Nori-Nork
  — la forme à triple accord est dédoublée selon que l'objet (Nor) est singulier
  ou pluriel (ex. *dizut* vs *dizkizut*), distinction confirmée par le gabarit
  fourni par l'utilisateur.
- **Modua** (7 valeurs) : Indikatiboa, Baldintza, Ondorioa, Ahalera/Potentziala,
  Hipotetikoa, Subjuntiboa, Agintera.
- **Aldia** (Orain/Lehen) : applicable seulement pour Indikatiboa, Ondorioa,
  Ahalera/Potentziala, Subjuntiboa — pas pour Baldintza, Hipotetikoa, Agintera
  (le PDF source présente Ondorioa-Orain/Ondorioa-Lehen comme deux sections
  séparées, mais la donnée sera normalisée en `ondorioa: {orain, lehen}` pour
  rester cohérente avec les autres modua à aldia).

L'utilisateur connaît bien Python mais est ouvert à autre chose ; l'app n'a pas
besoin de backend (données statiques, scoring côté client), donc on privilégie
la stack la plus simple pour un résultat responsive : **HTML/CSS/JS vanilla,
sans build, sans serveur**. Déployable comme simples fichiers statiques.

## Périmètre v1 (hypothèses à valider/corriger après lecture du plan)

- Formes **standard** uniquement (registre zuka/orokorra). Les variantes
  allocutives/hitano (marquées en rouge avec renvois ¹²³... dans le tableau,
  liées au genre de l'interlocuteur "hi") sont **exclues de la v1** — trop
  spécifiques, ajoutables plus tard comme option.
- Les 5 *mota* et les 8 sections *modua/aldia* sont tous inclus dès la v1.
- **Source des données** : PDF fourni par l'utilisateur (texte structuré,
  extrait de http://euskaljakintzaaditza.weebly.com/), couvrant l'intégralité
  des 8 sections × 5 mota avec les formes standards + des variantes hitano
  (registre familier, marquées par des lignes de continuation indentées sans
  étiquette de personne). **Seules les formes standards (première ligne de
  chaque cellule) sont reprises en v1** ; les variantes hitano sont ignorées.
- **Logique de blocage des cellules vérifiée** : dans toutes les tables à deux
  rôles (Nor-Nori, Nor-Nork, Nor(sg/pl)-Nori-Nork), une combinaison de
  personnes est absente du tableau exactement quand :
  - les deux rôles portent la même personne, ou
  - les deux personnes appartiennent au même groupe de recoupement référentiel :
    `{ni, gu}` (gu inclut ni) ou `{hi, zu, zuek}` (variantes du "tu/vous")
  - la 3e personne (`hura`, `haiek`) ne bloque jamais.
  Cette règle a été vérifiée manuellement sur des dizaines de lignes dans
  plusieurs modua distincts (Indikatiboa, Subjuntiboa, Agintera) et tient
  systématiquement. Pour Agintera, certaines lignes entières sont absentes
  du tableau source (ex. "nik"/"guk" ne peuvent pas être l'destinataire d'un
  ordre) — ce sont des lignes manquantes dans la source elle-même, pas une
  règle à dériver.
- Pour Nor(sg)-Nori-Nork et Nor(pl)-Nori-Nork, le rôle *Nor* est implicite et
  fixé à la 3e personne (singulier ou pluriel respectivement) — ce n'est pas
  un axe sélectionnable séparé dans ces deux mota.

## Structure du projet

Nouveau dossier `~/git/duda2/`, avec `git init` :

```
duda2/
  index.html
  styles.css
  app.js
  data/
    conjugations.json
    templates.txt
```

## Génération des données (`data/conjugations.json`)

Plutôt que de retaper ~1000+ formes à la main (risque d'erreur élevé), les
données sont produites par un petit script générateur à partir d'une
transcription littérale du PDF :

1. `scripts/raw_forms.py` (ou `.js`) : transcription fidèle des lignes
   "standard" du PDF (une ligne = étiquette de personne + liste de formes
   dans l'ordre des colonnes présentes), regroupées par mota puis par
   modua/aldia. C'est une copie directe du texte source, pas une
   réinterprétation.
2. `scripts/build_data.py` : applique la règle de blocage vérifiée
   (`{ni,gu}` / `{hi,zu,zuek}` / 3e personne jamais bloquée) pour ré-associer
   chaque valeur de chaque ligne à la bonne personne de colonne (puisque les
   cellules bloquées sont simplement absentes de la ligne source), puis
   écrit `data/conjugations.json` au format :

```json
{
  "nor-nork": {
    "indikatiboa": {
      "orain": [
        { "nork": "nik", "nor": "hura", "form": "dut" },
        { "nork": "hik", "nor": "hura", "form": "duk" }
      ],
      "lehen": [ ... ]
    },
    "baldintza": [ ... ],
    "ondorioa": { "orain": [...], "lehen": [...] },
    "ahalera": { "orain": [...], "lehen": [...] },
    "hipotetikoa": [ ... ],
    "subjuntiboa": { "orain": [...], "lehen": [...] },
    "agintera": [ ... ]
  },
  "nor": { ... },
  "nor-nori": { ... },
  "nor-sg-nori-nork": { ... },
  "nor-pl-nori-nork": { ... }
}
```

Chaque entrée contient seulement les rôles pertinents pour ce *mota* (`nor`
seul ; `nor`+`nori` ; `nor`+`nork` ; ou `nori`+`nork` pour les motas
trivalentes où `nor` est implicite), plus `form`. Le script de génération
reste dans le repo pour pouvoir corriger/regénérer facilement si une erreur
de transcription est repérée plus tard.

## Banque de phrases à trous (`data/templates.txt`)

Fournie et enrichie par l'utilisateur directement, **lue par `app.js` au
chargement (pas d'étape de build)** pour que l'ajout d'une phrase soit
immédiat. Une entrée par ligne, format repris de l'exemple de l'utilisateur :

```
NORK bi sagar jaten ADITZA - Modua: indikatiboa, Aldia: orain, Mota: nor-nork, Nor: haiek
```

Règles de lecture :
- La phrase (avant le ` - `) contient des jetons littéraux parmi
  `NORK`/`NORI`/`NOR` pour le(s) rôle(s) **libres** (remplacés au hasard par
  un pronom valide de ce rôle au moment du tirage), et `ADITZA` pour le trou
  à deviner (jamais affiché, c'est la réponse attendue).
- Les métadonnées (après le ` - `) donnent `Modua`, `Aldia` (omis/vide si non
  applicable à ce modua), `Mota`, et un ou plusieurs rôles **fixés** avec leur
  valeur (ex. `Nor: haiek`). Un rôle pertinent pour la Mota mais absent à la
  fois des jetons de la phrase et des rôles fixés serait une erreur de
  transcription (le parseur le signale).
- Au tirage : choisir une personne valide pour chaque rôle libre (parmi celles
  qui donnent une cellule existante dans `conjugations.json` pour les rôles
  déjà fixés — gère naturellement les blocages référentiels), substituer les
  jetons par le mot-pronom correspondant (capitalisé si en début de phrase),
  chercher `ADITZA` = forme dans `conjugations.json`.

L'unique exemple fourni jusqu'ici servira de cas de test ; l'utilisateur
complétera le fichier progressivement.

## UI / flux

**Écran de sélection (accueil)**
- Filtres optionnels (défaut "Tous/aléatoire") : *Mota* (5 + Tous), *Modua*
  (7 + Tous), *Aldia* (Orain/Lehen/Tous, masqué si le Modua sélectionné n'a
  pas d'aldia)
- Bouton "Hasi" (commencer) — lance une session avec un score à 0

**Écran d'entraînement**
- Tire au hasard une phrase-modèle parmi celles qui correspondent au filtre,
  tire un pronom pour le(s) rôle(s) libre(s), affiche la phrase avec le trou
  (`___`) à la place d'ADITZA
- Champ texte libre + validation (bouton ou touche Entrée)
- Feedback immédiat (correct/incorrect, affiche la bonne forme si erreur),
  +1 point si correct
- Score courant affiché en permanence ; bouton "Suivante" pour tirer une
  nouvelle question (session continue, pas de fin de lot fixe puisque le
  tirage est aléatoire avec remise)

**Arrêt de session**
- Bouton "Terminer" à tout moment → écran récap (score final, nombre de
  questions), avec option de relancer (même filtre ou nouveau filtre)

## Responsive

Mobile-first en CSS pur : layout en colonne unique sur petit écran, sélecteurs
en grille/flex qui passent sur plusieurs colonnes en largeur desktop via
`@media`, cibles tactiles larges, `viewport` meta tag, unités `rem`/`clamp()`.
Pas de framework CSS — feuille de style unique, pas de dépendance.

## Étapes d'implémentation

1. `git init` dans `~/git/duda2/`
2. `scripts/raw_forms.py` : transcription littérale des lignes standards du
   PDF, organisée par mota/modua/aldia
3. `scripts/build_data.py` : applique la règle de blocage pour générer
   `data/conjugations.json`, avec quelques assertions de cohérence (ex.
   compter le nombre de formes attendues par ligne selon les blocages, pour
   détecter une erreur de transcription dès la génération)
4. `data/templates.txt` : transcription du/des exemple(s) fourni(s) par
   l'utilisateur au format défini ci-dessus
5. `index.html` : squelette + écran de sélection + écran de jeu + écran de résultat (un seul fichier, sections togglées en JS)
6. `app.js` :
   - chargement de `conjugations.json` et parsing de `templates.txt`
   - validation au chargement : chaque template référence un Modua/Aldia/Mota
     existant et des rôles fixés cohérents (sinon avertissement console)
   - tirage aléatoire (template + pronom du rôle libre) filtré par la
     sélection courante, substitution des jetons, lookup d'ADITZA, scoring
7. `styles.css` : mobile-first, responsive
8. Test manuel dans le navigateur (`open index.html` ou petit serveur statique
   type `python -m http.server` pour éviter les soucis de fetch() en `file://`)

## Vérification

- Lancer `scripts/build_data.py` et vérifier qu'il ne lève aucune erreur de
  cohérence (compte de formes par ligne)
- Comparer un échantillon de cellules générées (quelques lignes par mota,
  dont au moins une en Agintera) avec le PDF source
- Vérifier que l'exemple "NORK bi sagar jaten ADITZA" produit bien les 7
  variantes attendues (une par pronom NORK, ex. hik→dituk) sans tomber sur une
  combinaison bloquée
- Ouvrir l'app dans le navigateur (desktop + redimensionnement mobile / devtools responsive mode)
- Vérifier que les sections sans Aldia (Baldintza, Hipotetikoa, Agintera)
  n'affichent pas de sélecteur Aldia
- Tester un cycle complet : sélection (ou "Tous") → questions successives avec
  score qui s'incrémente → "Terminer" → récap → rejouer
