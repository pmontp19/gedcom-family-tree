import type { GedcomDate } from './gedcom-date.js';

/** WGS84 point, from PLAC.MAP (LATI/LONG) or a geocoder. */
export interface Coordinates {
  lat: number;
  lon: number;
}

export interface Event {
  type: 'BIRT' | 'DEAT' | 'MARR' | 'DIV' | 'RESI' | 'OCCU' | 'EDUC' | 'IMMI' | 'EMIG' | string;
  date?: GedcomDate;
  place?: string;
  coords?: Coordinates;
  sources?: string[];
  notes?: string[];
  customTags?: Map<string, string>;
}

export function createEvent(type: string): Event {
  return { type };
}
