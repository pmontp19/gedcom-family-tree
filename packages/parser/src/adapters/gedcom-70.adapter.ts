import { BaseAdapter, gedcomVersion } from './base.adapter.js';
import type { TreeNode } from '../tree-builder.js';
import type { GedcomHeader } from '@gedcom/shared';

/**
 * FamilySearch GEDCOM 7.0.
 *
 * Differences from 5.5.1 that matter here: the encoding is always UTF-8 (no
 * HEAD.CHAR), CONC is illegal so continuations only ever arrive as CONT, and
 * extension tags are declared in HEAD.SCHMA with the URI that defines them.
 */
export class Gedcom7Adapter extends BaseAdapter {
  readonly name = 'GEDCOM 7.0';

  detect(nodes: TreeNode[]): boolean {
    return gedcomVersion(nodes)?.startsWith('7.') ?? false;
  }

  parseHeader(node: TreeNode): GedcomHeader {
    const header = super.parseHeader(node);
    header.char ??= 'UTF-8';

    // HEAD.SCHMA: `2 TAG _SKYPEID http://xmlns.com/foaf/0.1/skypeID`
    for (const tag of node.children.find(c => c.tag === 'SCHMA')?.children ?? []) {
      const [name, uri] = tag.tag === 'TAG' ? (tag.data ?? '').split(/\s+/) : [];
      if (name && uri) header.customTags.set(name, uri);
    }

    return header;
  }
}
