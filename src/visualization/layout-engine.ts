import type { GraphData, TreeNode, TreeLink } from './dag-builder';

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

export function generateMarriagePath(spouse1: TreeNode, spouse2: TreeNode, familyNode: TreeNode): string {
  if (spouse1.x === undefined || spouse1.y === undefined ||
      spouse2.x === undefined || spouse2.y === undefined ||
      familyNode.x === undefined || familyNode.y === undefined) {
    return '';
  }

  // Horizontal line connecting spouses through the family node
  const y = familyNode.y;
  return `M ${spouse1.x} ${spouse1.y}
          L ${spouse1.x} ${y}
          L ${spouse2.x} ${y}
          L ${spouse2.x} ${spouse2.y}`;
}

export function generateChildPath(familyNode: TreeNode, child: TreeNode): string {
  if (familyNode.x === undefined || familyNode.y === undefined ||
      child.x === undefined || child.y === undefined) {
    return '';
  }

  // Vertical line down from family node to child
  const midY = (familyNode.y + child.y) / 2;

  return `M ${familyNode.x} ${familyNode.y}
          L ${familyNode.x} ${midY}
          L ${child.x} ${midY}
          L ${child.x} ${child.y}`;
}

export function generateEdgePath(
  link: TreeLink,
  nodes: Map<string, TreeNode>
): { path: string; type: 'marriage' | 'child' } | null {
  const source = nodes.get(link.source);
  const target = nodes.get(link.target);

  if (!source || !target || source.x === undefined || source.y === undefined ||
      target.x === undefined || target.y === undefined) {
    return null;
  }

  if (link.type === 'marriage') {
    // Spouse to family node - will be combined with other spouse
    return { path: `M ${source.x} ${source.y} L ${target.x} ${target.y}`, type: 'marriage' };
  } else {
    // Family node to child
    const midY = (source.y + target.y) / 2;
    return {
      path: `M ${source.x} ${source.y}
             L ${source.x} ${midY}
             Q ${source.x} ${midY}, ${(source.x + target.x) / 2} ${midY}
             Q ${target.x} ${midY}, ${target.x} ${(midY + target.y) / 2}
             L ${target.x} ${target.y}`,
      type: 'child'
    };
  }
}

export function getNodeColor(sex?: 'M' | 'F' | 'U'): string {
  switch (sex) {
    case 'M': return '#3b82f6'; // blue
    case 'F': return '#ec4899'; // pink
    default: return '#6b7280'; // gray
  }
}
