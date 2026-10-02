import type { GedcomDate } from './gedcom-date.js';

/**
 * A SOUR citation: a pointer at a source record (`id`) or, in 5.5.1, the
 * source written inline (`text`), plus where in it (`page`, from PAGE).
 */
export interface Citation {
  id?: string;
  text?: string;
  page?: string;
}

export interface Event {
  type: 'BIRT' | 'DEAT' | 'MARR' | 'DIV' | 'RESI' | 'OCCU' | 'EDUC' | 'IMMI' | 'EMIG' | string;
  date?: GedcomDate;
  place?: string;
  /** The line's own value: the trade for OCCU, the text of a FACT or EVEN. */
  value?: string;
  /** TYPE: what a generic EVEN/FACT is ("Servei militar"). */
  descriptor?: string;
  sources?: Citation[];
  notes?: string[];
  customTags?: Map<string, string>;
}

export function createEvent(type: string): Event {
  return { type };
}
