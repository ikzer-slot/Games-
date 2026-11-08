// Démarrage : menu animé, boucle de jeu, sauvegarde des réglages.
import { Game } from './game.js';
import { UI } from './ui.js';
import { setSound } from './audio.js';

const $ = (id) => document.getElementById(id);
const SETTINGS = 'miel-et-dards-settings';
let settings = { sound: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS)) || {}); } catch { }
setSound(settings.sound);

const game = new Game($('cv'));
const ui = new UI(game);
window.__ruche = { game, ui }; // pratique pour déboguer
let running = false, lastSize = '';

ui.onSettings = (o) => { Object.assign(settings, o); try { localStorage.setItem(SETTINGS, JSON.stringify(settings)); } catch { } };
ui.onRestart = () => start(false);
ui.onQuit = () => { if (game.s?.phase === 'build') game.save(); menu(); };

function menu() {
  running = false; game.s = null;
  $('menu').hidden = false;
  $('btnContinue').hidden = !game.hasSave();
  const b = game.best();
  $('best').textContent = b ? `🏆 Record : ${b} vague${b > 1 ? 's' : ''} repoussée${b > 1 ? 's' : ''}` : '';
}
function start(load) {
  $('menu').hidden = true;
  if (!(load && game.load())) game.newGame();
  game.paused = false; game.speed = 1; game.tool = null;
  $('btnSpeed').textContent = 'x1'; $('btnPause').textContent = '⏸';
  ui.tab = 'flowers';
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === 'flowers'));
  lastSize = ''; onResize(); ui.hud();
  if (game.s.tutorial < 4) ui.tutorial(game.s.tutorial);
  running = true;
}
$('btnNew').onclick = () => game.hasSave() ? ui.confirmNew(() => start(false)) : start(false);
$('btnContinue').onclick = () => start(true);
$('btnHow').onclick = () => ui.how();
$('btnSettings').onclick = () => ui.settings(false);

function onResize() {
  const r = $('stage').getBoundingClientRect(), k = r.width + 'x' + r.height;
  if (game.s && k !== lastSize) { lastSize = k; game.resize(); }
}
if ('ResizeObserver' in window) new ResizeObserver(onResize).observe($('stage'));
window.addEventListener('resize', onResize);
document.addEventListener('visibilitychange', () => { if (document.hidden && running && game.s) { ui.pause(true); if (game.s.phase === 'build') game.save(); } });

// Abeilles qui volent sur l'écran titre
const mc = $('menuBees'), mx = mc.getContext('2d');
const flyers = Array.from({ length: 14 }, () => ({ x: Math.random(), y: Math.random(), a: Math.random() * 7, s: 0.6 + Math.random() * 0.8 }));
function drawMenu(t) {
  const dpr = Math.min(devicePixelRatio || 1, 2), W = mc.clientWidth, H = mc.clientHeight;
  if (mc.width !== W * dpr) { mc.width = W * dpr; mc.height = H * dpr; }
  mx.setTransform(dpr, 0, 0, dpr, 0, 0); mx.clearRect(0, 0, W, H);
  for (const f of flyers) {
    f.a += (Math.random() - 0.5) * 0.2; f.x += Math.cos(f.a) * 0.0015 * f.s; f.y += Math.sin(f.a) * 0.0015 * f.s;
    if (f.x < -0.05) f.x = 1.05; if (f.x > 1.05) f.x = -0.05; if (f.y < -0.05) f.y = 1.05; if (f.y > 1.05) f.y = -0.05;
    const x = f.x * W, y = f.y * H, k = 9 * f.s, w = Math.abs(Math.sin(t / 30 + f.a)) * 0.6 + 0.4;
    mx.save(); mx.translate(x, y); mx.scale(Math.cos(f.a) < 0 ? -1 : 1, 1);
    mx.fillStyle = 'rgba(255,255,255,.8)'; mx.beginPath(); mx.ellipse(-2, -k * 0.6, k * 0.5, k * 0.3 * w, -0.4, 0, 7); mx.fill();
    mx.fillStyle = '#ffd23f'; mx.beginPath(); mx.ellipse(0, 0, k * 0.8, k * 0.55, 0, 0, 7); mx.fill();
    mx.fillStyle = '#2b2118'; mx.fillRect(-k * 0.2, -k * 0.5, k * 0.2, k); mx.beginPath(); mx.arc(k * 0.65, 0, k * 0.3, 0, 7); mx.fill();
    mx.restore();
  }
}

let last = performance.now();
function loop(now) {
  const dt = (now - last) / 1000; last = now;
  if (running && game.s) { game.update(dt); game.render(); }
  else if (!$('menu').hidden) drawMenu(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
menu();
