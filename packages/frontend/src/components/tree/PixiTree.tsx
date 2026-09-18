import { useEffect, useRef, useState } from 'react';
import { Application, Assets, Container, Graphics, Sprite, Text, Texture, TextStyle } from 'pixi.js';
import type { GraphData, TreeNode as GTreeNode } from '@/visualization/dag-builder';
import { getVisibleNodes } from '@/visualization/viewport-culler';
import { getDisplayName, getLifeYears, getPrimaryMediaFile } from '@gedcom/shared';
import type { Family } from '@gedcom/shared';
import { useMediaStore } from '@/hooks/useMediaStore';
import type { DetailLevel } from './FamilyTree';

interface PixiTreeProps {
  graph: GraphData;
  transform: { x: number; y: number; k: number };
  selectedId?: string;
  onSelect?: (id: string) => void;
  detailLevel: DetailLevel;
  darkMode?: boolean;
  families?: Map<string, Family>;
}

const NODE_W = 160;
const NODE_H = 60;
const NODE_HALF_W = NODE_W / 2;
const NODE_HALF_H = NODE_H / 2;

const LIGHT = {
  nodeBg: 0xffffff,
  textPrimary: 0x1f2937,
  textSecondary: 0x6b7280,
  edgeMarriage: 0x94a3b8,
  edgeChild: 0xcbd5e1,
};

const DARK = {
  nodeBg: 0x1e293b,
  textPrimary: 0xf1f5f9,
  textSecondary: 0x94a3b8,
  edgeMarriage: 0x475569,
  edgeChild: 0x334155,
};

const SEX_COLORS = { M: 0x3b82f6, F: 0xec4899, U: 0x6b7280 };

function getSexColor(sex?: 'M' | 'F' | 'U'): number {
  return sex === 'M' ? SEX_COLORS.M : sex === 'F' ? SEX_COLORS.F : SEX_COLORS.U;
}

