import type { GedcomDate } from './gedcom-date';

export interface Event {
  type: 'BIRT' | 'DEAT' | 'MARR' | 'DIV' | 'RESI' | 'OCCU' | 'EDUC' | 'IMMI' | 'EMIG' | string;
  date?: GedcomDate;
  place?: string;
  sources?: string[];
  notes?: string[];
  customTags?: Map<string, string>;
}

export function createEvent(type: string): Event {
  return { type };
}
