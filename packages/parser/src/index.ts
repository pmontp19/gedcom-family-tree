import { tokenizeLines } from './tokenizer.js';
import { buildTree } from './tree-builder.js';
import { Gedcom551Adapter, MyHeritageAdapter } from './adapters/index.js';
import type { GedcomData } from '@gedcom/shared';
import type { BaseAdapter } from './adapters/index.js';

export { tokenize, tokenizeLines } from './tokenizer.js';
export type { Token } from './tokenizer.js';
export { buildTree, findNodes, getFirstChildByTag, getDataByTag } from './tree-builder.js';
export type { TreeNode } from './tree-builder.js';
export { BaseAdapter, Gedcom551Adapter, MyHeritageAdapter } from './adapters/index.js';
export { parseDate, formatGedcomDate, MONTHS } from './utils/date-parser.js';

const adapters: BaseAdapter[] = [
  new MyHeritageAdapter(),
  new Gedcom551Adapter(),
];

/**
 * Parse a GEDCOM file content into structured data
 */
export function parseGedcom(content: string): GedcomData {
  const tokens = tokenizeLines(content);
  const tree = buildTree(tokens);

  // Find matching adapter
  for (const adapter of adapters) {
    if (adapter.detect(tree)) {
      return adapter.parse(tree);
    }
  }

  // Default to GEDCOM 5.5.1
  const defaultAdapter = new Gedcom551Adapter();
  return defaultAdapter.parse(tree);
}

/**
 * Detect the format of a GEDCOM file
 */
export function detectFormat(content: string): string {
  const tokens = tokenizeLines(content);
  const tree = buildTree(tokens);

  for (const adapter of adapters) {
    if (adapter.detect(tree)) {
      return adapter.name;
    }
  }

  return 'Unknown';
}
