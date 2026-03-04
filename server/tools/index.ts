import type { GedcomData } from '../types.js';
import { traversalTools } from './traversal.js';
import { searchTools } from './search.js';
import { statisticsTools } from './statistics.js';
import { relationshipTools } from './relationship.js';
import { factsTools } from './facts.js';

export function createGedcomTools(data: GedcomData) {
  return {
    ...traversalTools(data),
    ...searchTools(data),
    ...statisticsTools(data),
    ...relationshipTools(data),
    ...factsTools(data),
  };
}
