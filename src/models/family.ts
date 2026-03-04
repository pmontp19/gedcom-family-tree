import type { Event } from './event';

export interface Family {
  id: string;
  husband?: string;
  wife?: string;
  children: string[];
  marriage?: Event;
  divorce?: Event;
  events: Event[];
  notes: string[];
  sources: string[];
  customTags: Map<string, string>;
}

export function createFamily(id: string): Family {
  return {
    id,
    children: [],
    events: [],
    notes: [],
    sources: [],
    customTags: new Map(),
  };
}

export function getSpouses(family: Family): string[] {
  const spouses: string[] = [];
  if (family.husband) spouses.push(family.husband);
  if (family.wife) spouses.push(family.wife);
  return spouses;
}
