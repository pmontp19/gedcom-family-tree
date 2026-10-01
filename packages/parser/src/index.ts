import { tokenizeLines } from './tokenizer.js';
import { buildTree } from './tree-builder.js';
import { Gedcom551Adapter, Gedcom7Adapter, MyHeritageAdapter } from './adapters/index.js';
import type { GedcomData } from '@gedcom/shared';
import type { BaseAdapter } from './adapters/index.js';

export { tokenize, tokenizeLines } from './tokenizer.js';
export type { Token } from './tokenizer.js';
export { buildTree, findNodes, getFirstChildByTag, getDataByTag } from './tree-builder.js';
export type { TreeNode } from './tree-builder.js';
export { BaseAdapter, Gedcom551Adapter, Gedcom7Adapter, MyHeritageAdapter, gedcomVersion } from './adapters/index.js';
export { parseDate, formatGedcomDate, MONTHS } from './utils/date-parser.js';
export { decodeGedcom } from './decode.js';

// Version first: HEAD.GEDC.VERS decides the dialect, vendor quirks only refine it.
const adapters: BaseAdapter[] = [
  new Gedcom7Adapter(),
  new MyHeritageAdapter(),
  new Gedcom551Adapter(),
];

/**
 * Parse a GEDCOM file content into structured data
 */
export function parseGedcom(content: string): GedcomData {
  return parseGedcomWithFormat(content).data;
}

/**
 * Parse once and report which adapter matched ('Unknown' falls back to 5.5.1).
 */
export function parseGedcomWithFormat(content: string): { data: GedcomData; format: string } {
  const tree = buildTree(tokenizeLines(content));
  const adapter = adapters.find(a => a.detect(tree));
  return { data: (adapter ?? new Gedcom551Adapter()).parse(tree), format: adapter?.name ?? 'Unknown' };
}

/**
 * Detect the format of a GEDCOM file
 */
export function detectFormat(content: string): string {
  const tree = buildTree(tokenizeLines(content));
  return adapters.find(a => a.detect(tree))?.name ?? 'Unknown';
}
