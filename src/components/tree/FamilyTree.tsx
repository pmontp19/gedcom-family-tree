import { useEffect, useRef, useCallback, useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import * as d3 from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import type { GedcomData, Individual } from '@/models';
import { buildDAG, layoutDAG, calculateBounds } from '@/visualization';
import type { GraphData } from '@/visualization';
import { TreeNode } from './TreeNode';

interface FamilyTreeProps {
  data: GedcomData;
  selectedId?: string;
  onSelect?: (individual: Individual) => void;
}

export interface FamilyTreeRef {
  resetView: () => void;
}

const NODE_WIDTH = 160;
const NODE_HEIGHT = 60;

export const FamilyTree = forwardRef<FamilyTreeRef, FamilyTreeProps>(
  function FamilyTree({ data, selectedId, onSelect }, ref) {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [graph, setGraph] = useState<GraphData | null>(null);
    const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
    const zoomBehaviorRef = useRef<ReturnType<typeof zoom<SVGSVGElement, unknown>> | null>(null);

    useEffect(() => {
      const rawGraph = buildDAG(data);
      const layoutedGraph = layoutDAG(rawGraph);
      setGraph(layoutedGraph);
    }, [data]);

    const fitToView = useCallback(() => {
      if (!svgRef.current || !containerRef.current || !graph || !zoomBehaviorRef.current) return;

      const svg = d3.select(svgRef.current);
      const container = containerRef.current;

      const individualNodes = graph.nodes.filter(n => n.type === 'individual');
      if (individualNodes.length === 0) return;

      const bounds = calculateBounds(graph, NODE_WIDTH, NODE_HEIGHT);
      const containerRect = container.getBoundingClientRect();
      const scale = Math.min(
        (containerRect.width - 100) / (bounds.width + NODE_WIDTH),
        (containerRect.height - 100) / (bounds.height + NODE_HEIGHT),
        1
      );
      const centerX = (containerRect.width - bounds.width * scale) / 2 - bounds.minX * scale;
      const centerY = (containerRect.height - bounds.height * scale) / 2 - bounds.minY * scale;

      svg.call(
        zoomBehaviorRef.current.transform,
        zoomIdentity.translate(centerX, centerY).scale(scale)
      );
    }, [graph]);

    useImperativeHandle(ref, () => ({
      resetView: fitToView,
    }), [fitToView]);

    useEffect(() => {
      if (!svgRef.current || !containerRef.current || !graph) return;

      const svg = d3.select(svgRef.current);
      const container = containerRef.current;

      const zoomBehavior = zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 3])
        .on('zoom', (event) => {
          setTransform({
            x: event.transform.x,
            y: event.transform.y,
            k: event.transform.k,
          });
        });

      zoomBehaviorRef.current = zoomBehavior;
      svg.call(zoomBehavior);

      // Fit to container on initial load
      const individualNodes = graph.nodes.filter(n => n.type === 'individual');
      if (individualNodes.length > 0) {
        const bounds = calculateBounds(graph, NODE_WIDTH, NODE_HEIGHT);
        const containerRect = container.getBoundingClientRect();
        const scale = Math.min(
          (containerRect.width - 100) / (bounds.width + NODE_WIDTH),
          (containerRect.height - 100) / (bounds.height + NODE_HEIGHT),
          1
        );
        const centerX = (containerRect.width - bounds.width * scale) / 2 - bounds.minX * scale;
        const centerY = (containerRect.height - bounds.height * scale) / 2 - bounds.minY * scale;

        svg.call(zoomBehavior.transform, zoomIdentity.translate(centerX, centerY).scale(scale));
      }

      return () => {
        svg.on('.zoom', null);
      };
    }, [graph]);

    const handleNodeClick = useCallback((individual: Individual) => {
      onSelect?.(individual);
    }, [onSelect]);

    // Build node map for edge generation
    const nodeMap = useMemo(() => {
      if (!graph) return new Map();
      return new Map(graph.nodes.map(n => [n.id, n]));
    }, [graph]);

    // Group marriage links by family node
    const marriagePaths = useMemo(() => {
      if (!graph) return [];

      const familyLinks = new Map<string, typeof graph.links>();

      for (const link of graph.links) {
        if (link.type === 'marriage') {
          const existing = familyLinks.get(link.target) || [];
          existing.push(link);
          familyLinks.set(link.target, existing);
        }
      }

      const paths: { d: string; familyId: string }[] = [];

      for (const [familyId, links] of familyLinks) {
        if (links.length >= 2) {
          const spouse1 = nodeMap.get(links[0].source);
          const spouse2 = nodeMap.get(links[1].source);
          const famNode = nodeMap.get(familyId);

          if (spouse1 && spouse2 && famNode &&
              spouse1.x !== undefined && spouse1.y !== undefined &&
              spouse2.x !== undefined && spouse2.y !== undefined &&
              famNode.x !== undefined && famNode.y !== undefined) {
            // Draw horizontal marriage line
            const y = famNode.y;
            paths.push({
              d: `M ${spouse1.x} ${spouse1.y} L ${spouse1.x} ${y} L ${spouse2.x} ${y} L ${spouse2.x} ${spouse2.y}`,
              familyId
            });
          }
        }
      }

      return paths;
    }, [graph, nodeMap]);

    // Generate child paths
    const childPaths = useMemo(() => {
      if (!graph) return [];

      return graph.links
        .filter(link => link.type === 'child')
        .map((link, i) => {
          const source = nodeMap.get(link.source);
          const target = nodeMap.get(link.target);

          if (!source || !target ||
              source.x === undefined || source.y === undefined ||
              target.x === undefined || target.y === undefined) {
            return null;
          }

          // Draw path from family node to child
          const midY = (source.y + target.y) / 2;
          const d = `M ${source.x} ${source.y}
                    L ${source.x} ${midY}
                    Q ${source.x} ${(midY + target.y) / 2}, ${(source.x + target.x) / 2} ${(midY + target.y) / 2}
                    Q ${target.x} ${(midY + target.y) / 2}, ${target.x} ${target.y}`;

          return { d, key: `child-${i}` };
        })
        .filter((p): p is { d: string; key: string } => p !== null);
    }, [graph, nodeMap]);

    if (!graph || graph.nodes.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          No data to display
        </div>
      );
    }

    const individualNodes = graph.nodes.filter(n => n.type === 'individual' && n.data);

    return (
      <div ref={containerRef} className="w-full h-full overflow-hidden bg-slate-50">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="cursor-grab active:cursor-grabbing"
        >
          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
            {/* Marriage connections */}
            {marriagePaths.map((path) => (
              <path
                key={path.familyId}
                d={path.d}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {/* Child connections */}
            {childPaths.map((path) => (
              <path
                key={path.key}
                d={path.d}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={2}
                strokeLinecap="round"
              />
            ))}

            {/* Individual nodes */}
            {individualNodes.map((node) => (
              <TreeNode
                key={node.id}
                individual={node.data!}
                x={node.x ?? 0}
                y={node.y ?? 0}
                selected={node.id === selectedId}
                onClick={() => handleNodeClick(node.data!)}
              />
            ))}
          </g>
        </svg>
      </div>
    );
  }
);
