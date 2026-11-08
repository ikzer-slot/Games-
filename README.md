# 🌻 Potager Gardien

> **Cultive le jour. Défends la nuit. Face à un Essaim qui apprend de toi.**

Jeu mobile original mêlant **farming**, **tower defense** et **gestion**, avec deux IA au cœur du gameplay.
Portrait, tactile, 100 % hors-ligne, prêt à être publié sur **Google Play**, l'**App Store** ou en **PWA**.

## 💡 L'idée originale

Dans la plupart des tower defense, l'argent tombe du ciel. Ici, **tes récoltes sont tes munitions** :

| Culture | Produit | Sert à… |
|---|---|---|
| 🥕 Carotte | Carottes | Vendre, honorer les commandes |
| 🌻 Tournesol | Graines 🌰 | Munitions du **Graineur** + booste les **Ruches** voisines |
| 🌶️ Piment | Piments | Munitions du **Brûle-piment** |
| 🎃 Citrouille | Citrouilles | Munitions de la **Catapulte**, et très chère au marché |

Chaque récolte pose un dilemme de gestion : **vendre** (prix dynamiques, événements du village, commandes des villageois)
ou **garder** pour défendre la ferme la nuit ? Et où planter : près de l'eau (pousse +50 %)… ou au bord du chemin,
là où les nuisibles grignotent ?

### Boucle de jeu
1. **☀️ Jour** : planter, récolter (tap ou glisser le doigt), construire des Gardiens, vendre, livrer des commandes, acheter des robots.
2. **🌙 Nuit** : l'Essaim sort de la forêt et suit le chemin jusqu'à la grange. Tes Gardiens consomment le silo.
3. **🌅 Aube** : rapport d'évolution de l'Essaim, prime, nouveau jour. Boss 🐗 toutes les 5 nuits.

## 🤖 L'IA dans le jeu

### 1. L'Essaim — une IA évolutionnaire (`www/js/swarm.js`)
Chaque espèce de nuisible possède une population de **génomes** (vigueur, vitesse, carapace, résistances physique/feu/explosion/poison, gloutonnerie).
- Chaque nuisible envoyé mesure sa **fitness** : distance parcourue, cultures mangées, dégâts à la grange.
- À l'aube : **sélection** des meilleurs, **croisement**, **mutation dirigée** vers les résistances aux dégâts que tu as le plus infligés.
- Les espèces les plus efficaces sont envoyées plus souvent.

➡️ Si tu ne construis que des Graineurs, l'Essaim développe une carapace. **Il faut diversifier** — et le jeu t'explique pourquoi dans le rapport de l'aube (panneau 🧬).

### 2. Gaïa — l'assistante IA (`www/js/advisor.js`)
- **Mode local (hors-ligne)** : moteur de règles qui analyse en temps réel munitions, cultures exposées, résistances de l'Essaim, prix du marché, commandes…
- **Mode connecté (optionnel)** : Gaïa envoie un résumé de la partie à ton serveur, qui interroge **Claude** (Anthropic) pour un conseil personnalisé ou une réponse à une question libre.

### 3. Robots-jardiniers — agents autonomes
IA utilitaire : chaque robot évalue toutes les cases (valeur ÷ distance) pour choisir quoi récolter ou replanter.

## 📁 Structure

```
www/                 ← l'application (HTML/CSS/JS sans dépendance, sans build)
  index.html
  css/style.css
  js/main.js         boucle, menu, service worker
  js/game.js         simulation + rendu canvas
  js/ui.js           HUD, panneaux, Gaïa
  js/swarm.js        algorithme génétique de l'Essaim
  js/advisor.js      Gaïa (local + Claude)
  js/data.js         équilibrage (cultures, Gardiens, nuisibles)
  js/map.js          génération procédurale du terrain
  js/audio.js        sons synthétisés (WebAudio)
  manifest.webmanifest, sw.js, icons/
server/gaia-proxy.mjs  ← proxy Claude optionnel pour Gaïa
capacitor.config.json  ← empaquetage natif Android / iOS
```

## 📦 Version en un seul fichier

```bash
python3 tools/build-single.py dist/potager-gardien.html
```
Génère un fichier HTML autonome : il suffit de l'ouvrir dans un navigateur ou de l'héberger n'importe où.

## ▶️ Lancer en local

```bash
npm run dev            # puis ouvre http://localhost:8080 (ou sur ton téléphone via l'IP locale)
```
N'importe quel serveur statique fonctionne (`python3 -m http.server -d www`).

## 📱 Publier sur mobile

Le jeu est empaqueté avec [Capacitor](https://capacitorjs.com) (le dossier `www/` devient une app native).

### Android (Google Play)
```bash
npm install
npm run cap:add:android     # une seule fois
npm run cap:android         # ouvre Android Studio
```
Dans Android Studio : *Build → Generate Signed Bundle (AAB)*, puis dépose l'AAB sur la [Play Console](https://play.google.com/console).
Pense à verrouiller l'orientation en portrait (`android:screenOrientation="portrait"` dans `AndroidManifest.xml`).

### iOS (App Store) — nécessite un Mac + Xcode
```bash
npm run cap:add:ios
npm run cap:ios             # ouvre Xcode → Product → Archive → App Store Connect
```

### PWA (sans store)
Héberge `www/` en HTTPS (GitHub Pages, Netlify…). Le jeu est installable (« Ajouter à l'écran d'accueil ») et fonctionne hors-ligne.
Pour le Play Store sans Capacitor, une PWA peut aussi être empaquetée en TWA avec [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap).

### Checklist store
- Icônes : `www/icons/` (192, 512, maskable 512) — régénérer en haute résolution si besoin à partir de `icon.svg`.
- Captures d'écran portrait, description, classification PEGI 3.
- Politique de confidentialité : voir [`PRIVACY.md`](PRIVACY.md).

## ✨ Activer Gaïa connectée (Claude)

```bash
cd server
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start      # écoute sur :8787
```
Dans le jeu : **⚙️ Réglages → URL** `https://ton-serveur/gaia`.
- La clé API reste **sur le serveur**, jamais dans l'app.
- Modèle par défaut `claude-opus-5-5` (effort `low`, réponses courtes) ; change-le avec `GAIA_MODEL`.
- Le repli serveur automatique (`fallbacks: "default"`) est activé si le modèle refuse une requête.
- `ALLOWED_ORIGIN` restreint le CORS ; une limite de 20 requêtes/min/IP est incluse.
- Sans URL, ou en cas d'erreur réseau, Gaïa bascule automatiquement sur son IA locale.

## 🎛️ Équilibrage
Tout se règle dans `www/js/data.js` (coûts, dégâts, cadences, PV, vitesses) et dans `swarm.js`
(`budget()` = puissance génétique par nuit, plafonds de résistance à 70 %).

## Idées pour la suite
Saisons (hiver = pas de croissance), météo, nouvelles cultures/Gardiens, classement en ligne, cosmétiques de ferme, mode « défi du jour » à graine fixe.