export function PixiTree({ graph, transform, selectedId, onSelect, detailLevel, darkMode, families }: PixiTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mediaVersion = useMediaStore((s) => s.version);

  // Keep latest props accessible inside effects without re-running them
  const graphRef = useRef(graph);
  const transformRef = useRef(transform);
  const selectedIdRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const detailLevelRef = useRef(detailLevel);
  const darkModeRef = useRef(darkMode);
  useEffect(() => {
    graphRef.current = graph;
    transformRef.current = transform;
    selectedIdRef.current = selectedId;
    onSelectRef.current = onSelect;
    detailLevelRef.current = detailLevel;
    darkModeRef.current = darkMode;
  });

  // Pixi handles
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const nodeContainersRef = useRef<Map<string, Container>>(new Map());
  const edgeLayerRef = useRef<Container | null>(null);
  const readyRef = useRef(false);
  const [ready, setReady] = useState(false);

  // ─── Init PixiJS once ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const app = new Application();
    appRef.current = app;
    readyRef.current = false;

    let destroyed = false;

    app.init({
      resizeTo: el,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    }).then(() => {
      if (destroyed) {
        // Cleanup was called before init finished — destroy the app now
        app.destroy(true, { children: true });
        return;
      }

      const canvas = app.canvas as HTMLCanvasElement;
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      el.appendChild(canvas);

      const world = new Container();
      app.stage.addChild(world);
      worldRef.current = world;
      readyRef.current = true;
      // Trigger the scene-building effect with all current props
      setReady(true);
    }).catch(console.error);

    const containers = nodeContainersRef.current;
    return () => {
      destroyed = true;
      readyRef.current = false;
      if (appRef.current) {
        // If init completed, this is safe. If not, the .then() above handles it.
        try { appRef.current.destroy(true, { children: true }); } catch { /* ignore */ }
        appRef.current = null;
      }
      worldRef.current = null;
      containers.clear();
    };
  }, []); // init once

  // ─── Rebuild scene when ready, graph, detailLevel, darkMode, or media sources change ──
  useEffect(() => {
    if (!ready || !readyRef.current || !appRef.current || !worldRef.current) return;
    rebuildScene(
      appRef.current, worldRef.current, nodeContainersRef.current,
      graph, detailLevel, selectedId, onSelect, darkMode, families, edgeLayerRef,
    );
    applyTransform(worldRef.current, transform);
    cullNodes(appRef.current, nodeContainersRef.current, graph, transform);
  }, [ready, graph, detailLevel, darkMode, families, mediaVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Update selection highlight (node borders + edge highlight) ────────────
  useEffect(() => {
    if (!readyRef.current || !worldRef.current) return;
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
    for (const [id, container] of nodeContainersRef.current) {
      const node = nodeMap.get(id);
      if (node?.data) updateSelection(container, node, id === selectedId, darkMode);
    }
    // Redraw edges so the selected person's lineage is highlighted
    const layer = edgeLayerRef.current;
    if (layer) {
      layer.removeChildren().forEach(c => c.destroy({ children: true }));
      const gfx = new Graphics();
      layer.addChild(gfx);
      drawEdges(gfx, layer, graph, darkMode ? DARK : LIGHT, families, selectedId);
    }
  }, [selectedId, graph, darkMode, families]);

  // ─── Apply transform + culling ────────────────────────────────────────────
  useEffect(() => {
    if (!readyRef.current || !appRef.current || !worldRef.current) return;
    applyTransform(worldRef.current, transform);
    cullNodes(appRef.current, nodeContainersRef.current, graph, transform);
  }, [transform, graph]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
    />
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rebuildScene(
  _app: Application,
  world: Container,
  nodeContainers: Map<string, Container>,
  graph: GraphData,
  detailLevel: DetailLevel,
  selectedId: string | undefined,
  onSelect: ((id: string) => void) | undefined,
  darkMode?: boolean,
  families?: Map<string, Family>,
  edgeLayerRef?: { current: Container | null },
) {
  world.removeChildren();
  nodeContainers.clear();

  const palette = darkMode ? DARK : LIGHT;

  // Edges live in their own layer so selection can redraw them in isolation
  const edgeLayer = new Container();
  world.addChild(edgeLayer);
  const edgeGfx = new Graphics();
  edgeLayer.addChild(edgeGfx);
  drawEdges(edgeGfx, edgeLayer, graph, palette, families, selectedId);
  if (edgeLayerRef) edgeLayerRef.current = edgeLayer;

  // Nodes
  for (const node of graph.nodes) {
    if (node.type !== 'individual' || !node.data) continue;
    if (node.x === undefined || node.y === undefined) continue;

    const container = createNodeSprite(node, detailLevel, node.id === selectedId, onSelect, palette);
    container.position.set(node.x, node.y);
    world.addChild(container);
    nodeContainers.set(node.id, container);
  }

  // Ancestor stub nodes
  for (const node of graph.nodes) {
    if (node.type !== 'family' || !node.isAncestorStub) continue;
    if (node.x === undefined || node.y === undefined) continue;
    const container = createAncestorStubSprite(detailLevel, palette);
    container.position.set(node.x, node.y);
    world.addChild(container);
    nodeContainers.set(node.id, container);
  }
}

function applyTransform(world: Container, t: { x: number; y: number; k: number }) {
  world.position.set(t.x, t.y);
  world.scale.set(t.k);
}

function cullNodes(
  app: Application,
  nodeContainers: Map<string, Container>,
  graph: GraphData,
  transform: { x: number; y: number; k: number },
) {
  const w = app.screen.width;
  const h = app.screen.height;
  const visible = getVisibleNodes(graph.nodes, transform, w, h);
  for (const [id, container] of nodeContainers) {
    container.visible = visible.has(id);
  }
}

type Palette = typeof LIGHT;

// ─── Avatars (photos) ─────────────────────────────────────────────────────────

const textureCache = new Map<string, Texture>();

const AVATAR_R = 20;
const AVATAR_CX = -NODE_HALF_W + 30;

function getInitials(ind: { name?: { given?: string; surname?: string } }): string {
  const g = ind.name?.given?.[0] ?? '';
  const s = ind.name?.surname?.[0] ?? '';
  return (g + s).toUpperCase() || '?';
}

function applyPhotoTexture(container: Container, texture: Texture, cx: number, cy: number, radius: number, placeholder?: Text) {
  if (container.destroyed) return;
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.width = radius * 2;
  sprite.height = radius * 2;
  sprite.position.set(cx, cy);
  const mask = new Graphics();
  mask.circle(cx, cy, radius).fill(0xffffff);
  container.addChild(mask);
  container.addChild(sprite);
  sprite.mask = mask;
  if (placeholder) container.removeChild(placeholder);
}

function addAvatar(
  container: Container,
  ind: { name?: { given?: string; surname?: string } },
  photoUrl: string | null,
  sex: 'M' | 'F' | 'U' | undefined,
  palette: Palette,
) {
  const color = getSexColor(sex);
  // Ring + background
  const ring = new Graphics();
  ring.circle(AVATAR_CX, 0, AVATAR_R + 1.5)
    .fill(palette.nodeBg)
    .stroke({ color, width: 2 });
  container.addChild(ring);

  // Placeholder initials (kept if no photo / while loading)
  const initials = new Text({
    text: getInitials(ind),
    style: new TextStyle({
      fontSize: 14,
      fontWeight: '700',
      fill: palette.textSecondary,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }),
  });
  initials.anchor.set(0.5);
  initials.position.set(AVATAR_CX, 1);
  container.addChild(initials);

  if (!photoUrl) return;
  const cached = textureCache.get(photoUrl);
  if (cached) {
    applyPhotoTexture(container, cached, AVATAR_CX, 0, AVATAR_R, initials);
    return;
  }
  Assets.load(photoUrl)
    .then((tex) => {
      textureCache.set(photoUrl, tex);
      applyPhotoTexture(container, tex, AVATAR_CX, 0, AVATAR_R, initials);
    })
    .catch(() => { /* keep initials placeholder */ });
}

function createNodeSprite(
  node: GTreeNode,
  detailLevel: DetailLevel,
  selected: boolean,
  onSelect: ((id: string) => void) | undefined,
  palette: Palette,
): Container {
  const container = new Container();
  const ind = node.data!;
  const color = getSexColor(ind.sex);

  if (detailLevel === 'dot') {
    const gfx = new Graphics();
    gfx.circle(0, 0, 4).fill(color);
    container.addChild(gfx);
    return container;
  }

  if (detailLevel === 'simple') {
    const gfx = new Graphics();
    gfx.roundRect(-NODE_HALF_W, -NODE_HALF_H, NODE_W, NODE_H, 6).fill(color);
    container.addChild(gfx);
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointertap', () => onSelect?.(node.id));
    return container;
  }

  // Full detail
  const bg = new Graphics();
  const borderColor = selected ? 0x3b82f6 : color;
  const borderWidth = selected ? 3 : 2;
  bg.roundRect(-NODE_HALF_W, -NODE_HALF_H, NODE_W, NODE_H, 8)
    .stroke({ color: borderColor, width: borderWidth })
    .fill(palette.nodeBg);
  container.addChild(bg);

  // Avatar with primary photo (or initials fallback)
  const photoUrl = useMediaStore.getState().resolve(getPrimaryMediaFile(ind.media));
  addAvatar(container, ind, photoUrl, ind.sex, palette);

  const nameText = new Text({
    text: getDisplayName(ind),
    style: new TextStyle({
      fontSize: 11,
      fontWeight: '600',
      fill: palette.textPrimary,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      wordWrap: true,
      wordWrapWidth: NODE_W - 68,
      breakWords: true,
      lineHeight: 13,
    }),
  });
  nameText.position.set(-NODE_HALF_W + 58, -NODE_HALF_H + 8);
  container.addChild(nameText);

  const years = getLifeYears(ind);
  if (years) {
    const yearsText = new Text({
      text: years,
      style: new TextStyle({
        fontSize: 10,
        fill: palette.textSecondary,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }),
    });
    yearsText.position.set(-NODE_HALF_W + 58, NODE_HALF_H - 18);
    container.addChild(yearsText);
  }

  container.eventMode = 'static';
  container.cursor = 'pointer';
  container.on('pointertap', () => onSelect?.(node.id));

  return container;
}

function createAncestorStubSprite(detailLevel: DetailLevel, palette: Palette): Container {
  const container = new Container();
  if (detailLevel === 'dot') {
    const gfx = new Graphics();
    gfx.circle(0, 0, 3).fill(0x94a3b8);
    container.addChild(gfx);
    return container;
  }
  const PILL_W = 50, PILL_H = 22, GAP = 12;
  const gfx = new Graphics();
  // Left pill (ghost parent)
  gfx.roundRect(-GAP / 2 - PILL_W, -PILL_H / 2, PILL_W, PILL_H, 4)
     .stroke({ color: 0x94a3b8, width: 1.5 })
     .fill({ color: palette.nodeBg, alpha: 0.85 });
  // Right pill (ghost parent)
  gfx.roundRect(GAP / 2, -PILL_H / 2, PILL_W, PILL_H, 4)
     .stroke({ color: 0x94a3b8, width: 1.5 })
     .fill({ color: palette.nodeBg, alpha: 0.85 });
  // Connecting bar between pills
  gfx.moveTo(-GAP / 2, 0).lineTo(GAP / 2, 0).stroke({ color: 0x94a3b8, width: 1.5 });
  container.addChild(gfx);
  container.alpha = 0.75;
  return container;
}

function updateSelection(container: Container, node: GTreeNode, selected: boolean, darkMode?: boolean) {
  if (container.children.length === 0) return;
  const bg = container.getChildAt(0) as Graphics;
  if (!(bg instanceof Graphics)) return;

  const palette = darkMode ? DARK : LIGHT;
  const ind = node.data!;
  const color = getSexColor(ind.sex);
  const borderColor = selected ? 0x3b82f6 : color;
  const borderWidth = selected ? 3 : 2;

  bg.clear();
  bg.roundRect(-NODE_HALF_W, -NODE_HALF_H, NODE_W, NODE_H, 8)
    .stroke({ color: borderColor, width: borderWidth })
    .fill(palette.nodeBg);
}

function drawEdges(
  gfx: Graphics,
  world: Container,
  graph: GraphData,
  palette: Palette,
  families?: Map<string, Family>,
  selectedId?: string,
) {
  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

  // Families connected to the selected individual (highlighted edges)
  const highlighted = new Set<string>();
  if (selectedId) {
    const sel = nodeMap.get(selectedId)?.data;
    if (sel) {
      for (const f of sel.fams ?? []) highlighted.add(f);
      for (const f of sel.famc ?? []) highlighted.add(f);
    }
  }
  const HL_COLOR = 0x3b82f6;
  const HL_WIDTH = 3.5;

  // Marriage connections
  const familyLinks = new Map<string, typeof graph.links>();
  for (const link of graph.links) {
    if (link.type === 'marriage') {
      const existing = familyLinks.get(link.target) || [];
      existing.push(link);
      familyLinks.set(link.target, existing);
    }
  }

  for (const [famId, links] of familyLinks) {
    if (links.length >= 2) {
      const s1 = nodeMap.get(links[0].source);
      const s2 = nodeMap.get(links[1].source);
      if (s1?.x !== undefined && s1?.y !== undefined &&
          s2?.x !== undefined && s2?.y !== undefined) {
        const rawFamId = famId.replace(/^FAM_/, '');
        const isHl = highlighted.has(rawFamId);
        const color = isHl ? HL_COLOR : palette.edgeMarriage;
        const width = isHl ? HL_WIDTH : 2;
        const y = s1.y + NODE_HALF_H;
        const x1 = Math.min(s1.x, s2.x) + NODE_HALF_W;
        const x2 = Math.max(s1.x, s2.x) - NODE_HALF_W;
        gfx.moveTo(x1, y).lineTo(x2, y).stroke({ color, width });

        // Marriage year label centered on the bar
        const year = families?.get(rawFamId)?.marriage?.date?.year;
        if (year && x2 - x1 >= 24) {
          const label = new Text({
            text: String(year),
            style: new TextStyle({
              fontSize: 9,
              fontWeight: '600',
              fill: isHl ? color : palette.textSecondary,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }),
          });
          label.anchor.set(0.5);
          const labelBg = new Graphics();
          labelBg.roundRect(-13, -8, 26, 16, 8).fill(palette.nodeBg)
            .stroke({ color: isHl ? HL_COLOR : palette.edgeMarriage, width: isHl ? 1.5 : 1 });
          const labelWrap = new Container();
          labelWrap.addChild(labelBg);
          labelWrap.addChild(label);
          labelWrap.position.set((x1 + x2) / 2, y);
          world.addChild(labelWrap);
        }
      }
    }
  }

  // Child connections, grouped per family and drawn as a "sibling bus":
  // vertical drop from the family node, horizontal bus, drops to each child.
  // Families sharing the same gap get unique, evenly spaced bus heights so
  // their buses never merge into one ambiguous horizontal line. Junction dots
  // mark real connections; plain line crossings carry no dot.
  const childLinksByFam = new Map<string, typeof graph.links>();
  for (const link of graph.links) {
    if (link.type !== 'child') continue;
    const list = childLinksByFam.get(link.source) || [];
    list.push(link);
    childLinksByFam.set(link.source, list);
  }

  // First pass: compute geometry and group by generation gap
  interface Bus { famId: string; links: typeof graph.links; source: GTreeNode; startY: number; endY: number; slot: number }
  const buses: Bus[] = [];
  const gapTotals = new Map<string, number>();
  const gapSlots = new Map<string, number>();
  for (const [famId, links] of childLinksByFam) {
    const source = nodeMap.get(famId);
    if (!source || source.x === undefined || source.y === undefined) continue;
    const firstTarget = nodeMap.get(links[0].target);
    if (!firstTarget || firstTarget.y === undefined) continue;
    const startY = source.y + NODE_HALF_H;
    const endY = firstTarget.y - NODE_HALF_H;
    if (endY <= startY) continue;
    const gapKey = `${startY.toFixed(1)}|${endY.toFixed(1)}`;
    gapTotals.set(gapKey, (gapTotals.get(gapKey) ?? 0) + 1);
    buses.push({ famId, links, source, startY, endY, slot: gapSlots.size });
    gapSlots.set(famId, buses.length - 1);
  }

  // Second pass: draw with a per-gap slot
  const gapSeen = new Map<string, number>();
  for (const bus of buses) {
    const gapKey = `${bus.startY.toFixed(1)}|${bus.endY.toFixed(1)}`;
    const idx = gapSeen.get(gapKey) ?? 0;
    gapSeen.set(gapKey, idx + 1);
    const total = gapTotals.get(gapKey) ?? 1;
    const busY = bus.startY + (bus.endY - bus.startY) * ((idx + 1) / (total + 1));

    const rawFamId = bus.famId.replace(/^FAM_/, '');
    const isHl = highlighted.has(rawFamId);
    const color = isHl ? HL_COLOR : palette.edgeChild;
    const width = isHl ? HL_WIDTH : 2;

    const childXs = bus.links
      .map(l => nodeMap.get(l.target)?.x)
      .filter((x): x is number => x !== undefined);
    if (childXs.length === 0) continue;
    const minX = Math.min(bus.source.x, ...childXs);
    const maxX = Math.max(bus.source.x, ...childXs);

    // Drop from the family node to the bus + junction dot
    gfx.moveTo(bus.source.x, bus.startY).lineTo(bus.source.x, busY)
      .stroke({ color, width });
    gfx.circle(bus.source.x, busY, 3).fill(color);
    // Horizontal bus
    gfx.moveTo(minX, busY).lineTo(maxX, busY)
      .stroke({ color, width });
    // Drop to each child + junction dot
    for (const link of bus.links) {
      const target = nodeMap.get(link.target);
      if (!target || target.x === undefined || target.y === undefined) continue;
      gfx.moveTo(target.x, busY).lineTo(target.x, target.y - NODE_HALF_H)
        .stroke({ color, width });
      gfx.circle(target.x, busY, 3).fill(color);
    }
  }

  // Ancestor stub connections
  const STUB_HALF_H = 11; // half of PILL_H (22)
  for (const link of graph.links) {
    if (link.type !== 'ancestor-stub') continue;
    const source = nodeMap.get(link.source); // stub node
    const target = nodeMap.get(link.target); // individual
    if (!source || !target ||
        source.x === undefined || source.y === undefined ||
        target.x === undefined || target.y === undefined) continue;

    const startY = source.y + STUB_HALF_H;
    const endY = target.y - NODE_HALF_H;
    const midY = startY + (endY - startY) * 0.5;

    gfx.moveTo(source.x, startY)
       .lineTo(source.x, midY)
       .lineTo(target.x, midY)
       .lineTo(target.x, endY)
       .stroke({ color: 0x94a3b8, width: 1.5 });
  }
}
