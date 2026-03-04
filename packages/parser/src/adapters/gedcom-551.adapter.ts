import { BaseAdapter } from './base.adapter.js';
import type { TreeNode } from '../tree-builder.js';

export class Gedcom551Adapter extends BaseAdapter {
  readonly name = 'GEDCOM 5.5.1';

  detect(nodes: TreeNode[]): boolean {
    const headNode = nodes.find(n => n.tag === 'HEAD');
    if (!headNode) return false;

    const gedcNode = headNode.children.find(c => c.tag === 'GEDC');
    if (!gedcNode) return false;

    const versNode = gedcNode.children.find(c => c.tag === 'VERS');
    return versNode?.data?.startsWith('5.5') ?? false;
  }
}
