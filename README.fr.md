# Éditeur de plantes Flora

[English](README.md) · [Deutsch](README.de.md) · [Español](README.es.md) · **Français**

Une application web autonome pour créer des plantes pour [Flora](https://github.com/jaseknighter/flora) sur le monome norns en les dessinant.
Tu dessines la forme et l'application écrit le système L : axiome, règles, étapes de croissance et mélodie.
Elle affiche un aperçu du norns, joue la mélodie et exporte un fichier `.flora` prêt à l'emploi.

C'est du HTML, du CSS et du JavaScript purs : `index.html` plus les dossiers `css/` et `js/`. Il n'y a rien à installer ni à compiler, et l'application fonctionne hors ligne.

## Démarrage rapide

1. Ouvre `index.html` dans un navigateur récent (Chrome, Edge, Firefox ou Safari), par exemple par un double-clic.
2. Avec **✏️ Dessiner**, trace une ligne depuis le point de départ rouge. Elle s'aligne sur les directions de l'angle choisi.
3. Choisis **Symétrie** (p. ex. 6 fois) et **Miroir** pour construire un flocon de neige à partir d'une seule branche.
4. Appuie sur **▶ Lecture** pour entendre la mélodie. Le curseur **Afficher jusqu'à la génération** montre la croissance de la plante.
5. Clique sur **Enregistrer (.flora)** et copie le fichier sur le norns (voir [Utiliser la plante sur le norns](#utiliser-la-plante-sur-le-norns)).

Le menu 🌐 en haut à droite permet de passer de l'anglais à l'allemand, à l'espagnol ou au français.

## Publier sur le web

L'application est une page statique avec `index.html` comme point d'entrée. N'importe quel serveur web ou hébergeur statique peut la servir,
p. ex. GitHub Pages, Netlify ou ton propre serveur. Mets en ligne `index.html` avec les dossiers `css/` et `js/` ; les fichiers README sont facultatifs.
Il n'y a pas de code côté serveur, et l'application ne charge rien depuis d'autres serveurs.

- **HTTPS** est recommandé : l'application y copie via l'interface presse-papiers du navigateur. En HTTP simple, elle utilise une méthode de copie plus ancienne ; tout le reste fonctionne de la même façon.
- Ce que l'application mémorise reste dans le navigateur de chaque visiteur, séparément pour chaque adresse web.

## Structure du projet

| Chemin | Contenu |
|---|---|
| `index.html` | Structure de la page, point d'entrée |
| `css/style.css` | Styles (thème sombre, mise en page) |
| `js/i18n.js` | Traductions (fr, en, de, es) et `t()` |
| `js/flora-core.js` | Simulation de Flora (système L, tortue, hauteur), format `.flora` et compilateur du dessin vers le code, sans code d'interface |
| `js/examples.js` | Les dix flocons de neige intégrés |
| `js/app.js` | Interface : état, éditeur, aperçu, son, fichiers et export |

Les scripts sont chargés comme des scripts classiques (pas des modules ES) dans cet ordre, si bien que l'application fonctionne aussi quand on ouvre `index.html` directement depuis le disque.

## Fonctionnalités

### Dessin
- **Grille :** angles de 30°, 45°, 60° et 90°. Les lignes s'alignent sur les directions autorisées et sont découpées en pas de la tortue.
- **Symétrie :** de 2 à 12 fois, selon l'angle.
- **Miroir :** ajoute chaque nouvelle ligne reflétée sur l'axe vertical.
- **Types de ligne :**
  - ♪ **Note** (`F`) : dessine et joue une note.
  - — **Ligne** (`G`) : dessine avec un silence.
  - ┄ **Saut** (`f`) : se déplace de façon invisible, p. ex. du centre vers un anneau.
- **Outils :** Dessiner, Sélectionner, Appliquer (type et génération), Effacer. Annuler/rétablir avec Ctrl+Z / Ctrl+Y.
- **Navigation :** la molette zoome, le bouton droit de la souris déplace la vue.

### Croissance
- **Générations :** chaque ligne a une génération, reconnaissable à sa couleur. La génération 0 est présente tout de suite, les suivantes poussent l'une après l'autre.
- **Règles :** l'application les génère automatiquement. Les parties ultérieures se cachent derrière des lettres auxiliaires qui avancent d'une étape par génération.
- **Curseur :** « Afficher jusqu'à la génération » montre chaque étape dans l'éditeur, dans l'aperçu et dans la mélodie.

### Mélodie
- **Hauteurs :** chaque ligne de note affiche le degré de la gamme (1–24) que Flora y jouerait.
- **Hauteur fixe :** sélectionne une ligne de note avec **↖ Sélectionner** et règle une **hauteur fixe**. Le code reçoit alors des symboles qui ne changent pas la forme (`[]`, `+-`, `|---`) et règlent exactement ce degré.
- **Les copies symétriques** sonnent toujours comme la branche dessinée.
- **Mêmes notes :** avec cette option, les reflets jouent aussi les mêmes notes que leur original.
- **Lecture** dans le navigateur, avec gamme, note fondamentale, *note scalar* de Flora et durée de note au choix. La note jouée s'allume dans le dessin et dans l'aperçu.

### Code
- **Code en direct :** l'axiome, les règles, l'angle, la longueur de pas, le point de départ et les générations s'affichent à côté du dessin et se mettent à jour en direct.
- **Modification à la main :** tu peux modifier le code toi-même. Le dessin n'est alors plus lié, et l'application le signale.
- **Construire le dessin depuis le code :** transforme les lignes de n'importe quel code (p. ex. un exemple) en dessin.
- **Avertissements :** un tableau montre, pour chaque génération, les caractères, les notes et les silences. L'application avertit pour les phrases de plus de 300 caractères, les notes hors de la gamme et les règles non valides.

### Export
- **Fichier `.flora` :** pour la pépinière (*nursery*) de Flora. Le dessin est stocké dans le fichier sous forme de commentaire Lua, si bien qu'il est restauré exactement au chargement. Flora ignore ce commentaire.
- **Commande maiden :** crée le fichier directement sur le norns.
- **Entrée de catalogue :** pour `lib/gardens/garden_catalog_default.lua`.
- **Exemples :** dix flocons de neige sont intégrés, disponibles via **Charger un exemple…**.

## Utiliser la plante sur le norns

1. Copie le fichier `.flora` dans `dust/data/flora/nursery/` sur le norns.
   - Windows : `\\norns.local\dust` dans l'Explorateur (utilisateur `we`).
   - macOS : Finder → Aller → Se connecter au serveur → `smb://norns.local/dust`.
   - Ou colle la **commande maiden** dans la REPL de maiden. Elle crée le fichier pour toi.
2. Dans Flora : **K1 → PARAMETERS → EDIT → GARDENING → ADD PLANT TO GARDEN**, puis choisis le fichier.
3. Sur la page des plantes, maintiens **K1** et tourne **E2** pour trouver la plante. **K2 / K3** parcourent ses générations.

## Comment l'application imite Flora

L'aperçu et la mélodie suivent le code de Flora lui-même (`lib/l_system.lua`, `lib/turtle.lua`, `lib/plant_sounds.lua`) :

- **Règles :** lettres uniques. Chaque génération est coupée à 300 caractères (`MAX_SENTENCE_LENGTH`).
- **Symboles de la tortue :** `F` dessine et joue une note, `G` dessine avec un silence, `f` se déplace sans dessiner, `+`/`-` tournent de l'angle, `|` tourne de 180°, `[`/`]` mémorisent et restaurent position et direction.
- **Hauteur :**
  - `+` et `-` changent la hauteur de `ceil(note scalar × angle en radians)` degrés. Avec le *note scalar* par défaut (3), cela donne +4/−3 à 60° et +2/−1 à 30°.
  - `]` remet la hauteur au degré 12 sur 24, car dans Flora `[` ne mémorise aucune hauteur.
- **Affichage :** Flora affiche la plante 1 décalée de 32 px vers la gauche. L'aperçu fait de même et montre aussi la plante 2 atténuée.

## Limites

- **Son :** le son du navigateur n'est qu'une approximation du moteur de Flora.
- **Numéros de gamme :** on suppose qu'ils suivent l'ordre de `MusicUtil` sur le norns (5 = dorienne).
- **Les lignes qui disparaissent pendant la croissance**, p. ex. une pointe qui avance vers l'extérieur, ne peuvent pas être représentées dans un dessin. Un code importé de ce type ne garde que sa forme finale.
- **Limite de caractères :** les grands dessins, une symétrie élevée et de nombreuses hauteurs fixes coûtent des caractères. Surveille la limite de 300 caractères dans le tableau des générations.
- **Sauvegarde dans le navigateur :** l'application garde ton travail en mémoire dans le navigateur, mais seulement si la page est ouverte normalement (pas dans une fenêtre d'aperçu intégrée). Pour tout ce que tu veux garder, enregistre un fichier `.flora`.

## Autotest

Ouvre la console du navigateur et lance `floraSelfTest()`. Il transforme chacun des dix flocons intégrés en dessin, régénère le code à partir de ce dessin et vérifie que la forme finale est identique.
