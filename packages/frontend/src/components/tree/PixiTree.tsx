import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { GraphData, TreeNode as GTreeNode } from '@/visualization/dag-builder';
import { getVisibleNodes } from '@/visualization/viewport-culler';
import { getDisplayName, getLifeYears } from '@gedcom/shared';
import type { DetailLevel } from './FamilyTree';

interface PixiTreeProps {
  graph: GraphData;
  transform: { x: number; y: number; k: number };
  selectedId?: string;
  onSelect?: (id: string) => void;
  detailLevel: DetailLevel;
  darkMode?: boolean;
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

export function PixiTree({ graph, transform, selectedId, onSelect, detailLevel, darkMode }: PixiTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep latest props accessible inside effects without re-running them
  const graphRef = useRef(graph);
  const transformRef = useRef(transform);
  const selectedIdRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const detailLevelRef = useRef(detailLevel);
  const darkModeRef = useRef(darkMode);
  graphRef.current = graph;
  transformRef.current = transform;
  selectedIdRef.current = selectedId;
  onSelectRef.current = onSelect;
  detailLevelRef.current = detailLevel;
  darkModeRef.current = darkMode;

  // Pixi handles
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const nodeContainersRef = useRef<Map<string, Container>>(new Map());
  const readyRef = useRef(false);

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

      // Build initial scene
      rebuildScene(
        app, world, nodeContainersRef.current,
        graphRef.current, detailLevelRef.current,
        selectedIdRef.current, onSelectRef.current, darkModeRef.current,
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
      nodeContainersRef.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // init once

  // ─── Rebuild scene when graph, detailLevel, or darkMode changes ──────────
  useEffect(() => {
    if (!readyRef.current || !appRef.current || !worldRef.current) return;
    rebuildScene(
      appRef.current, worldRef.current, nodeContainersRef.current,
      graph, detailLevel, selectedId, onSelect, darkMode,
    );
    applyTransform(worldRef.current, transform);
    cullNodes(appRef.current, nodeContainersRef.current, graph, transform);
  }, [graph, detailLevel, darkMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Update selection highlight ───────────────────────────────────────────
  useEffect(() => {
    if (!readyRef.current || !worldRef.current) return;
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
    for (const [id, container] of nodeContainersRef.current) {
      const node = nodeMap.get(id);
      if (node?.data) updateSelection(container, node, id === selectedId, darkMode);
    }
  }, [selectedId, graph, darkMode]);

  // ─── Apply transform + culling ────────────────────────────────────────────
  useEffect(() => {
    if (!readyRef.current || !appRef.current || !worldRef.current) return;
    applyTransform(worldRef.current, transform);
    cullNodes(appRef.current, nodeContainersRef.current, graph, transform);
  }, [transform, graph]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
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
) {
  world.removeChildren();
  nodeContainers.clear();

  const palette = darkMode ? DARK : LIGHT;

  // Edges (single batched Graphics)
  const edgeGfx = new Graphics();
  world.addChild(edgeGfx);
  drawEdges(edgeGfx, graph, palette);

  // Nodes
  for (const node of graph.nodes) {
    if (node.type !== 'individual' || !node.data) continue;
    if (node.x === undefined || node.y === undefined) continue;

    const container = createNodeSprite(node, detailLevel, node.id === selectedId, onSelect, palette);
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

  const sidebar = new Graphics();
  sidebar.roundRect(-NODE_HALF_W, -NODE_HALF_H, 4, NODE_H, 2).fill(color);
  container.addChild(sidebar);

  const nameText = new Text({
    text: getDisplayName(ind).slice(0, 20),
    style: new TextStyle({
      fontSize: 12,
      fontWeight: '600',
      fill: palette.textPrimary,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }),
  });
  nameText.position.set(-NODE_HALF_W + 12, -NODE_HALF_H + 12);
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
    yearsText.position.set(-NODE_HALF_W + 12, -NODE_HALF_H + 30);
    container.addChild(yearsText);
  }

  container.eventMode = 'static';
  container.cursor = 'pointer';
  container.on('pointertap', () => onSelect?.(node.id));

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

function drawEdges(gfx: Graphics, graph: GraphData, palette: Palette) {
  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

  // Marriage connections
  const familyLinks = new Map<string, typeof graph.links>();
  for (const link of graph.links) {
    if (link.type === 'marriage') {
      const existing = familyLinks.get(link.target) || [];
      existing.push(link);
      familyLinks.set(link.target, existing);
    }
  }

  for (const [, links] of familyLinks) {
    if (links.length >= 2) {
      const s1 = nodeMap.get(links[0].source);
      const s2 = nodeMap.get(links[1].source);
      if (s1?.x !== undefined && s1?.y !== undefined &&
          s2?.x !== undefined && s2?.y !== undefined) {
        const y = s1.y + NODE_HALF_H;
        const x1 = Math.min(s1.x, s2.x) + NODE_HALF_W;
        const x2 = Math.max(s1.x, s2.x) - NODE_HALF_W;
        gfx.moveTo(x1, y).lineTo(x2, y).stroke({ color: palette.edgeMarriage, width: 2 });
      }
    }
  }

  // Child connections
  for (const link of graph.links) {
    if (link.type !== 'child') continue;
    const source = nodeMap.get(link.source);
    const target = nodeMap.get(link.target);
    if (!source || !target ||
        source.x === undefined || source.y === undefined ||
        target.x === undefined || target.y === undefined) continue;

    const startY = source.y + NODE_HALF_H;
    const endY = target.y - NODE_HALF_H;
    const midY = startY + (endY - startY) * 0.5;

    gfx.moveTo(source.x, startY)
       .lineTo(source.x, midY)
       .lineTo(target.x, midY)
       .lineTo(target.x, endY)
       .stroke({ color: palette.edgeChild, width: 2 });
  }
}
