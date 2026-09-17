import type { Event } from './event.js';
import type { Media } from './media.js';

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
  media: Media[];
  customTags: Map<string, string>;
}

export function createFamily(id: string): Family {
  return {
    id,
    children: [],
    events: [],
    notes: [],
    sources: [],
    media: [],
    customTags: new Map(),
  };
}

export function getSpouses(family: Family): string[] {
  const spouses: string[] = [];
  if (family.husband) spouses.push(family.husband);
  if (family.wife) spouses.push(family.wife);
  return spouses;
}
