# Le Squiggle du Vivant •°

**Ce que nous traçons prend vie.**

Un espace de dessin partagé entre patient et psychologue. Les tracés apparaissent immédiatement, puis se transforment progressivement en particules d’encre. Elles évoluent par cohésion, alignement, séparation et mémoire du geste.

## Utiliser

- Dessiner au doigt, au stylet ou à la souris.
- Passer de **Patient** à **Psychologue** pour changer de palette et répondre au dessin.
- Choisir **Observer** pour suspendre les gestes et regarder les formes évoluer. Choisir un rôle pour reprendre le dessin.
- Ajuster **Mémoire**, **Sauvagerie** et **Encre**.
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
- `src/main.js` : dessin, simulation 2D, modes et export PNG.
- `scripts/` : serveur local et construction, avec les modules natifs de Node.js.

Le rendu utilise Canvas 2D, avec un plafond de 950 particules et une simulation à 30 pas par seconde. Les anciennes empreintes s’estompent pour limiter la saturation de l’image.
