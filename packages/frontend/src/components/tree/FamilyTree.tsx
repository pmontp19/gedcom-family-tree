import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import * as d3 from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import type { GedcomData, Individual } from '@gedcom/shared';
import { buildDAG, calculateBounds } from '@/visualization';
import type { GraphData } from '@/visualization';
import { useLayoutWorker } from '@/hooks/useLayoutWorker';
import type { NodePosition } from '@/visualization/worker-types';
import { PixiTree } from './PixiTree';

interface FamilyTreeProps {
  data: GedcomData;
  selectedId?: string;
  onSelect?: (individual: Individual) => void;
  darkMode?: boolean;
}

export interface FamilyTreeRef {
  resetView: () => void;
}

const NODE_WIDTH = 160;
const NODE_HEIGHT = 60;

export type DetailLevel = 'full' | 'simple' | 'dot';

function getDetailLevel(k: number): DetailLevel {
  if (k >= 0.5) return 'full';
  if (k >= 0.15) return 'simple';
  return 'dot';
}

export const FamilyTree = forwardRef<FamilyTreeRef, FamilyTreeProps>(
  function FamilyTree({ data, selectedId, onSelect, darkMode }, ref) {
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const [graph, setGraph] = useState<GraphData | null>(null);
    const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
    const [layoutPending, setLayoutPending] = useState(false);
    const zoomBehaviorRef = useRef<ReturnType<typeof zoom<HTMLDivElement, unknown>> | null>(null);
    const { runLayout } = useLayoutWorker();

    // Build DAG on main thread (cheap), layout on worker
    useEffect(() => {
      let cancelled = false;
      setLayoutPending(true);
      try {
        const rawGraph = buildDAG(data);
        runLayout(rawGraph).then((positions: NodePosition[]) => {
          if (cancelled) return;
          // Apply positions back to nodes
          const posMap = new Map(positions.map(p => [p.id, p]));
          for (const node of rawGraph.nodes) {
            const pos = posMap.get(node.id);
            if (pos) { node.x = pos.x; node.y = pos.y; }
          }
          setGraph(rawGraph);
          setLayoutPending(false);
        }).catch((err) => {
          if (cancelled) return;
          console.error('Worker layout failed:', err);
          setLayoutPending(false);
        });
      } catch (e) {
        console.error('Build DAG failed:', e);
        setLayoutPending(false);
      }
      return () => { cancelled = true; };
    }, [data, runLayout]);

    const fitToView = useCallback(() => {
      if (!canvasContainerRef.current || !graph || !zoomBehaviorRef.current) return;

      const container = canvasContainerRef.current;
      const sel = d3.select(container);

      const individualNodes = graph.nodes.filter(n => n.type === 'individual');
      if (individualNodes.length === 0) return;

      const bounds = calculateBounds(graph, NODE_WIDTH, NODE_HEIGHT);
      const containerRect = container.getBoundingClientRect();
      const cw = Math.max(containerRect.width, 200);
      const ch = Math.max(containerRect.height, 200);
      const fitScale = Math.min(
        (cw - 100) / (bounds.width + NODE_WIDTH),
        (ch - 100) / (bounds.height + NODE_HEIGHT),
        1
      );
      const MIN_SCALE = 0.18;
      const scale = Math.max(fitScale, MIN_SCALE);
      const centerX = fitScale >= MIN_SCALE
        ? (cw - bounds.width * scale) / 2 - bounds.minX * scale
        : 60 - bounds.minX * scale;
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

      const zoomBehavior = zoom<HTMLDivElement, unknown>()
        .scaleExtent([0.02, 3])
        .on('zoom', (event) => {
          setTransform({
            x: event.transform.x,
            y: event.transform.y,
            k: event.transform.k,
          });
        });

      zoomBehaviorRef.current = zoomBehavior;
      sel.call(zoomBehavior);

      // Fit to container on initial load
      const individualNodes = graph.nodes.filter(n => n.type === 'individual');
      if (individualNodes.length > 0) {
        const bounds = calculateBounds(graph, NODE_WIDTH, NODE_HEIGHT);
        const containerRect = container.getBoundingClientRect();
        const cw = Math.max(containerRect.width, 200);
        const ch = Math.max(containerRect.height, 200);
        const fitScale = Math.min(
          (cw - 100) / (bounds.width + NODE_WIDTH),
          (ch - 100) / (bounds.height + NODE_HEIGHT),
          1
        );
        const MIN_SCALE = 0.18;
        const scale = Math.max(fitScale, MIN_SCALE);
        const centerX = fitScale >= MIN_SCALE
          ? (cw - bounds.width * scale) / 2 - bounds.minX * scale
          : 60 - bounds.minX * scale;
        const centerY = (ch - bounds.height * scale) / 2 - bounds.minY * scale;

        sel.call(zoomBehavior.transform, zoomIdentity.translate(centerX, centerY).scale(scale));
      }

      return () => {
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
        className="w-full h-full overflow-hidden bg-slate-50 dark:bg-slate-900 cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
      >
        <PixiTree
          graph={graph}
          transform={transform}
          selectedId={selectedId}
          onSelect={handleNodeClick}
          detailLevel={detailLevel}
          darkMode={darkMode}
        />
      </div>
    );
  }
);
