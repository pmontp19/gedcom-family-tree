import type { SerializedGedcomData } from '@gedcom/shared';
import { traversalTools } from './traversal.js';
import { searchTools } from './search.js';
import { statisticsTools } from './statistics.js';
import { relationshipTools } from './relationship.js';
import { factsTools } from './facts.js';
import type { ToolSet } from 'ai';

export function createGedcomTools(data: SerializedGedcomData): ToolSet {
  return {
    ...traversalTools(data),
    ...searchTools(data),
    ...statisticsTools(data),
    ...relationshipTools(data),
    ...factsTools(data),
  } as ToolSet;
}
