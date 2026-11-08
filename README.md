# Boussole 🧭 — 2 minutes pour aller mieux

Application mobile (PWA installable, 100 % hors ligne) qui améliore le bien-être au quotidien.

**Le principe, en un geste :**
1. **Pose ton doigt** sur le pad de couleur : horizontalement ton humeur, verticalement ton énergie. Pas de questionnaire.
2. **Boussole te propose UNE micro-action** de 1 à 5 minutes adaptée à ton état (cohérence cardiaque, ancrage 5-4-3-2-1, marche, gratitude, message à un proche, focus…), guidée pas à pas.
3. **Repose ton doigt après** : l'app mesure ton gain de bien-être et **apprend ce qui marche vraiment pour toi**. Plus tu l'utilises, plus ses suggestions sont justes.

**Ce qui la rend différente :** au lieu de conseils génériques, Boussole mesure l'effet réel de chaque action sur *toi* (avant/après) et adapte ses recommandations, sans compte, sans serveur et sans pub. Tes données ne quittent jamais ton téléphone.

## Fonctionnalités
- Check-in émotionnel en un seul toucher (pad humeur × énergie), utilisable au clavier
- 16 micro-actions guidées : minuteur, respiration animée, étapes, écriture (le texte « Vide ta tête » est effacé après lecture, jamais enregistré)
- Moteur de recommandation qui apprend tout seul (moyenne lissée des gains par état émotionnel, avec un peu d'exploration)
- Progrès : série de jours, humeur sur 14 jours, classement « Ce qui marche pour toi », constats automatiques (moment de la journée, état le plus fréquent…)
- Journal des bons moments, export JSON, thème clair/sombre, vibrations, mode hors ligne

## Lancer
```bash
cd boussole && python3 -m http.server 8000
# puis ouvrir http://localhost:8000 (ou l'IP de l'ordinateur depuis le téléphone)
```
Pour l'installer sur un téléphone, il faut l'héberger en HTTPS (GitHub Pages, Netlify…), puis « Ajouter à l'écran d'accueil ».

> Boussole ne remplace pas un professionnel de santé. En cas de détresse : 3114 (France, 24h/24).
