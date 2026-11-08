# Ambrevale

Jeu de stratégie original dans le navigateur : **gestion de royaume + tower defense + raids**, sur une île flottante isométrique.

## Lancer le jeu
Aucune installation : ouvrez `index.html`, ou servez le dossier :
```
cd ambrevale && python3 -m http.server 8000   # puis http://localhost:8000
```
La progression est sauvegardée automatiquement dans le navigateur (localStorage).
Mode test : `index.html?dev=60` accélère le temps ×60.

## Boucle de jeu
- **Gestion / farming** : mines d'or et puits de sève produisent en temps réel, même jeu fermé (réserve interne de 6 h à récolter). Coffres et réservoirs augmentent le stockage.
- **Construction** : chaque construction/amélioration occupe un bâtisseur pendant un temps réel (10 s → 30 h). La Citadelle débloque bâtiments et niveaux.
- **Défense (tower defense)** : sonnez une *corne de guerre* (3 max, 1 toutes les 2 h) pour un assaut nocturne en 3 vagues. Tours d'archers, canons (zone), tours arcaniques (chaîne, ignore l'armure), obélisques de givre (ralentissement), murailles pour créer des couloirs. Sorts Foudre et Gel pendant le combat.
- **Attaque** : entraînez 7 types de troupes et pillez les camps d'expédition (1 à 3 étoiles).
- **Rétention** : coffre quotidien avec série de 7 jours, 3 quêtes/jour, cornes qui se rechargent, files d'entraînement et de construction en temps réel.

## L'IA
- **Le Seigneur des Cendres** (ennemi) analyse votre base (couverture de tir sol/air, murailles sur le chemin), attaque le flanc le plus faible, compose une contre-armée et **apprend** de chaque assaut (poids par unité sauvegardés, visibles dans l'Oracle). Son plan est révélé à l'avance par vos espions : réorganisez vos défenses pour le déjouer.
- **L'Architecte** génère procéduralement des camps d'expédition de difficulté croissante (styles anneau, compact, dispersé, compartiments).
- **L'Oracle** conseille le joueur et affiche une carte de chaleur de vos défenses.

## Code
`js/data.js` (équilibrage) · `state.js` (sauvegarde, économie hors-ligne) · `render.js` (rendu isométrique procédural) · `sim.js` (moteur de combat, champs de navigation Dijkstra) · `ai.js` · `game.js` · `ui.js` · `sfx.js` (sons WebAudio) · `main.js`.
