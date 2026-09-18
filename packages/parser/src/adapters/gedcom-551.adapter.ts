import { BaseAdapter, gedcomVersion } from './base.adapter.js';
import type { TreeNode } from '../tree-builder.js';

export class Gedcom551Adapter extends BaseAdapter {
  readonly name = 'GEDCOM 5.5.1';

  detect(nodes: TreeNode[]): boolean {
    return gedcomVersion(nodes)?.startsWith('5.5') ?? false;
  }
}
