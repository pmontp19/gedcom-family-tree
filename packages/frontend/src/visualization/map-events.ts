import type { Coordinates, Event, GedcomData, GedcomDate, Individual } from '@gedcom/shared';
import { getDisplayName } from '@gedcom/shared';

/** One placed, dated happening: what the map shows and the timeline moves through. */
export interface MapEvent {
  key: string;
  type: string;
  year: number;
  /** Fractional year (month/day folded in) so same-year events keep their order. */
  when: number;
  date?: GedcomDate;
  place: string;
  /** Coordinates the file itself carried (PLAC.MAP); geocoding fills the rest. */
  coords?: Coordinates;
  /** Everyone the event is about: one person, or both spouses for a family event. */
  people: { id: string; name: string }[];
}

export const EVENT_LABELS: Record<string, string> = {
  BIRT: 'Birth', CHR: 'Christening', BAPM: 'Baptism', DEAT: 'Death', BURI: 'Burial',
  CREM: 'Cremation', MARR: 'Marriage', DIV: 'Divorce', RESI: 'Residence', OCCU: 'Occupation',
  EDUC: 'Education', GRAD: 'Graduation', EMIG: 'Emigration', IMMI: 'Immigration', NATU: 'Naturalization',
  CENS: 'Census', MILI: 'Military service', RETI: 'Retirement', PROB: 'Probate', WILL: 'Will',
  CONF: 'Confirmation', FCOM: 'First communion', ADOP: 'Adoption', EVEN: 'Event',
};

export function eventLabel(type: string): string {
  return EVENT_LABELS[type] ?? type;
}

function fractionalYear(date: GedcomDate): number {
  const month = date.month ? (date.month - 1) / 12 : 0;
  const day = date.day ? (date.day - 1) / 365 : 0;
  return date.year! + month + day;
}

/** A placed event with a year, or nothing: undated events cannot sit on a timeline. */
function toMapEvent(key: string, ev: Event | undefined, people: MapEvent['people']): MapEvent | null {
  const place = ev?.place?.trim();
  const year = ev?.date?.year;
  if (!ev || !place || !year) return null;
  return { key, type: ev.type, year, when: fractionalYear(ev.date!), date: ev.date, place, coords: ev.coords, people };
}

function person(ind: Individual) {
  return { id: ind.id, name: getDisplayName(ind) };
}

/**
 * Every dated, placed event in the tree, oldest first. BIRT/DEAT live on their
 * own fields and in `events` for some adapters, so type+place+year dedups them;
 * family events are listed once with both spouses.
 */
export function collectMapEvents(data: GedcomData): MapEvent[] {
  const events: MapEvent[] = [];

  for (const ind of data.individuals.values()) {
    const seen = new Set<string>();
    const all = [ind.birth, ind.death, ...ind.events];
    all.forEach((ev, i) => {
      const mapEvent = toMapEvent(`${ind.id}:${i}`, ev, [person(ind)]);
      if (!mapEvent) return;
      const sig = `${mapEvent.type}|${mapEvent.place}|${mapEvent.when}`;
      if (seen.has(sig)) return;
      seen.add(sig);
      events.push(mapEvent);
    });
  }

  for (const fam of data.families.values()) {
    const spouses = [fam.husband, fam.wife]
      .map(id => (id ? data.individuals.get(id) : undefined))
      .filter((ind): ind is Individual => !!ind)
      .map(person);
    if (!spouses.length) continue;
    const seen = new Set<string>();
    const all = [fam.marriage, fam.divorce, ...fam.events];
    all.forEach((ev, i) => {
      const mapEvent = toMapEvent(`${fam.id}:${i}`, ev, spouses);
      if (!mapEvent) return;
      const sig = `${mapEvent.type}|${mapEvent.place}|${mapEvent.when}`;
      if (seen.has(sig)) return;
      seen.add(sig);
      events.push(mapEvent);
    });
  }

  return events.sort((a, b) => a.when - b.when);
}

/** Places a person passed through, in time order: the legs of their journey. */
export function personPaths(events: MapEvent[]): Map<string, MapEvent[]> {
  const paths = new Map<string, MapEvent[]>();
  for (const ev of events) {
    for (const p of ev.people) {
      const path = paths.get(p.id) ?? [];
      if (path.at(-1)?.place !== ev.place) path.push(ev);
      paths.set(p.id, path);
    }
  }
  return paths;
}

/** Events per bucket of `size` years across [min, max], for the timeline histogram. */
export function histogram(events: MapEvent[], min: number, max: number, size: number): number[] {
  const buckets = new Array(Math.max(1, Math.ceil((max - min + 1) / size))).fill(0);
  for (const ev of events) {
    const i = Math.floor((ev.year - min) / size);
    if (i >= 0 && i < buckets.length) buckets[i]++;
  }
  return buckets;
}
