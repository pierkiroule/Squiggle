# Le Squiggle du Vivant •°

**Ce que nous traçons prend vie.**

Un espace de dessin partagé entre patient et psychologue. Les gestes déposent des pigments de couleur : lavis translucides, grains et sédiments se superposent sur un papier texturé. La matière évolue par cohésion, alignement, séparation et mémoire du geste. Des taches, des silhouettes et des nuages ambigus émergent, se défont et se recomposent ; chacun reste libre d’y voir ses propres formes.

## Utiliser

- Dessiner au doigt, au stylet ou à la souris.
- Passer de **Patient** à **Psychologue** pour changer de palette et répondre au dessin.
- Choisir **Observer** pour suspendre les gestes et regarder les formes évoluer. Choisir un rôle pour reprendre le dessin.
- Choisir une harmonie — **Nébuleuse**, **Terres vivantes** ou **Marées** — puis l’un de ses six pigments. Chaque rôle garde sa propre sélection ; changer de couleur ne recolore pas les pigments déjà déposés.
- Activer **Miroir** pour déposer le geste des deux côtés, comme une tache pliée. Les deux nuées évoluent ensuite librement et la symétrie se transforme.
- Ajuster **Mémoire** (attachement au geste et persistance des empreintes), **Sauvagerie** (mouvement), **Pigment** (densité) et **Diffusion** (étalement des nuées).
- Mettre l’animation en **Pause**, **Enregistrer** une image PNG ou commencer une **Nouvelle œuvre**.

Aucun dessin n’est interprété automatiquement. L’application ne contient ni IA, ni suivi d’audience, ni requête vers un service externe. L’œuvre reste en mémoire dans le navigateur ; recharger ou fermer la page l’efface. Le bouton **Enregistrer** permet de conserver une image sur son appareil.

## Lancer en local

Node.js 20 ou plus récent. Aucune dépendance à installer.

```sh
npm run dev
```

Ouvrir <http://localhost:5173>. Le serveur utilise `PORT` si cette variable est définie.

## Construire

```sh
npm run check
npm test
npm run build
npm run preview
```

Le dossier `dist/` contient l’application statique complète. `npm run preview` la sert en local.

## Déployer sur Vercel

Importer ce dépôt dans Vercel. Le fichier `vercel.json` configure la commande `npm run build` et le dossier de sortie `dist`. Aucun secret ou service supplémentaire n’est requis.

Tout hébergeur de fichiers statiques peut également servir le contenu de `dist/`.

## Sources

- `index.html` : interface en français.
- `src/style.css` : présentation et adaptation aux petits écrans.
- `src/main.js` : dessin, rendu des pigments, modes et export PNG.
- `src/living.mjs` : milieu de réaction-diffusion et interactions locales des pigments.
- `tests/living.test.mjs` : propagation, affinités, échange de couleur, dépôts et redimensionnement.
- `scripts/` : serveur local et construction, avec les modules natifs de Node.js.

Le rendu utilise Canvas 2D, avec un plafond de 950 grains de pigment et une simulation à 30 pas par seconde. Des empreintes de pigment précalculées permettent de composer les lavis et leur granulation sans dépendance externe. Les couches colorées se superposent en mode multiplication ; les anciennes empreintes s’estompent selon le réglage Mémoire pour limiter la saturation de l’image.

## Organisation de la matière

Les formes s’inspirent de mécanismes d’organisation du vivant. Il s’agit d’une analogie artistique, pas d’une simulation biologique validée.

- **Activation et ressources** : le geste ensemence un milieu de réaction-diffusion de type Gray–Scott. Une activation locale consomme une ressource qui se renouvelle et diffuse plus vite ; les concentrations créent des fronts et des motifs.
- **Migration collective** : les pigments suivent les gradients du milieu, s’alignent avec leurs voisins et s’attirent selon leur affinité chromatique. Une répulsion à courte distance ménage des espaces dans les amas. Aucun vent global ne dicte leur trajectoire.
- **Couleurs en contact** : les voisins échangent progressivement leur couleur. Les pigments éloignés conservent leur teinte ; les couleurs de la palette restent intactes.
- **Condensation et dépôt** : les amas denses et les zones pauvres en ressources ralentissent la matière. Les concentrations d’activation dessinent des contours ; les dépôts laissent des filaments orientés par le déplacement. La largeur des lavis dépend de l’activité locale et de la diffusion, plutôt que d’une pulsation décorative.

La simulation est plafonnée à 950 pigments. Le milieu est calculé sur une grille adaptative plafonnée à 160 × 120 cellules ; le cache des empreintes de couleur est borné. La pause suspend le milieu et les pigments, le redimensionnement conserve leurs états, et « Nouvelle œuvre » réinitialise aussi le milieu.
