# Le Squiggle du Vivant •°

**Effleurer le vivant. Laisser une forme émerger.**

Un espace partagé entre patient et psychologue : une surface déjà habitée par des milliers de micrograins, comme une nuée d’étourneaux. Chaque grain reste un point distinct. Les formes projectives apparaissent dans les courants, les densités et les vides créés par la rencontre avec le geste.

L’inspiration est celle d’un dialogue avec une matière vivante, comme les signes mouvants de *Premier Contact*. L’application ne reconnaît pas de langage et ne produit pas de réponse sémantique : sa réponse est le mouvement collectif de la matière.

## Toucher la surface

- **Glisser** au doigt, au stylet ou à la souris : écarter les grains et les entraîner dans un sillage.
- **Tapoter** : transmettre une couleur aux grains au contact et déclencher une onde de dispersion qui se propage puis s’atténue.
- **Rester au même endroit** : après un court maintien, attirer les grains et condenser la couleur. La pression du stylet module la portée et la transmission du pigment.
- **Retirer le doigt** : laisser la nuée poursuivre son organisation. Le geste ne crée pas de grains supplémentaires.
- Passer de **Patient** à **Psychologue** pour répondre avec sa propre couleur ; choisir **Observer** pour suspendre les contacts et regarder la matière évoluer.
- Choisir une harmonie — **Nébuleuse**, **Terres vivantes**, **Marées** — puis l’un de ses six pigments. Chaque rôle garde sa sélection.
- Activer **Miroir** pour toucher la surface des deux côtés. Les grains évoluent ensuite librement.
- Ajuster **Mémoire** (attachement aux empreintes du geste), **Sauvagerie** (mobilité), **Pigment** (présence visuelle des points) et **Échanges** (transmission locale des couleurs et diffusion du milieu).
- Mettre en **Pause**, **Enregistrer** une image PNG ou commencer une **Nouvelle œuvre**, qui renouvelle la population de la surface.

Aucun dessin n’est interprété automatiquement. Aucune IA, aucun suivi d’audience, aucun service externe. L’œuvre reste en mémoire dans le navigateur ; recharger ou fermer la page l’efface. **Enregistrer** conserve une image sur l’appareil.

## Développer

Node.js 20 ou plus récent. Aucune dépendance à installer.

```sh
npm run dev
```

Le serveur écoute sur le port 5173. La variable `PORT` ou l’argument `--port` permettent d’en choisir un autre.

```sh
npm run check
npm test
npm run build
npm run preview
```

`dist/` contient l’application statique complète. `vercel.json` configure la construction et ce dossier de sortie ; aucun secret requis. Tout hébergeur statique peut aussi servir `dist/`.

## Organisation de la nuée

Il s’agit d’une analogie artistique inspirée de l’organisation du vivant, pas d’une simulation biologique validée.

- **Une population préexistante** : de 2 200 à 6 500 micrograins selon la surface à l’ouverture. Une propulsion individuelle entretient le mouvement, même sans geste.
- **Interactions locales** : alignement des vitesses, adhésion selon l’affinité chromatique et répulsion à courte distance. Aucun vent global ne dicte les trajectoires.
- **Milieu actif** : les contacts ensemencent un milieu de réaction-diffusion Gray–Scott. L’activation consomme une ressource qui se renouvelle et diffuse ; les gradients orientent les grains.
- **Empreinte du contact** : les mouvements, les ondes et l’attraction d’un contact maintenu déplacent les grains existants. Leur couleur se transmet au contact, puis lentement entre voisins. Les points éloignés gardent leur couleur.
- **Mémoire et condensation** : les zones denses ralentissent, les positions de référence se déplacent au contact et les nuées gardent temporairement l’empreinte du geste. Les formes restent composées de points, sans lavis, flou ni contours dessinés par-dessus.

La simulation fonctionne à pas fixes de 30 Hz avec voisinage spatial et grille plafonnée à 160 × 120 cellules. Les positions et le milieu sont conservés au redimensionnement. La pause suspend le mouvement, les échanges et les ondes ; « Nouvelle œuvre » renouvelle les grains et réinitialise le milieu.

## Sources

- `index.html`, `src/style.css` : interface française adaptée aux petits écrans.
- `src/main.js` : contacts, rendu des points, palettes et export PNG.
- `src/living.mjs` : milieu, nuée, interactions locales et forces de contact.
- `tests/living.test.mjs` : propagation, ressources, affinités, couleurs, stabilité, population initiale, gestes et ondes.
- `scripts/` : serveur et construction avec les modules natifs de Node.js.
