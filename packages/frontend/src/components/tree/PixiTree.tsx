import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Individual } from '@gedcom/shared';
import { getDisplayName, getLifeYears } from '@gedcom/shared';
import type { GraphData, TreeNode as GTreeNode } from '@/visualization/dag-builder';
import { getVisibleNodes } from '@/visualization/viewport-culler';
import { NODE_W, NODE_H, NODE_RADIUS, getTreeTheme, lighten } from "@/visualization/theme";
import type { ThemeId, TreeTheme, TreePalette } from "@/visualization/theme";
import type { DetailLevel } from './FamilyTree';

interface PixiTreeProps {
  graph: GraphData;
  transform: { x: number; y: number; k: number };
  selectedId?: string;
  onSelect?: (id: string) => void;
  detailLevel: DetailLevel;
  themeId?: ThemeId;
}

const HALF_W = NODE_W / 2;
const HALF_H = NODE_H / 2;
const AVATAR_R = 22;
const AVATAR_CX = -HALF_W + 34;
const NAME_X = AVATAR_CX + AVATAR_R + 14;
const NAME_MAX_W = HALF_W - 14 - NAME_X;
const ELBOW_R = 12;
const STUB_HALF_H = 11;

const FONT = 'system-ui, -apple-system, sans-serif';

const nameStyle = new TextStyle({
  fontSize: 13,
  fontWeight: '600',
  fill: 0xffffff,
  fontFamily: FONT,
  breakWords: false,
});

const yearsStyle = new TextStyle({
  fontSize: 11,
  fontWeight: '400',
  fill: 0xffffff,
  fontFamily: FONT,
});

const initialsStyle = new TextStyle({
  fontSize: 16,
  fontWeight: '700',
  fill: 0xffffff,
  fontFamily: FONT,
  letterSpacing: 1,
});

const badgeStyle = new TextStyle({
  fontSize: 10.5,
  fontWeight: '500',
  fill: 0xffffff,
  fontFamily: FONT,
  letterSpacing: 0.5,
});

type NodeContainer = Container & { __redrawCard?: (selected: boolean) => void };

// Native canvas text measurement (Pixi v8 renders text with the same engine)
const measureCtx = document.createElement('canvas').getContext('2d');

function textWidth(text: string, style: TextStyle): number {
  if (!measureCtx) return text.length * style.fontSize * 0.6;
  measureCtx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
  let w = measureCtx.measureText(text).width;
  if (style.letterSpacing) w += style.letterSpacing * Math.max(0, text.length - 1);
  return w;
}

