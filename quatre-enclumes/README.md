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
