// Single source of truth for tree canvas metrics and themes.
// Shared by dag-builder (layout), viewport-culler (culling) and PixiTree (render)
// so geometry and visuals never drift apart.

export const NODE_W = 208;
export const NODE_H = 76;
export const NODE_RADIUS = 14;
export const COUPLE_GAP = 56;

export type Sex = 'M' | 'F' | 'U';
export type ThemeId = 'light' | 'dark' | 'heritage';

export interface TreePalette {
  nodeBg: number;
  avatarBg: number;
  avatarText: number;
  textPrimary: number;
  textMuted: number;
  edgeMarriage: number;
  edgeChild: number;
  badgeBg: number;
  badgeBorder: number;
  badgeText: number;
  stubStroke: number;
  stubFill: number;
}

export interface TreeTheme {
  id: ThemeId;
  canvasBg: number;
  palette: TreePalette;
  sexColors: Record<Sex, number>;
}

const DEFAULT_SEX_COLORS: Record<Sex, number> = {
  M: 0x3b82f6, // blue-500
  F: 0xec4899, // pink-500
  U: 0x64748b, // slate-500
};

// Values mirror Tailwind slate scale so the canvas harmonizes with the
// bg-slate-50 / dark:bg-slate-900 container.
const LIGHT: TreeTheme = {
  id: 'light',
  canvasBg: 0xf8fafc,
  palette: {
    nodeBg: 0xffffff,
    avatarBg: 0xf1f5f9,    // slate-100
    avatarText: 0x94a3b8,  // slate-400
    textPrimary: 0x0f172a, // slate-900
    textMuted: 0x64748b,   // slate-500
    edgeMarriage: 0x94a3b8, // slate-400
    edgeChild: 0xcbd5e1,   // slate-300
    badgeBg: 0xffffff,
    badgeBorder: 0xe2e8f0, // slate-200
    badgeText: 0x64748b,   // slate-500
    stubStroke: 0xcbd5e1,  // slate-300
    stubFill: 0xffffff,
  },
  sexColors: DEFAULT_SEX_COLORS,
};

const DARK: TreeTheme = {
  id: 'dark',
  canvasBg: 0x0f172a,
  palette: {
    nodeBg: 0x1e293b,      // slate-800
    avatarBg: 0x1a2536,    // slate-800 deepened
    avatarText: 0x64748b,  // slate-500
    textPrimary: 0xf1f5f9, // slate-100
    textMuted: 0x94a3b8,   // slate-400
    edgeMarriage: 0x475569, // slate-600
    edgeChild: 0x334155,   // slate-700
    badgeBg: 0x0f172a,     // slate-900
    badgeBorder: 0x334155, // slate-600
    badgeText: 0x94a3b8,   // slate-400
    stubStroke: 0x334155,  // slate-700
    stubFill: 0x1e293b,    // slate-800
  },
  sexColors: DEFAULT_SEX_COLORS,
};

// "Piugpelat Heritage": derived from the hand-painted family tree.
// Parchment, taupe frames, crimson ink names, sepia dates, branch edges.
const HERITAGE: TreeTheme = {
  id: 'heritage',
  canvasBg: 0xf3e4c2,      // parchment
  palette: {
    nodeBg: 0xf8eed6,      // card cream
    avatarBg: 0xecd9b4,    // aged parchment
    avatarText: 0x7d6543,  // muted sepia initials
    textPrimary: 0xb0402c, // crimson ink (names)
    textMuted: 0x7d6543,   // sepia (dates)
    edgeMarriage: 0x5a4226, // branch brown
    edgeChild: 0x8a6f4d,   // softer branch
    badgeBg: 0xf8eed6,
    badgeBorder: 0xc9a84c, // gold
    badgeText: 0x4a3521,   // dark sepia
    stubStroke: 0xa8977f,  // taupe frame
    stubFill: 0xf8eed6,
  },
  sexColors: {
    M: 0x6b8e4e, // moss green (leaves)
    F: 0xb0402c, // crimson ink
    U: 0x8b7d6b, // taupe frame
  },
};

const THEMES: Record<ThemeId, TreeTheme> = { light: LIGHT, dark: DARK, heritage: HERITAGE };

export function getTreeTheme(id?: ThemeId): TreeTheme {
  return THEMES[id ?? 'light'] ?? LIGHT;
}

export function hexString(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Mix two hex colors. t=0 -> a, t=1 -> b. */
function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

export function lighten(color: number, amount: number): number {
  return mixColor(color, 0xffffff, amount);
}
