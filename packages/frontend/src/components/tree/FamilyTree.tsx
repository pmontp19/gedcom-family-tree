import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import * as d3 from 'd3-selection';
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
import type { GedcomData, Individual } from '@gedcom/shared';
import { buildDAG, calculateBounds } from '@/visualization';
import { GEN_H } from '@/visualization/dag-builder';
import type { GraphData } from '@/visualization';
import { NODE_W, NODE_H, getTreeTheme, hexString } from '@/visualization/theme';
import type { ThemeId } from '@/visualization/theme';
import { useLayoutWorker } from '@/hooks/useLayoutWorker';
import { PixiTree } from './PixiTree';

interface FamilyTreeProps {
  data: GedcomData;
  selectedId?: string;
  onSelect?: (individual: Individual) => void;
  themeId?: ThemeId;
}

export interface FamilyTreeRef {
  resetView: () => void;
}

export type DetailLevel = 'full' | 'simple' | 'dot';

function getDetailLevel(k: number): DetailLevel {
  if (k >= 0.5) return 'full';
  if (k >= 0.15) return 'simple';
  return 'dot';
}

export const FamilyTree = forwardRef<FamilyTreeRef, FamilyTreeProps>(
  function FamilyTree({ data, selectedId, onSelect, themeId }, ref) {
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const [graph, setGraph] = useState<GraphData | null>(null);
    const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
    const [layoutPending, setLayoutPending] = useState(true);
    const zoomBehaviorRef = useRef<ReturnType<typeof zoom<HTMLDivElement, unknown>> | null>(null);
    const { runLayout } = useLayoutWorker();

    // Reset layout state when the data changes (during render, not in an effect)
    const [prevData, setPrevData] = useState(data);
    if (data !== prevData) {
      setPrevData(data);
      setGraph(null);
      setLayoutPending(true);
    }

    // Build DAG on main thread (cheap), layout on worker
    useEffect(() => {
      let cancelled = false;

      const buildAndLayout = async () => {
        try {
          const rawGraph = buildDAG(data);
          const positions = await runLayout(rawGraph);
          if (cancelled) return;

          // Apply positions back to nodes
          const posMap = new Map(positions.map(p => [p.id, p]));
          for (const node of rawGraph.nodes) {
            const pos = posMap.get(node.id);
            if (pos) { node.x = pos.x; node.y = pos.y; }
          }

          // Detect boundary individuals whose parents aren't in the subgraph
          const hiddenFamGroups = new Map<string, string[]>();
          for (const node of rawGraph.nodes) {
            if (node.type !== 'individual' || !node.data) continue;
            for (const famc of node.data.famc) {
              if (famc && !data.families.get(famc)) {
                const group = hiddenFamGroups.get(famc) ?? [];
                group.push(node.id);
                hiddenFamGroups.set(famc, group);
              }
            }
          }
          // Insert phantom stub nodes + links
          if (hiddenFamGroups.size > 0) {
            const nodeById = new Map(rawGraph.nodes.map(n => [n.id, n]));
            for (const [famId, indIds] of hiddenFamGroups) {
              const stubId = `STUB_FAM_${famId}`;
              const children = indIds.map(id => nodeById.get(id)).filter(Boolean);
              const xs = children.map(c => c!.x ?? 0);
              const midX = xs.reduce((a, b) => a + b, 0) / xs.length;
              const minY = Math.min(...children.map(c => c!.y ?? 0));
              rawGraph.nodes.push({ id: stubId, data: null, type: 'family', isAncestorStub: true, x: midX, y: minY - GEN_H });
              for (const indId of indIds) {
                rawGraph.links.push({ source: stubId, target: indId, type: 'ancestor-stub' });
              }
            }
          }

          setGraph(rawGraph);
          setLayoutPending(false);
        } catch (err) {
          if (cancelled) return;
          console.error('Tree layout failed:', err);
          setLayoutPending(false);
        }
      };

      buildAndLayout();
      return () => { cancelled = true; };
    }, [data, runLayout]);

    const fitToView = useCallback(() => {
      if (!canvasContainerRef.current || !graph || !zoomBehaviorRef.current) return;

      const container = canvasContainerRef.current;
      const sel = d3.select(container);

      const individualNodes = graph.nodes.filter(n => n.type === 'individual');
      if (individualNodes.length === 0) return;

      const bounds = calculateBounds(graph, NODE_W, NODE_H);
      const containerRect = container.getBoundingClientRect();
      const cw = Math.max(containerRect.width, 200);
      const ch = Math.max(containerRect.height, 200);
      const fitScale = Math.min(
        (cw - 100) / (bounds.width + NODE_W),
        (ch - 100) / (bounds.height + NODE_H),
        1
      );
      const scale = Math.max(fitScale, 0.02);
      const centerX = (cw - bounds.width * scale) / 2 - bounds.minX * scale;
      const centerY = (ch - bounds.height * scale) / 2 - bounds.minY * scale;

      sel.call(
        zoomBehaviorRef.current.transform,
        zoomIdentity.translate(centerX, centerY).scale(scale)
      );
    }, [graph]);

    useImperativeHandle(ref, () => ({
      resetView: fitToView,
    }), [fitToView]);

    // Set up d3-zoom on the container div (works with canvas)
    useEffect(() => {
      if (!canvasContainerRef.current || !graph) return;

      const container = canvasContainerRef.current;
      const sel = d3.select(container);

      const individualNodes = graph.nodes.filter(n => n.type === 'individual');
      const bounds = calculateBounds(graph, NODE_W, NODE_H);
      const containerRect = container.getBoundingClientRect();
      const cw = Math.max(containerRect.width, 200);
      const ch = Math.max(containerRect.height, 200);

      const fitScale = individualNodes.length > 0
        ? Math.min(
            (cw - 100) / (bounds.width + NODE_W),
            (ch - 100) / (bounds.height + NODE_H),
            1
          )
        : 0.5;
      const MIN_SCALE = Math.max(fitScale * 0.9, 0.02);
      const PADDING = Math.max(NODE_W * 2, 300);

      const zoomBehavior = zoom<HTMLDivElement, unknown>()
        // Figma-style navigation: plain scroll pans (handled manually below),
        // pinch / ctrl+scroll zooms through d3.
        .filter((event) => {
          if (event.type === 'wheel') return event.ctrlKey || event.metaKey;
          return (!event.ctrlKey || event.type === 'wheel') && !event.button;
        })
        .scaleExtent([MIN_SCALE, 3])
        .translateExtent([
          [bounds.minX - PADDING, bounds.minY - PADDING],
          [bounds.maxX + PADDING, bounds.maxY + PADDING],
        ])
        .on('zoom', (event) => {
          setTransform({
            x: event.transform.x,
            y: event.transform.y,
            k: event.transform.k,
          });
        });

      zoomBehaviorRef.current = zoomBehavior;
      sel.call(zoomBehavior);

      const onWheel = (event: WheelEvent) => {
        if (event.ctrlKey || event.metaKey) return; // pinch / ctrl+scroll -> d3 zoom
        event.preventDefault();
        // translateBy applies the translateExtent (zoom.transform would not)
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? container.clientHeight : 1;
        const k = zoomTransform(container).k;
        sel.call(
          zoomBehavior.translateBy,
          -event.deltaX * unit / k,
          -event.deltaY * unit / k
        );
      };
      container.addEventListener('wheel', onWheel, { passive: false });

      // Fit to container on initial load
      if (individualNodes.length > 0) {
        const scale = Math.max(fitScale, MIN_SCALE);
        const centerX = (cw - bounds.width * scale) / 2 - bounds.minX * scale;
        const centerY = (ch - bounds.height * scale) / 2 - bounds.minY * scale;

        sel.call(zoomBehavior.transform, zoomIdentity.translate(centerX, centerY).scale(scale));
      }

      return () => {
        container.removeEventListener('wheel', onWheel);
        sel.on('.zoom', null);
      };
    }, [graph]);

    const handleNodeClick = useCallback((id: string) => {
      const ind = data.individuals.get(id);
      if (ind) onSelect?.(ind);
    }, [onSelect, data]);

    const detailLevel = getDetailLevel(transform.k);

    if (layoutPending) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            <span>Computing layout…</span>
          </div>
        </div>
      );
    }

    if (!graph || graph.nodes.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          No data to display
        </div>
      );
    }

    return (
      <div
        ref={canvasContainerRef}
        className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none', background: hexString(getTreeTheme(themeId).canvasBg) }}
      >
        <PixiTree
          graph={graph}
          transform={transform}
          selectedId={selectedId}
          onSelect={handleNodeClick}
          detailLevel={detailLevel}
          themeId={themeId}
        />
      </div>
    );
  }
);
