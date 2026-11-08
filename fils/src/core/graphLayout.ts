/**
 * Mise en page radiale de l'arbre des liens, centrée sur « moi » :
 *
 *   moi (centre) ── mes ancrages (anneau intérieur) ── personnes (anneaux extérieurs)
 *
 * - Une personne est placée dans la direction des ancrages qu'elle partage avec
 *   moi (moyenne circulaire pondérée), donc les fils « poussent » depuis le bon
 *   ancrage ; quelqu'un qui partage deux ancrages flotte entre les deux.
 * - Plus le score est élevé, plus la personne est proche du centre.
 * - Une relaxation simple écarte les nœuds qui se chevauchent.
 */
import { anonymousName, hashString } from './anonymize';
import type { LinkResult } from './scoring';
import type { Anchor, AnchorKind } from './types';

export interface AnchorNode {
  id: string;
  anchor: Anchor;
  x: number;
  y: number;
  linked: boolean;
}

export interface PersonNode {
  id: string;
  link: LinkResult;
  label: string;
  x: number;
  y: number;
  r: number;
  kind: AnchorKind;
}

export interface Edge {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: AnchorKind;
  weight: number;
  /** Ordre d'apparition pour l'animation. */
  order: number;
}

export interface GraphLayout {
  anchors: AnchorNode[];
  people: PersonNode[];
  edges: Edge[];
  extent: number;
}

export const ANCHOR_RING = 95;
const PERSON_MIN_R = 175;
const PERSON_MAX_R = 400;
const MIN_GAP = 34;

export function layoutGraph(myAnchors: Anchor[], links: LinkResult[], maxPeople = 40): GraphLayout {
  const visible = myAnchors.filter((a) => a.visible);
  const top = links.slice(0, maxPeople);
  const linkedIds = new Set(top.flatMap((l) => l.matches.map((m) => m.mine.id)));

  const angleOf = new Map<string, number>();
  const anchors: AnchorNode[] = visible.map((anchor, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(visible.length, 1);
    angleOf.set(anchor.id, angle);
    return {
      id: anchor.id,
      anchor,
      x: Math.cos(angle) * ANCHOR_RING,
      y: Math.sin(angle) * ANCHOR_RING,
      linked: linkedIds.has(anchor.id),
    };
  });

  // Coordonnées polaires initiales des personnes.
  const polar = top.map((link) => {
    let sx = 0;
    let sy = 0;
    for (const m of link.matches) {
      const a = angleOf.get(m.mine.id) ?? 0;
      sx += Math.cos(a) * m.weight;
      sy += Math.sin(a) * m.weight;
    }
    const jitter = ((hashString(link.candidateId) % 1000) / 1000 - 0.5) * 0.9;
    const angle = Math.atan2(sy, sx) + jitter;
    const r = PERSON_MIN_R + (1 - link.score) * (PERSON_MAX_R - PERSON_MIN_R);
    return { angle, r };
  });

  // Relaxation : on écarte angulairement les nœuds trop proches (le rayon,
  // qui encode le score, est conservé ; seul un léger décalage radial est permis).
  for (let iter = 0; iter < 80; iter++) {
    let moved = false;
    for (let i = 0; i < polar.length; i++) {
      for (let j = i + 1; j < polar.length; j++) {
        const a = polar[i];
        const b = polar[j];
        const dx = Math.cos(a.angle) * a.r - Math.cos(b.angle) * b.r;
        const dy = Math.sin(a.angle) * a.r - Math.sin(b.angle) * b.r;
        const d = Math.hypot(dx, dy);
        if (d < MIN_GAP) {
          const push = ((MIN_GAP - d) / MIN_GAP) * 0.06;
          const dir = Math.sin(b.angle - a.angle) >= 0 ? 1 : -1;
          a.angle -= push * dir;
          b.angle += push * dir;
          if (iter > 40) {
            a.r -= 2;
            b.r += 2;
          }
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  const people: PersonNode[] = top.map((link, i) => ({
    id: link.candidateId,
    link,
    label: anonymousName(link.candidateId),
    x: Math.cos(polar[i].angle) * polar[i].r,
    y: Math.sin(polar[i].angle) * polar[i].r,
    r: 5 + 9 * link.score,
    kind: link.matches[0].mine.kind,
  }));

  const edges: Edge[] = [];
  anchors.forEach((a, i) =>
    edges.push({ key: `me-${a.id}`, x1: 0, y1: 0, x2: a.x, y2: a.y, kind: a.anchor.kind, weight: 1, order: i }),
  );
  people.forEach((p, i) => {
    for (const m of p.link.matches) {
      const a = anchors.find((n) => n.id === m.mine.id);
      if (!a) continue;
      edges.push({
        key: `${a.id}-${p.id}`,
        x1: a.x,
        y1: a.y,
        x2: p.x,
        y2: p.y,
        kind: m.mine.kind,
        weight: m.weight,
        order: anchors.length + i,
      });
    }
  });

  const extent = Math.max(PERSON_MIN_R, ...people.map((p) => Math.hypot(p.x, p.y) + p.r)) + 30;
  return { anchors, people, edges, extent };
}
