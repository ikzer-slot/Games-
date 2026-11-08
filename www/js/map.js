// Génération procédurale du terrain : un chemin sinueux de la forêt (haut) à la grange (bas).
import { COLS, ROWS } from './data.js';

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

export function generateMap() {
  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid.push([]);
    for (let c = 0; c < COLS; c++) grid[r].push({ t: 'g', crop: null, tower: null, last: null });
  }
  const path = [];
  let c = ri(1, COLS - 2), r = 0;
  path.push({ c, r });
  while (r < ROWS - 1) {
    const down = Math.min(ri(2, 3), ROWS - 1 - r);
    for (let i = 0; i < down; i++) { r++; path.push({ c, r }); }
    if (r >= ROWS - 1) break;
    let nc;
    do { nc = ri(0, COLS - 1); } while (Math.abs(nc - c) < 2);
    const dir = Math.sign(nc - c);
    while (c !== nc) { c += dir; path.push({ c, r }); }
  }
  path.forEach(p => grid[p.r][p.c].t = 'p');
  const end = path[path.length - 1];
  grid[end.r][end.c].t = 'b';

  const nearPath = (rr, cc) => {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const t = grid[rr + dr]?.[cc + dc]?.t;
      if (t === 'p' || t === 'b') return true;
    }
    return false;
  };
  const place = (type, n) => {
    let tries = 0;
    while (n > 0 && tries++ < 200) {
      const rr = ri(1, ROWS - 2), cc = ri(0, COLS - 1);
      if (grid[rr][cc].t === 'g' && !nearPath(rr, cc)) { grid[rr][cc].t = type; n--; }
    }
  };
  place('w', 2);
  place('r', 3);
  return { grid, path };
}

export function neighbors(grid, r, c, diag = false) {
  const out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    if (!diag && dr && dc) continue;
    const cell = grid[r + dr]?.[c + dc];
    if (cell) out.push({ r: r + dr, c: c + dc, cell });
  }
  return out;
}
