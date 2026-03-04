import { tokenizeLines } from './tokenizer';
import { buildTree } from './tree-builder';
import { Gedcom551Adapter, MyHeritageAdapter } from './adapters';
import type { GedcomData } from '@/models';
import type { BaseAdapter } from './adapters';

export { tokenize, tokenizeLines } from './tokenizer';
export { buildTree } from './tree-builder';
export { Gedcom551Adapter, MyHeritageAdapter } from './adapters';

const adapters: BaseAdapter[] = [
  new MyHeritageAdapter(),
  new Gedcom551Adapter(),
];

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
