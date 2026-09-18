import type { SerializedGedcomData } from '@gedcom/shared';
import { traversalTools } from './traversal.js';
import { searchTools } from './search.js';
import { statisticsTools } from './statistics.js';
import { relationshipTools } from './relationship.js';
import { factsTools } from './facts.js';
import { auditTools } from './audit.js';
import { reportsTools } from './reports.js';
import type { ToolSet } from 'ai';

export function createGedcomTools(data: SerializedGedcomData, raw: Buffer | null): ToolSet {
  return {
    ...traversalTools(data),
    ...searchTools(data),
    ...statisticsTools(data),
    ...relationshipTools(data),
    ...factsTools(data),
    ...reportsTools(data),
    ...auditTools(raw),
  } as ToolSet;
}
