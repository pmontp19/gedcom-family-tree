import type { Event, Citation } from './event.js';

/**
 * One OBJE FILE. `file` is the raw GEDCOM reference (a percent-encoded
 * relative path inside a GEDZIP, or an absolute URL); `url` is filled in once
 * something resolves that reference to a loadable address.
 */
export interface MediaFile {
  file: string;
  title?: string;
  form?: string;
  url?: string;
}

export interface Name {
  full: string;
  given?: string;
  surname?: string;
  prefix?: string;
  suffix?: string;
  nickname?: string;
}

export interface Individual {
  id: string;
  name?: Name;
  aliases: Name[];  // Additional NAME records
  sex?: 'M' | 'F' | 'U';
  birth?: Event;
  death?: Event;
  fams: string[];  // Families where spouse
  famc: string[];  // Families where child (adoption, etc.)
  events: Event[];
  notes: string[];
  sources: Citation[];
  media: MediaFile[];  // OBJE: photos and documents
  customTags: Map<string, string>;
  rin?: string;
  uid?: string;
}

export function createIndividual(id: string): Individual {
  return {
    id,
    fams: [],
    famc: [],
    events: [],
    notes: [],
    sources: [],
    media: [],
    aliases: [],
    customTags: new Map(),
  };
}

export function parseName(nameStr: string): Name {
  const name: Name = { full: nameStr };
  // Either side may be empty: `Isabel //` (no surname known), `/Reig/`.
  const match = nameStr.match(/^(.*?)\s*\/(.*?)\/\s*(.*)$/);
  if (match) {
    const [given, surname, suffix] = match.slice(1).map(s => s.trim());
    if (given) name.given = given;
    if (surname) name.surname = surname;
    if (suffix) name.suffix = suffix;
    name.full = `${given} ${surname}`.trim() || nameStr;
  }
  return name;
}

export function getDisplayName(ind: Individual): string {
  return ind.name?.full || ind.id;
}

export function getLifeYears(ind: Individual): string {
  const birthYear = ind.birth?.date?.year;
  const deathYear = ind.death?.date?.year;
  // Catalan: n. (naixement), m. (mort).
  if (birthYear && deathYear) return `${birthYear}–${deathYear}`;
  if (birthYear) return `n. ${birthYear}`;
  if (deathYear) return `m. ${deathYear}`;
  return '';
}

/** First media file that resolved to a loadable image: the person's photo. */
export function getPhotoUrl(ind: Individual): string | undefined {
  return ind.media.find(m => m.url)?.url;
}
