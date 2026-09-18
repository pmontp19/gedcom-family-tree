import type { TreeNode } from './dag-builder';
import { NODE_W, NODE_H } from './theme';

interface Transform {
  x: number;
  y: number;
  k: number;
}

/**
 * Returns the set of node IDs whose AABB intersects the viewport.
 * Converts canvas viewport to world space, then does O(N) AABB test.
 */
export function getVisibleNodes(
  nodes: TreeNode[],
  transform: Transform,
  canvasW: number,
  canvasH: number,
  margin = 200,
): Set<string> {
  // Viewport in world coords
  const worldLeft = (-transform.x - margin) / transform.k;
  const worldTop = (-transform.y - margin) / transform.k;
  const worldRight = (canvasW - transform.x + margin) / transform.k;
  const worldBottom = (canvasH - transform.y + margin) / transform.k;

  const visible = new Set<string>();

  for (const node of nodes) {
    if (node.x === undefined || node.y === undefined) continue;
    const halfW = node.type === 'individual' ? NODE_W / 2 : 10;
    const halfH = node.type === 'individual' ? NODE_H / 2 : 10;

    const nodeLeft = node.x - halfW;
    const nodeRight = node.x + halfW;
    const nodeTop = node.y - halfH;
    const nodeBottom = node.y + halfH;

    if (nodeRight >= worldLeft && nodeLeft <= worldRight &&
        nodeBottom >= worldTop && nodeTop <= worldBottom) {
      visible.add(node.id);
    }
  }

  return visible;
}
