import { BaseAdapter } from './base.adapter';
import type { TreeNode } from '@/parser/tree-builder';
import type { Individual } from '@/models';

export class MyHeritageAdapter extends BaseAdapter {
  readonly name = 'MyHeritage';

  detect(nodes: TreeNode[]): boolean {
    const headNode = nodes.find(n => n.tag === 'HEAD');
    if (!headNode) return false;

    const sourNode = headNode.children.find(c => c.tag === 'SOUR');
    return sourNode?.data?.toUpperCase() === 'MYHERITAGE';
  }

  protected parseIndividualField(ind: Individual, node: TreeNode): void {
    // Handle MyHeritage-specific tags
    switch (node.tag) {
      case '_UPD':
        // Update timestamp - store in customTags
        ind.customTags.set('_UPD', node.data || '');
        break;
      case '_MARNM':
        // Married name - store in customTags
        ind.customTags.set('_MARNM', node.data || '');
        break;
      case '_RTLSAVE':
      case '_PROJECT_GUID':
      case '_EXPORTED_FROM_SITE_ID':
        // MyHeritage-specific metadata
        ind.customTags.set(node.tag, node.data || '');
        break;
      default:
        // Fall back to base implementation
        super.parseIndividualField(ind, node);
    }
  }
}
