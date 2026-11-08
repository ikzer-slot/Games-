/**
 * Construit une page HTML autonome (un seul fichier) du prototype en mode démo,
 * pour la partager sans serveur :
 *   npx expo export --platform web && node scripts/build-standalone.mjs
 * Sortie : dist-standalone/fils.html
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const jsDir = 'dist/_expo/static/js/web';
const files = readdirSync(jsDir).filter((f) => f.endsWith('.js'));
if (files.length !== 1) throw new Error(`Un seul bundle attendu (asyncRoutes: false), trouvé : ${files.join(', ')}`);

// Le bundle est inséré dans une balise <script> : on neutralise les séquences
// qui fermeraient la balise ou ouvriraient un commentaire HTML.
const bundle = readFileSync(join(jsDir, files[0]), 'utf8').replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

const prelude = `
// Stockage : si localStorage est indisponible (navigation privée, iframe), stockage en mémoire.
(function () {
  try { var k = '__fils_test__'; window.localStorage.setItem(k, k); window.localStorage.removeItem(k); }
  catch (e) {
    var mem = {};
    var store = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; },
      clear: function () { mem = {}; },
      key: function (i) { return Object.keys(mem)[i] || null; },
      get length() { return Object.keys(mem).length; }
    };
    try { Object.defineProperty(window, 'localStorage', { value: store, configurable: true }); } catch (e2) {}
  }
  // Le routeur lit le chemin de l'URL : on démarre toujours à la racine de l'app.
  try { if (location.pathname !== '/') history.replaceState(null, '', '/' + location.hash); } catch (e) {}
})();
`;

const html = `<title>Fils</title>
<meta name="description" content="Prototype jouable de Fils, en mode démo avec 50 profils fictifs.">
<style>
  /* Une scène nocturne, l'app au centre dans un cadre de téléphone (plein écran sur mobile). */
  :root {
    --night: #08070B;
    --ink: #0E0D12;
    --amber: #F4B860;
    --amber-soft: rgba(244, 184, 96, 0.18);
    --text: #F3EDE4;
    --muted: #A59D95;
    --edge: #2E2A36;
    color-scheme: dark;
  }
  html, body { height: 100%; }
  body {
    margin: 0;
    overflow: hidden;
    background: radial-gradient(ellipse at 50% 35%, #1a1520 0%, var(--night) 60%) fixed, var(--night);
    color: var(--text);
    font-family: Georgia, 'Times New Roman', serif;
  }
  .stage { height: 100%; display: flex; align-items: center; justify-content: center; gap: 56px; }
  .device {
    position: relative;
    width: 400px;
    height: min(860px, calc(100% - 48px));
    border-radius: 44px;
    border: 1px solid var(--edge);
    background: var(--ink);
    overflow: hidden;
    box-shadow: 0 0 0 10px #121016, 0 0 0 11px var(--edge), 0 30px 90px rgba(0,0,0,.6), 0 0 120px var(--amber-soft);
    display: flex;
  }
  #root { display: flex; flex: 1; height: 100%; min-width: 0; }
  .aside { max-width: 300px; display: flex; flex-direction: column; gap: 14px; }
  .aside h1 { margin: 0; font-weight: 400; font-size: 56px; letter-spacing: .02em; color: #FFE7BF; text-shadow: 0 0 30px rgba(244,184,96,.45); }
  .aside p { margin: 0; color: var(--muted); font: 15px/1.55 -apple-system, 'Segoe UI', Roboto, sans-serif; }
  .aside .tag { align-self: flex-start; border: 1px solid #8A6A3E; color: var(--amber); border-radius: 999px; padding: 3px 12px; font: 600 11px/1.6 -apple-system, 'Segoe UI', Roboto, sans-serif; letter-spacing: .04em; }
  .aside ol { margin: 0; padding-left: 18px; color: var(--muted); font: 14px/1.6 -apple-system, 'Segoe UI', Roboto, sans-serif; }
  .aside ol li::marker { color: var(--amber); }
  @media (max-width: 820px) {
    .aside { display: none; }
  }
  @media (max-width: 500px), (max-height: 640px) {
    .stage { display: block; }
    .device { width: 100%; height: 100%; border-radius: 0; border: 0; box-shadow: none; }
  }
</style>
<div class="stage">
  <div class="aside">
    <h1>Fils</h1>
    <span class="tag">Prototype · mode démo · données fictives</span>
    <p>Des vies se croisent sans le savoir. Déclarez quelques points d’ancrage, et Fils tire les fils qui vous relient à d’autres personnes.</p>
    <ol>
      <li>Acceptez le consentement, choisissez un pseudo.</li>
      <li>Ajoutez 3 à 5 ancrages, par exemple Lyon 2008–2012, Lycée Ampère 2002–2005, Canicule 2003 à Paris.</li>
      <li>Touchez un point lumineux du graphe, puis « Dire bonjour ».</li>
      <li>Une dizaine de secondes après l’inscription, un fil vous écrit.</li>
    </ol>
    <p>Tout reste dans ce navigateur : rien n’est envoyé à un serveur.</p>
  </div>
  <div class="device"><div id="root"></div></div>
</div>
<script>${prelude}</script>
<script>${bundle}</script>
`;

mkdirSync('dist-standalone', { recursive: true });
writeFileSync('dist-standalone/fils.html', html);
console.log(`dist-standalone/fils.html — ${(html.length / 1024 / 1024).toFixed(2)} Mo`);
