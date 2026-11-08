# Le Squiggle du Vivant •°

Un cadavre exquis dessiné à plusieurs, avec un invité inattendu.

Les joueurs partagent une feuille sur le même appareil. L’application distribue les tours ; chacun dessine librement, puis passe la main. Entre certains tours, **le vivant** s’invite pendant quatre secondes : les traits se déforment, s’accordent et font pousser quelques ramifications. Le dessin se fige ensuite dans ce nouvel état et le joueur suivant poursuit la rencontre.

À la fin, la partie devient un petit film en **stop motion** : les gestes, les annulations et les métamorphoses peuvent être revus dans l’ordre.

## Jouer

1. Indiquer le nombre de joueurs (1 à 8) et les passages par joueur (2, 3 ou 5).
2. Dessiner au doigt, au stylet ou à la souris. Choisir une couleur, une épaisseur, le crayon ou la gomme. La pression du stylet module le trait.
3. **Annuler** retire le dernier trait du tour en cours. Les marques des tours précédents restent communes.
4. **Passer la main** laisse l’application choisir le prochain joueur. Chaque joueur passe une fois par ronde, dans un ordre mélangé, sans répétition immédiate entre deux rondes si vous êtes plusieurs.
5. Quand le vivant intervient, les outils sont temporairement verrouillés. L’intervention transforme les véritables points des traits : son résultat reste sur la feuille.
6. La partie se termine après le nombre de passages choisi, ou avec **Terminer**.
7. **Rejouer le rêve** lance le film. La pause, la barre de lecture et trois rythmes permettent de le parcourir. **Image PNG** conserve l’instant affiché.

Les premières interventions arrivent après deux ou trois tours, puis après deux à quatre tours. Une partie courte avec au moins deux tours et un dessin reçoit une visite avant le dernier tour. Une feuille vide ne provoque pas d’intervention.

**Nouvelle partie** demande confirmation avant d’effacer le dessin et son film. Aucun enregistrement durable ni envoi vers un service externe : fermer ou recharger la page efface la partie. Le replay est disponible dans l’application ; l’export proposé est une image PNG, pas un fichier vidéo.

## Développer

Node.js 20 ou plus récent. Aucune dépendance à installer.

```sh
npm run dev
npm run check
npm test
npm run build
npm run preview
```

Le serveur utilise le port 5173, surchargeable avec `PORT` ou `--port`. `dist/` contient l’application statique complète. `vercel.json` configure la construction et le dossier de sortie. Aucun secret ni service requis.

## Fonctionnement

- `src/game.mjs` : distribution des tours, interventions, historique et transformation des tracés.
- `src/main.js` : outil de dessin, captures de gestes, animation de quatre secondes, replay et export.
- `tests/game.test.mjs` : règles des tours, visites, transformations, intégrité des captures et conservation de l’historique.

La feuille conserve des coordonnées fixes pour préserver le dessin et le replay lors d’un redimensionnement ; elle est ajustée avec des marges si nécessaire. Le vivant combine élasticité locale, alignement des vitesses, exclusion à courte distance et croissance de ramifications depuis des marques existantes. C’est une analogie artistique, pas un modèle biologique ni une interprétation automatique.

Le film conserve des instantanés vectoriels : pendant les gestes, à la fin des traits et pendant les métamorphoses. Les traits inchangés sont partagés entre les images ; au-delà de 600 instants, les anciennes captures sont espacées pour conserver le début, la fin et la continuité de la partie. Les gestes longs sont échantillonnés. Les onglets masqués suspendent l’animation et la lecture.