export function PixiTree({ graph, transform, selectedId, onSelect, detailLevel, themeId }: PixiTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const graphRef = useRef(graph);
  const transformRef = useRef(transform);
  const selectedIdRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const detailLevelRef = useRef(detailLevel);
  const themeRef = useRef(themeId);

  // Mirror latest props into refs (outside render) for the async init path
  useEffect(() => {
    graphRef.current = graph;
    transformRef.current = transform;
    selectedIdRef.current = selectedId;
    onSelectRef.current = onSelect;
    detailLevelRef.current = detailLevel;
    themeRef.current = themeId;
  });

  // Pixi handles
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const nodeContainersRef = useRef<Map<string, Container>>(new Map());
  const readyRef = useRef(false);

  // ─── Init PixiJS once ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const nodeContainers = nodeContainersRef.current;

    const nodeContainers = nodeContainersRef.current;
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

      // Build initial scene
      rebuildScene(
        app, world, nodeContainersRef.current,
        graphRef.current, detailLevelRef.current,
        selectedIdRef.current, onSelectRef.current, themeRef.current,
      );

      // Apply initial transform
      applyTransform(world, transformRef.current);
      cullNodes(app, nodeContainersRef.current, graphRef.current, transformRef.current);
    }).catch(console.error);

    return () => {
      destroyed = true;
      readyRef.current = false;
      if (appRef.current) {
        // If init completed, this is safe. If not, the .then() above handles it.
        try { appRef.current.destroy(true, { children: true }); } catch { /* ignore */ }
        appRef.current = null;
      }
      worldRef.current = null;
      nodeContainers.clear();
    };
  }, []); // init once

  // ─── Rebuild scene when graph, detailLevel, or themeId changes ──────────
  useEffect(() => {
    if (!readyRef.current || !appRef.current || !worldRef.current) return;
    rebuildScene(
      appRef.current, worldRef.current, nodeContainersRef.current,
      graph, detailLevel, selectedId, onSelect, themeId,
    );
    applyTransform(worldRef.current, transform);
    cullNodes(appRef.current, nodeContainersRef.current, graph, transform);
  }, [graph, detailLevel, themeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Update selection highlight ───────────────────────────────────────────
  useEffect(() => {
    if (!readyRef.current || !worldRef.current) return;
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
    for (const [id, container] of nodeContainersRef.current) {
      const node = nodeMap.get(id);
      if (node) (container as NodeContainer).__redrawCard?.(id === selectedId);
    }
  }, [selectedId, graph, themeId]);

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
  themeId?: ThemeId,
) {
  world.removeChildren();
  nodeContainers.clear();

  const theme = getTreeTheme(themeId);
  const palette = theme.palette;

  // Edges (single batched Graphics)
  const edgeGfx = new Graphics();
  world.addChild(edgeGfx);
  drawEdges(edgeGfx, graph, palette);

  // Marriage year badges (sit above the edges)
  const badgeLayer = new Container();
  world.addChild(badgeLayer);
  drawMarriageBadges(badgeLayer, graph, palette);

  // Nodes
  for (const node of graph.nodes) {
    if (node.type !== 'individual' || !node.data) continue;
    if (node.x === undefined || node.y === undefined) continue;

    const container = createNodeSprite(node, detailLevel, node.id === selectedId, onSelect, theme);
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

function getInitials(ind: Individual): string {
  const given = ind.name?.given?.charAt(0) ?? '';
  const surname = ind.name?.surname?.charAt(0) ?? '';
  if (given && surname) return `${given}${surname}`.toUpperCase();
  if (given) return given.toUpperCase();
  return getDisplayName(ind).slice(0, 2).toUpperCase();
}

function wrapName(text: string, maxWidth: number, style: TextStyle, maxLines = 2): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  let truncated = false;

  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (textWidth(test, style) <= maxWidth) {
      cur = test;
      continue;
    }
    if (cur) {
      lines.push(cur);
      cur = word;
      if (lines.length === maxLines) { cur = ''; truncated = true; break; }
    } else {
      // Single word wider than the line: hard-break it
      let chunk = word;
      while (chunk.length > 1 && textWidth(chunk, style) > maxWidth) {
        chunk = chunk.slice(0, -1);
      }
      cur = chunk;
      truncated = true;
    }
  }
  if (cur) {
    if (lines.length < maxLines) lines.push(cur);
    else truncated = true;
  }

  if (truncated && lines.length > 0) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && textWidth(`${last}…`, style) > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

function drawCard(
  g: Graphics,
  opts: { sexColor: number; selected: boolean; hovered: boolean; palette: TreePalette },
) {
  const { sexColor, selected, hovered, palette } = opts;
  g.clear();

  if (selected) {
    // Soft outer glow
    const glowPad = 5;
    g.roundRect(-HALF_W - glowPad, -HALF_H - glowPad, NODE_W + glowPad * 2, NODE_H + glowPad * 2, NODE_RADIUS + glowPad)
      .stroke({ color: sexColor, width: 9, alpha: 0.16 });
  }

  const borderColor = selected ? lighten(sexColor, 0.25) : hovered ? lighten(sexColor, 0.12) : sexColor;
  g.roundRect(-HALF_W, -HALF_H, NODE_W, NODE_H, NODE_RADIUS)
    .fill(palette.nodeBg)
    .stroke({ color: borderColor, width: selected ? 2.5 : 2, join: 'round' });
}

function createNodeSprite(
  node: GTreeNode,
  detailLevel: DetailLevel,
  selected: boolean,
  onSelect: ((id: string) => void) | undefined,
  theme: TreeTheme,
): NodeContainer {
  const container = new Container() as NodeContainer;
  const ind = node.data!;
  const palette = theme.palette;
  const sexColor = theme.sexColors[ind.sex ?? "U"];

  if (detailLevel === 'dot') {
    const gfx = new Graphics();
    gfx.circle(0, 0, 4.5).fill(sexColor);
    container.addChild(gfx);
    return container;
  }

  if (detailLevel === 'simple') {
    const gfx = new Graphics();
    gfx.roundRect(-HALF_W, -HALF_H, NODE_W, NODE_H, NODE_RADIUS)
      .fill(palette.nodeBg)
      .stroke({ color: sexColor, width: 2, join: 'round' });
    container.addChild(gfx);
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointertap', () => onSelect?.(node.id));
    return container;
  }

  // Full detail
  let hovered = false;
  let selectedNow = selected;

  const cardGfx = new Graphics();
  const redraw = () => drawCard(cardGfx, { sexColor, selected: selectedNow, hovered, palette });
  redraw();
  container.addChild(cardGfx);

  // Avatar
  const avatar = new Graphics();
  avatar.circle(AVATAR_CX, 0, AVATAR_R)
    .fill(palette.avatarBg)
    .stroke({ color: sexColor, width: 2.5 });
  container.addChild(avatar);

  const initials = new Text({
    text: getInitials(ind),
    style: initialsStyle.clone(),
  });
  initials.style.fill = palette.avatarText;
  initials.anchor.set(0.5, 0.5);
  initials.position.set(AVATAR_CX, -0.5);
  container.addChild(initials);

  // Name + life years, vertically centered as a block
  const nameLines = wrapName(getDisplayName(ind), NAME_MAX_W, nameStyle, 2);
  const years = getLifeYears(ind);
  const LINE_H = 17;
  const contentH = nameLines.length * LINE_H + (years ? 15 : 0);
  const contentTop = -contentH / 2;

  nameLines.forEach((line, i) => {
    const style = nameStyle.clone();
    style.fill = palette.textPrimary;
    const t = new Text({ text: line, style });
    t.anchor.set(0, 0.5);
    t.position.set(NAME_X, contentTop + LINE_H / 2 + i * LINE_H);
    container.addChild(t);
  });

  if (years) {
    const style = yearsStyle.clone();
    style.fill = palette.textMuted;
    const yearsText = new Text({ text: years, style });
    yearsText.anchor.set(0, 0.5);
    yearsText.position.set(NAME_X, contentTop + nameLines.length * LINE_H + 7.5);
    container.addChild(yearsText);
  }

  (container as NodeContainer).__redrawCard = (sel: boolean) => {
    selectedNow = sel;
    redraw();
  };

  container.eventMode = 'static';
  container.cursor = 'pointer';
  container.on('pointertap', () => onSelect?.(node.id));
  container.on('pointerover', () => { hovered = true; redraw(); });
  container.on('pointerout', () => { hovered = false; redraw(); });

  return container;
}

function createAncestorStubSprite(detailLevel: DetailLevel, palette: TreePalette): Container {
  const container = new Container();
  if (detailLevel === 'dot') {
    const gfx = new Graphics();
    gfx.circle(0, 0, 3).fill(palette.edgeMarriage);
    container.addChild(gfx);
    return container;
  }
  const PILL_W = 50, PILL_H = 22, GAP = 12;
  const gfx = new Graphics();
  // Left pill (ghost parent)
  gfx.roundRect(-GAP / 2 - PILL_W, -PILL_H / 2, PILL_W, PILL_H, 7)
     .stroke({ color: palette.stubStroke, width: 1.5 })
     .fill({ color: palette.stubFill, alpha: 0.85 });
  // Right pill (ghost parent)
  gfx.roundRect(GAP / 2, -PILL_H / 2, PILL_W, PILL_H, 7)
     .stroke({ color: palette.stubStroke, width: 1.5 })
     .fill({ color: palette.stubFill, alpha: 0.85 });
  // Connecting bar between pills
  gfx.moveTo(-GAP / 2, 0).lineTo(GAP / 2, 0).stroke({ color: palette.stubStroke, width: 1.5, cap: 'round' });
  container.addChild(gfx);
  container.alpha = 0.8;
  return container;
}

interface FamilyEdgeGroup {
  famNodeId: string;
  famNode?: GTreeNode;
  spouses: GTreeNode[];
  children: GTreeNode[];
}

function groupFamilyEdges(graph: GraphData): FamilyEdgeGroup[] {
  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
  const groups = new Map<string, FamilyEdgeGroup>();

  const group = (famNodeId: string) =>
    groups.get(famNodeId) ?? { famNodeId, famNode: nodeMap.get(famNodeId), spouses: [], children: [] };

  for (const link of graph.links) {
    if (link.type === 'marriage') {
      const g = group(link.target);
      const spouse = nodeMap.get(link.source);
      if (spouse) g.spouses.push(spouse);
      groups.set(link.target, g);
    } else if (link.type === 'child') {
      const g = group(link.source);
      const child = nodeMap.get(link.target);
      if (child) g.children.push(child);
      groups.set(link.source, g);
    }
  }
  return [...groups.values()];
}

function drawEdges(gfx: Graphics, graph: GraphData, palette: TreePalette) {
  for (const group of groupFamilyEdges(graph)) {
    const { spouses, children, famNode } = group;
    const positioned = spouses.filter(s => s.x !== undefined && s.y !== undefined);

    // Marriage bar: between the two spouses, aligned with the card bottom edge
    let famX: number;
    let barY: number;
    if (positioned.length === 0) {
      // Family with children but no spouses: drop from the family connector node
      if (children.length === 0 || !famNode ||
          famNode.x === undefined || famNode.y === undefined) continue;
      famX = famNode.x;
      barY = famNode.y + HALF_H;
    } else if (positioned.length >= 2) {
      const [a, b] = positioned;
      const left = (a.x ?? 0) < (b.x ?? 0) ? a : b;
      const right = left === a ? b : a;
      barY = (left.y ?? 0) + HALF_H;
      const x1 = (left.x ?? 0) + HALF_W;
      const x2 = (right.x ?? 0) - HALF_W;
      famX = ((left.x ?? 0) + (right.x ?? 0)) / 2;
      if (x2 > x1) {
        gfx.moveTo(x1, barY).lineTo(x2, barY)
          .stroke({ color: palette.edgeMarriage, width: 3.5, cap: 'round' });
      }
    } else {
      famX = positioned[0].x ?? 0;
      barY = (positioned[0].y ?? 0) + HALF_H;
    }

    if (children.length === 0) continue;

    // Drop from the marriage bar down to the sibling bus, then rounded elbows into each child
    const sorted = [...children].sort((c1, c2) => (c1.y ?? 0) - (c2.y ?? 0));
    const first = sorted[0];
    const busY = barY + ((first.y ?? 0) - HALF_H - barY) * 0.5;
    if (busY <= barY + 4) continue; // no vertical room below the bar (degenerate layout)

    let hasOffsetChild = false;
    for (const child of sorted) {
      const cx = child.x ?? 0;
      const endY = (child.y ?? 0) - HALF_H;
      if (endY <= busY) continue;
      if (Math.abs(cx - famX) < 1) {
        gfx.moveTo(famX, busY).lineTo(famX, endY)
          .stroke({ color: palette.edgeChild, width: 2.5, cap: 'round' });
        continue;
      }
      hasOffsetChild = true;
      const dir = Math.sign(cx - famX);
      gfx.moveTo(famX, busY)
        .lineTo(cx - dir * ELBOW_R, busY)
        .quadraticCurveTo(cx, busY, cx, busY + ELBOW_R)
        .lineTo(cx, endY)
        .stroke({ color: palette.edgeChild, width: 2.5, cap: 'round', join: 'round' });
    }

    // Vertical drop from the bar to the bus
    gfx.moveTo(famX, barY).lineTo(famX, busY)
      .stroke({ color: palette.edgeChild, width: 2.5, cap: 'round' });

    // Junction dot where the drop meets the sibling bus
    if (hasOffsetChild) {
      gfx.circle(famX, busY, 4.5).fill(palette.edgeMarriage);
    }
  }

  // Ancestor stub connections
  for (const link of graph.links) {
    if (link.type !== 'ancestor-stub') continue;
    const source = graph.nodes.find(n => n.id === link.source); // stub node
    const target = graph.nodes.find(n => n.id === link.target); // individual
    if (!source || !target ||
        source.x === undefined || source.y === undefined ||
        target.x === undefined || target.y === undefined) continue;

    const startY = source.y + STUB_HALF_H;
    const endY = target.y - HALF_H;
    const busY = startY + (endY - startY) * 0.5;
    const sx = source.x;
    const tx = target.x;

    if (Math.abs(tx - sx) < 1) {
      gfx.moveTo(sx, startY).lineTo(sx, endY)
        .stroke({ color: palette.edgeChild, width: 2, cap: 'round' });
      continue;
    }
    const dir = Math.sign(tx - sx);
    gfx.moveTo(sx, startY)
      .lineTo(sx, busY - ELBOW_R)
      .quadraticCurveTo(sx, busY, sx - dir * ELBOW_R, busY)
      .lineTo(tx + dir * ELBOW_R, busY)
      .quadraticCurveTo(tx, busY, tx, busY - ELBOW_R)
      .lineTo(tx, endY)
      .stroke({ color: palette.edgeChild, width: 2, cap: 'round', join: 'round' });
  }
}

function drawMarriageBadges(layer: Container, graph: GraphData, palette: TreePalette) {
  for (const group of groupFamilyEdges(graph)) {
    if (group.spouses.length < 2) continue;
    const [a, b] = group.spouses;
    if (a?.x === undefined || b?.x === undefined || a?.y === undefined) continue;

    const fam = graph.families.get(group.famNodeId);
    const year = fam?.marriage?.date?.year;
    if (!year) continue;

    const famX = (a.x + b.x) / 2;
    const barY = a.y + HALF_H;
    const y = barY + 27;

    const label = new Text({ text: String(year), style: badgeStyle.clone() });
    label.style.fill = palette.badgeText;
    const textW = textWidth(String(year), badgeStyle);
    const w = Math.ceil(textW) + 18;
    const h = 19;

    const gfx = new Graphics();
    gfx.roundRect(-w / 2, -h / 2, w, h, h / 2)
      .fill(palette.badgeBg)
      .stroke({ color: palette.badgeBorder, width: 1.5 });
    layer.addChild(gfx);

    label.anchor.set(0.5, 0.5);
    label.position.set(0, 0);
    const badge = new Container();
    badge.addChild(gfx, label);
    badge.position.set(famX, y);
    layer.addChild(badge);
  }
}
