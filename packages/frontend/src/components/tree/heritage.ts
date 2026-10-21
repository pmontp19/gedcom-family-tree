// The heritage theme draws the tree the way the 1974 Calicó tree is painted:
// people in round medallions with their names in red ink, joined by curved
// brown branches with leaves, instead of cards and right-angled connectors.
// Only drawing changes: the layout and the hit areas stay those of the cards.

import { Graphics } from 'pixi.js';
import type { TreePalette } from '@/visualization/theme';

export { MEDALLION_R } from '@/visualization/theme';
import { MEDALLION_R } from '@/visualization/theme';
export const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';

const FRAME = 0xa8977f;   // taupe ring
const FRAME_IN = 0xd2bf98;
const BARK = 0x5a4226;
const BARK_LIGHT = 0x8a6f4d;
const LEAF = 0x6b8e4e;
const LEAF_VEIN = 0x4f6b38;

/** The medallion itself; the name goes on top as text. */
export function drawMedallion(
  g: Graphics,
  opts: { selected: boolean; hovered: boolean; palette: TreePalette; ink: number },
) {
  const { selected, hovered, palette, ink } = opts;
  g.clear();
  if (selected) g.circle(0, 0, MEDALLION_R + 6).stroke({ color: ink, width: 8, alpha: 0.22 });
  g.circle(0, 0, MEDALLION_R)
    .fill(palette.nodeBg)
    .stroke({ color: selected ? ink : hovered ? BARK : FRAME, width: selected ? 3.5 : 3 });
  g.circle(0, 0, MEDALLION_R - 5).stroke({ color: FRAME_IN, width: 1 });
}

/** Width of the medallion at height y, minus a margin: where a line of text fits. */
export function chordWidth(y: number, margin = 10): number {
  const r = MEDALLION_R - margin;
  return Math.abs(y) >= r ? 0 : 2 * Math.sqrt(r * r - y * y);
}

type Pt = { x: number; y: number };

function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): { p: Pt; angle: number } {
  const u = 1 - t;
  const p = {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
  const dx = 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x);
  const dy = 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y);
  return { p, angle: Math.atan2(dy, dx) };
}

function leaf(g: Graphics, at: Pt, angle: number, size: number) {
  const tip = { x: at.x + Math.cos(angle) * size, y: at.y + Math.sin(angle) * size };
  const mid = { x: (at.x + tip.x) / 2, y: (at.y + tip.y) / 2 };
  const nx = -Math.sin(angle) * size * 0.38, ny = Math.cos(angle) * size * 0.38;
  g.moveTo(at.x, at.y)
    .quadraticCurveTo(mid.x + nx, mid.y + ny, tip.x, tip.y)
    .quadraticCurveTo(mid.x - nx, mid.y - ny, at.x, at.y)
    .fill(LEAF)
    .moveTo(at.x, at.y).lineTo(tip.x, tip.y).stroke({ color: LEAF_VEIN, width: 0.8 });
}

/** Stable per branch: the same tree always grows the same leaves. */
function seed(a: Pt, b: Pt): number {
  return Math.abs(Math.round(a.x * 7 + a.y * 13 + b.x * 17 + b.y * 3)) % 997;
}

/** A painted branch from a to b, bending like a twig, with a few leaves. */
export function branch(g: Graphics, a: Pt, b: Pt, opts: { width?: number; leaves?: boolean } = {}) {
  const width = opts.width ?? 4.5;
  const dy = b.y - a.y;
  const c1 = { x: a.x, y: a.y + dy * 0.55 };
  const c2 = { x: b.x, y: b.y - dy * 0.45 };
  const path = () => g.moveTo(a.x, a.y).bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
  path().stroke({ color: BARK, width, cap: 'round' });
  path().stroke({ color: BARK_LIGHT, width: Math.max(1, width * 0.35), cap: 'round', alpha: 0.9 });

  if (opts.leaves === false) return;
  const s = seed(a, b);
  for (const [i, t] of [0.3, 0.62].entries()) {
    const { p, angle } = cubic(a, c1, c2, b, t + ((s >> i) % 7) / 100);
    const side = (s + i) % 2 ? 1 : -1;
    leaf(g, p, angle + side * 0.9, 15);
  }
}

/** The bond between a couple: a short branch that sags a little. */
export function coupleBranch(g: Graphics, x1: number, y1: number, x2: number, y2: number) {
  const path = () => g.moveTo(x1, y1).quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + 7, x2, y2);
  path().stroke({ color: BARK, width: 4, cap: 'round' });
  path().stroke({ color: BARK_LIGHT, width: 1.4, cap: 'round' });
}
