// Proxy optionnel pour « Gaïa connectée » : le jeu envoie un résumé de la partie,
// ce serveur interroge Claude et renvoie un conseil court.
// La clé API reste côté serveur — ne la mets JAMAIS dans l'application mobile.
//
// Utilisation :
//   cd server && npm install && ANTHROPIC_API_KEY=sk-ant-... node gaia-proxy.mjs
//   Puis dans le jeu : ⚙️ Réglages → URL : http://<ip-du-serveur>:8787/gaia
import http from 'node:http';
import Anthropic from '@anthropic-ai/sdk';

const PORT = process.env.PORT || 8787;
const MODEL = process.env.GAIA_MODEL || 'claude-opus-5-5';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const client = new Anthropic(); // lit ANTHROPIC_API_KEY

const SYSTEM = `Tu es Gaïa, la petite IA bienveillante d'un jeu mobile français, « Potager Gardien ».
Le jeu mélange ferme, tower defense et gestion :
- Le jour, le joueur plante (carottes, tournesols→graines, piments, citrouilles), récolte, vend au marché (prix dynamiques) et livre des commandes de villageois (réputation ⭐).
- La nuit, des nuisibles suivent un chemin jusqu'à la grange et grignotent les cultures au bord du chemin.
- Les Gardiens consomment les récoltes comme munitions : Graineur (graines, physique), Brûle-piment (piments, feu), Catapulte (citrouilles, explosif, ne touche pas les volants), Ruche (poison, sans munitions, boostée par les tournesols mûrs adjacents), Épouvantail (ralentit, protège les cultures).
- L'Essaim est une IA génétique : il développe des résistances aux types de dégâts les plus utilisés.
- Les Robots-jardiniers récoltent et replantent automatiquement.
Réponds en français, en tutoyant, en 1 à 2 phrases (max 45 mots), avec un ton chaleureux et un emoji au plus.
Donne UN conseil concret et actionnable basé sur l'état fourni, ou réponds à la question du joueur.`;

// Limitation simple : 20 requêtes par minute et par IP.
const hits = new Map();
function limited(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 20;
}

function send(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  res.end(JSON.stringify(obj));
}

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST' || !req.url.startsWith('/gaia')) return send(res, 404, { error: 'not found' });
  if (limited(req.socket.remoteAddress)) return send(res, 429, { error: 'trop de requêtes' });

  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 8000) return send(res, 413, { error: 'trop gros' }); }
  let data;
  try { data = JSON.parse(body); } catch { return send(res, 400, { error: 'JSON invalide' }); }
  const question = typeof data.question === 'string' ? data.question.slice(0, 200) : '';

  try {
    const msg = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `État de la partie (JSON) :\n${JSON.stringify(data.state).slice(0, 4000)}\n\n` +
          (question ? `Question du joueur : ${question}` : 'Donne-moi ton meilleur conseil maintenant.'),
      }],
    });
    if (msg.stop_reason === 'refusal') return send(res, 200, { tip: "Hmm, je ne peux pas t'aider là-dessus. Parlons plutôt de ton potager ! 🌱" });
    const tip = msg.content.filter(b => b.type === 'text').map(b => b.text).join(' ').trim();
    send(res, 200, { tip: tip || 'Continue comme ça, ta ferme prospère ! 🌻' });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return send(res, 429, { error: 'limite atteinte' });
    if (e instanceof Anthropic.APIError) { console.error('API', e.status, e.message); return send(res, 502, { error: 'IA indisponible' }); }
    console.error(e); send(res, 500, { error: 'erreur interne' });
  }
}).listen(PORT, () => console.log(`🌱 Gaïa écoute sur http://localhost:${PORT}/gaia (modèle ${MODEL})`));
