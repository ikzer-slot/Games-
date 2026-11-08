// Point d'entrée : menu, boucle de jeu, réglages, service worker.
import { Game } from './game.js';
import { UI } from './ui.js';
import { setSound } from './audio.js';

const SETTINGS_KEY = 'potager-gardien-settings';
let settings = { sound: true, aiUrl: '' };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}); } catch { }
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { } };
setSound(settings.sound);

const $ = (id) => document.getElementById(id);
const game = new Game($('cv'), settings);
const ui = new UI(game, settings, saveSettings);
let running = false;
window.__potager = { game, ui }; // utile pour le débogage

function showMenu() {
  running = false;
  game.s = null;
  $('menu').hidden = false;
  $('btnContinue').hidden = !game.hasSave();
  const best = game.best();
  $('bestLabel').textContent = best ? `🏆 Record : ${best} nuit${best > 1 ? 's' : ''} survécue${best > 1 ? 's' : ''}` : '';
}

function start(load) {
  $('menu').hidden = true;
  game.resize();
  if (!(load && game.load())) game.newGame();
  game.paused = false; game.speed = 1; $('btnSpeed').textContent = 'x1'; $('btnPause').textContent = '⏸';
  ui.tab = 'farm';
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === 'farm'));
  ui.renderHud();
  lastSize = ''; requestAnimationFrame(onResize);
  if (game.s.tutorial < 4) ui.tutorial(game.s.tutorial);
  else setTimeout(() => ui.gaia(), 800);
  running = true;
}

ui.onRestart = () => start(false);
ui.onQuit = () => { if (game.s && game.s.phase !== 'over') game.save(); showMenu(); };

$('btnNew').addEventListener('click', () => {
  if (!game.hasSave()) return start(false);
  ui.openModal('Nouvelle partie ?', `<p>La sauvegarde actuelle (en cours) sera remplacée.</p>
    <div class="btns"><button class="btn red" id="cfmNo">Annuler</button><button class="btn alt" id="cfmYes">Recommencer</button></div>`, (b) => {
    b.querySelector('#cfmNo').onclick = () => ui.closeModal();
    b.querySelector('#cfmYes').onclick = () => { ui.closeModal(); start(false); };
  });
});
$('btnContinue').addEventListener('click', () => start(true));
$('btnHow').addEventListener('click', () => ui.howPanel());
$('btnSettings').addEventListener('click', () => ui.settingsPanel(false));

let last = performance.now();
function loop(now) {
  const dt = (now - last) / 1000; last = now;
  if (running && game.s) {
    game.update(dt);
    game.render();
    ui.autoTip(dt);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Redimensionne le canvas dès que la zone de jeu change (HUD, rotation, clavier…)
let lastSize = '';
const onResize = () => {
  const r = $('stage').getBoundingClientRect(), key = r.width + 'x' + r.height;
  if (key !== lastSize && game.s) { lastSize = key; game.resize(); }
};
if ('ResizeObserver' in window) new ResizeObserver(onResize).observe($('stage'));
window.addEventListener('resize', onResize);
// Pause automatique quand l'app passe en arrière-plan (mobile)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && running && game.s) { ui.togglePause(true); if (game.s.phase === 'day') game.save(); }
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => { });
}
showMenu();
