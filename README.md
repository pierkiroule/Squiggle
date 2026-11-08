# Le Squiggle du Vivant •°

**Une matière. Une rencontre.**

Une surface d’encre vivante, librement inspirée des formes projectives de Rorschach, des encres à alcool et de la matière de *Premier Contact*. On trace directement dans la matière : le geste dépose du pigment, remet l’encre en mouvement et laisse la rencontre évoluer. Il n’y a ni joueurs, ni tours, ni partie à configurer.

## Rencontrer l’encre

- Tracer au doigt, au stylet ou à la souris. Le geste transmet couleur, humidité et mouvement à la matière existante. La pression du stylet module le dépôt.
- Choisir parmi trois harmonies de cinq pigments ; régler **Geste**, **Souffle** et **Relief**.
- Activer **Miroir** pour déposer le geste des deux côtés ; l’encre évolue ensuite librement.
- **Suspendre** arrête l’évolution spontanée ; le geste peut toujours modifier la matière. **Réveiller** la remet en mouvement. Le réglage système de réduction des animations démarre l’encre suspendue.
- Lorsqu’un état vous touche, **Ça résonne** en conserve une copie indépendante, avec son relief et sa miniature. Jusqu’à 24 états peuvent être retenus.

## Faire naître une métamorphose

Dès deux états, **Animer les résonances** relie les captures dans leur ordre. Le moteur estime un champ de déplacement entre les concentrations d’encre, déforme les coordonnées des deux états et interpole les concentrations pigmentaires. Il ne se limite pas à un fondu entre captures d’écran.

Les transitions durent 2,5, 4,5 ou 7 secondes. La lecture peut être suspendue ou parcourue avec le curseur. Une miniature permet de contempler un état ; la croix le retire. **Revenir à l’encre** retrouve la matière active sans altérer les états sauvegardés.

- **Image PNG** exporte l’état affiché.
- **Exporter l’animation** enregistre le morphing complet en WebM, du début à la fin, dans les navigateurs compatibles avec MediaRecorder et Canvas captureStream. Garder la page ouverte pendant l’export.
- **Nouvelle encre** demande confirmation avant d’effacer la matière et les résonances.

Les états restent en mémoire dans la page : recharger ou fermer l’onglet les efface. Les exports téléchargés permettent de conserver les images ou l’animation. Aucun dessin n’est interprété automatiquement ; aucun compte, aucune IA, aucun service externe.

## Matière et rendu

Le moteur maintient trois champs d’absorption pigmentaire, l’humidité et une vitesse locale sur une grille 280 × 194. Advection, diffusion différente des pigments, gradients de concentration, tension de surface approchée et couplage entre humidité et mobilité produisent l’évolution. Il s’agit d’une analogie artistique des mécanismes physiques du vivant, pas d’une simulation biologique ou d’un solveur de fluides validé.

Le rendu associe absorption optique, transparences, accumulation aux fronts humides, contours capillaires, granulation et éclairage rasant dérivé des gradients. Le relief est un effet de rendu 2D, pas une géométrie 3D. L’encre n’est pas photoréaliste ; sa résolution de simulation est volontairement bornée pour fonctionner sans dépendance ni serveur graphique.

Les résonances conservent les champs numériques, plutôt que de simples images. Le morphing utilise une estimation de flot optique dense régularisée sur la densité : des formes très différentes peuvent se dissoudre ou apparaître pendant la transition ; aucune correspondance sémantique n’est inférée.

## Développer

Node.js 20 ou plus récent, aucune dépendance à installer.

```sh
npm run dev
npm run check
npm test
npm run build
npm run preview
```

Le serveur utilise le port 5173, surchargeable par `PORT` ou `--port`. `dist/` contient l’application statique complète. `vercel.json` configure la construction et le dossier de sortie. Aucun secret requis.

- `src/ink.mjs` : matière, dépôt, évolution, rendu, captures et morphing.
- `src/main.js` : geste, harmonies, résonances, lecteur et exports.
- `tests/ink.test.mjs` : dépôt local, stabilité, indépendance des états, morphing et rendu.
