# Les Quatre Enclumes — Première personne

Jeu de forgeron en 3D à la première personne (three.js, fichier unique). Tu reprends la forge du village face à trois forgerons rivaux, Gérard, Marthe et Odon, qui récoltent les mêmes ressources et se disputent les mêmes clients. Objectif : être le meilleur forgeron du village au jour 50.

## Lancer le jeu
Aucune installation : ouvre `index.html` dans un navigateur, ou sers le dossier :
```
cd quatre-enclumes && python3 -m http.server 8000   # puis http://localhost:8000
```
La progression est sauvegardée dans le navigateur (localStorage).

## Contrôles
- **ZQSD / WASD** : marcher · **Maj** : courir · **souris** : regarder
- **Clic / F** : frapper · **clic droit / R** : parer · **E** : agir
- **I** : sac · **Échap** : menu
- Mobile : joystick à gauche, glisser à droite pour regarder, boutons ⚒ / ✋ / 🛡

## Boucle de jeu
- Ramasse du bois mort, forge une hache, abats les arbres, casse la pierre, extrais le minerai.
- À l'enclume, tu frappes toi-même le métal (mini-jeu de timing), du bois jusqu'à l'orichalque.
- Accroche tes pièces aux râteliers et marchande avec les clients.
- Équipement et arène de combat par vagues.

## Nouveautés
- **L'étang du Saule** (au sud du village) : face à l'eau, **E** pour lancer, clic quand le bouchon plonge, puis **maintiens** le clic (ou Espace, ou ⚒) pour garder le poisson dans la zone verte. 12 espèces, du gardon au **Vieux Barbu** légendaire, selon l'heure, la météo et ta canne. Records de taille, coffres engloutis, vieilles bottes. Le ponton rachète ta pêche et améliore ta canne (frêne, acier, mithril).
- **Un chien compagnon** : un chien errant affamé rôde près de la forge. Donne-lui un poisson, choisis son nom, et il te suit partout. Caresse-le avec **E**. De temps en temps, il déterre des trésors, et il poursuit les voleurs pour récupérer ce qu'ils ont pris.
- **Le Carnet** (menu ☰ → Carnet) : la collection des poissons et des pièces forgées de ta main. Compléter les 12 pièces d'un matériau rapporte une récompense.
- 8 nouveaux succès.
