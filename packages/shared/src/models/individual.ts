import type { Event } from './event.js';

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
  sources: string[];
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
    aliases: [],
    customTags: new Map(),
  };
}

export function parseName(nameStr: string): Name {
  const name: Name = { full: nameStr };
  const match = nameStr.match(/^(.+?)\s*\/(.+?)\/\s*(.*)$/);
  if (match) {
    name.given = match[1].trim();
    name.surname = match[2].trim();
    if (match[3]) name.suffix = match[3].trim();
    name.full = `${name.given} ${name.surname}`.trim();
  }
  return name;
}

export function getDisplayName(ind: Individual): string {
  return ind.name?.full || ind.id;
}

export function getLifeYears(ind: Individual): string {
  const birthYear = ind.birth?.date?.year;
  const deathYear = ind.death?.date?.year;
  if (birthYear && deathYear) return `${birthYear} - ${deathYear}`;
  if (birthYear) return `b. ${birthYear}`;
  if (deathYear) return `d. ${deathYear}`;
  return '';
}
