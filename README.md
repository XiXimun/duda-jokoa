# duda2

Appli web responsive pour s'entraîner à la conjugaison des auxiliaires
basques (izan/ukan) via des phrases à trou, avec filtres optionnels par
Mota / Modua / Aldia et un score.

Voir [SPEC.md](SPEC.md) pour le contexte complet, le modèle de données et
les choix de conception.

## Lancer l'app

Fichiers statiques, pas de build. Comme `app.js` charge les données via
`fetch()`, il faut servir le dossier par HTTP (ouvrir `index.html`
directement avec `file://` ne fonctionne pas dans la plupart des
navigateurs) :

```sh
cd duda2
python3 -m http.server 8000
```

puis ouvrir http://localhost:8000/.

## Structure

```
duda2/
  index.html          écran de sélection / jeu / résultat
  app.js               logique : chargement des données, tirage, score
  styles.css           mobile-first, responsive
  data/
    conjugations.json  table de conjugaison générée (voir scripts/)
    templates.txt      banque de phrases à trou, à enrichir à la main
  scripts/
    raw_table.txt       transcription du tableau de conjugaison source
    build_data.py        génère conjugations.json depuis raw_table.txt
```

## Ajouter des phrases

Éditer `data/templates.txt` et ajouter une ligne par phrase, en suivant le
format documenté en haut du fichier. Aucune étape de build n'est nécessaire :
`app.js` relit le fichier à chaque chargement de la page.

## Régénérer la table de conjugaison

Si une erreur est repérée dans `data/conjugations.json` (forme incorrecte,
etc.), corriger `scripts/raw_table.txt` puis relancer :

```sh
python3 scripts/build_data.py
```

Le script vérifie automatiquement, pour chaque ligne, que le nombre de
formes lues correspond au nombre de combinaisons de personnes attendu (les
combinaisons bloquées grammaticalement, ex. *ni → niri*, sont gérées
automatiquement — voir SPEC.md pour le détail de la règle).
