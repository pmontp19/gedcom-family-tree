import type { GraphData } from './dag-builder';

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export function calculateBounds(graph: GraphData, nodeWidth: number, nodeHeight: number): BoundingBox {
  if (graph.nodes.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const node of graph.nodes) {
    if (node.x !== undefined && node.y !== undefined) {
      // Only count individual nodes for bounds
      if (node.type === 'individual') {
        minX = Math.min(minX, node.x - nodeWidth / 2);
        maxX = Math.max(maxX, node.x + nodeWidth / 2);
        minY = Math.min(minY, node.y - nodeHeight / 2);
        maxY = Math.max(maxY, node.y + nodeHeight / 2);
      }
    }
  }

  return {
    minX: minX === Infinity ? 0 : minX,
    maxX: maxX === -Infinity ? 0 : maxX,
    minY: minY === Infinity ? 0 : minY,
    maxY: maxY === -Infinity ? 0 : maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
