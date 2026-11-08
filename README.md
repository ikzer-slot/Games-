# 🍯 Miel & Dards

> Fais fleurir la prairie, élève ta colonie et protège ta Reine d'un **Frelon chef qui apprend**.

Jeu mobile original (portrait, tactile, hors-ligne) qui mélange **farming**, **tower defense** et **gestion**, avec de l'**IA au cœur du gameplay**.

## Le concept

Tu diriges une ruche au centre d'une prairie hexagonale.

- **🌸 Farming** : tu plantes des fleurs (Pâquerette, Tulipe, Tournesol, Pavot). Une fois ouvertes, tes **butineuses** (de vraies petites abeilles autonomes) y récoltent miel 🍯 et pollen 🌼, puis la fleur se recharge.
- **🐝 Gestion** : ta colonie est limitée. Tu répartis tes abeilles entre **butineuses** (miel), **gardiennes** (combat) et **nourrices** (pollen + miel → nouvelles abeilles). Chaque abeille mange du miel : une colonie mal gérée meurt de faim. Le miel sert aussi de monnaie pour planter, construire et agrandir la ruche.
- **🛡️ Tower defense à 360°** : les ennemis attaquent de tous les côtés. Les marcheurs (fourmis, araignées) **contournent tes défenses** : tu peux leur tracer un labyrinthe. Les volants (frelons, papillons de nuit) foncent tout droit, et les frelons **chassent tes abeilles**. Toutes les 5 vagues, un **ours** écrase tout sur son passage.

Défenses : Chardon (bloque et pique), Jarre à propolis (tire et ralentit), Poste de garde (étend la patrouille des gardiennes), Leurre de miel (retient les volants). Le Pavot est à la fois une fleur et une défense : son parfum ralentit les ennemis.

## L'IA dans le jeu (`www/js/ai.js`)

1. **Le Frelon chef** : un *bandit manchot* (algorithme UCB1). À chaque vague il choisit un côté d'attaque, mesure ce qu'il y gagne (dégâts, miel volé, distance parcourue) et apprend tes points faibles, tout en continuant d'explorer. Le côté visé s'allume en rouge avant la vague, et le panneau 🕵️ montre ce qu'il pense de chacun de tes flancs.
2. **La Reine** (Pilote IA, onglet 🐝 Colonie) : un planificateur qui simule l'avenir de la colonie pour des dizaines de répartitions possibles (récolte, croissance, menace, famine) et choisit la meilleure, en expliquant son choix. En test, une colonie pilotée par la Reine tient mieux qu'une répartition fixe.
3. **Les abeilles** : agents autonomes. Chaque butineuse choisit sa fleur selon la valeur, la distance et le danger ; les gardiennes chassent les ennemis dans leur zone.
4. **Les ennemis au sol** suivent un champ de flux recalculé à chaque construction (on ne peut jamais bloquer complètement le chemin).

## Structure

```
www/            l'application (HTML/CSS/JS, sans dépendance ni build)
  js/data.js    équilibrage (fleurs, défenses, ennemis, colonie)
  js/hex.js     grille hexagonale
  js/ai.js      Frelon chef (UCB1) + planificateur de la Reine
  js/game.js    simulation + rendu canvas
  js/ui.js      HUD, répartition de la colonie, panneaux
  js/main.js    menu, boucle, service worker
tools/build-single.py   version en un seul fichier HTML
capacitor.config.json   empaquetage Android / iOS
```

## Tester

- **Local** : `npm run dev`, puis ouvre `http://localhost:8080` (ou l'IP de ton ordinateur sur ton téléphone, même Wi-Fi).
- **Un seul fichier** : `npm run build:single` génère `dist/miel-et-dards.html`, à ouvrir dans n'importe quel navigateur.

## Publier sur mobile

Le jeu s'empaquette avec [Capacitor](https://capacitorjs.com) :

```bash
npm install
npx cap add android      # une fois
npm run cap:android      # ouvre Android Studio → Build → Generate Signed Bundle (AAB) → Play Console
npx cap add ios          # sur Mac
npm run cap:ios          # ouvre Xcode → Archive → App Store Connect
```

Pense à verrouiller le mode portrait, et à préparer des captures d'écran et une politique de confidentialité (le jeu ne collecte rien : la sauvegarde reste sur l'appareil).
On peut aussi héberger `www/` en HTTPS : c'est une PWA installable qui fonctionne hors-ligne.
