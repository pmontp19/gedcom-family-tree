import { tool } from 'ai';
import { z } from 'zod';

// Places as genealogies write them ("Vilanova de Bellpuig, Lleida, Catalunya")
// to coordinates for story maps. The ICGC geocoder knows every Catalan
// toponym down to masies and partides; OpenStreetMap's Nominatim covers the rest.

export interface GeocodedPlace {
  place: string;
  lat: number;
  lon: number;
  label: string;
  source: 'icgc' | 'osm';
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const CATALAN_CONTEXT = /\b(catalunya|cataluna|catalonia|barcelona|girona|gerona|lleida|lerida|tarragona)\b/;

/**
 * ICGC only answers for Catalonia and matches fuzzily ("Cork" finds Corçà), so
 * it gets a place only when the rest of the string says it is Catalan, or says
 * nothing at all; even then only an exact name counts.
 * ponytail: keyword heuristic; a country field per place would be exact.
 */
export function icgcQuery(place: string): string | null {
  const [name, ...context] = place.split(',').map(s => s.trim()).filter(Boolean);
  if (!name) return null;
  if (context.length > 0 && !CATALAN_CONTEXT.test(normalize(context.join(' ')))) return null;
  return name;
}

interface IcgcFeature {
  geometry: { coordinates: [number, number] };
  properties: { nom: string; etiqueta?: string };
}

async function icgc(name: string): Promise<Omit<GeocodedPlace, 'place'> | null> {
  const url = `https://eines.icgc.cat/geocodificador/cerca?text=${encodeURIComponent(name)}&size=5&layers=topo1,topo2`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ICGC HTTP ${res.status}`);
  const { features } = await res.json() as { features: IcgcFeature[] };
  const hit = features.find(f => normalize(f.properties.nom) === normalize(name));
  if (!hit) return null;
  const [lon, lat] = hit.geometry.coordinates;
  return { lat, lon, label: hit.properties.etiqueta ?? hit.properties.nom, source: 'icgc' };
}

// Nominatim's usage policy: an identifying User-Agent, at most one request a second.
let lastOsm = 0;
async function osm(place: string): Promise<Omit<GeocodedPlace, 'place'> | null> {
  // Reserve the slot before awaiting, so concurrent calls queue up behind it.
  const slot = Math.max(Date.now(), lastOsm + 1000);
  lastOsm = slot;
  if (slot > Date.now()) await new Promise(r => setTimeout(r, slot - Date.now()));
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(place)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'gedcom-family-tree (genealogy stories)' } });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const [hit] = await res.json() as Array<{ lat: string; lon: string; display_name: string }>;
  return hit ? { lat: Number(hit.lat), lon: Number(hit.lon), label: hit.display_name, source: 'osm' } : null;
}

const cache = new Map<string, GeocodedPlace | null>();

async function geocode(place: string): Promise<GeocodedPlace | null> {
  if (cache.has(place)) return cache.get(place)!;
  let found: Omit<GeocodedPlace, 'place'> | null = null;
  try {
    const name = icgcQuery(place);
    found = (name ? await icgc(name) : null) ?? await osm(place);
  } catch (err) {
    // Offline or a geocoder down: off the map this time, but not cached as unknown.
    console.warn(`[geocode] ${place}:`, err);
    return null;
  }
  const result = found ? { place, ...found } : null;
  cache.set(place, result);
  return result;
}

export function geocodeTools() {
  return {
    geocode_places: tool({
      description:
        'Coordinates for place names as the tree writes them, for map steps in a story. ' +
        'Catalan places come from the ICGC (Institut Cartogràfic i Geològic de Catalunya), the rest ' +
        'from OpenStreetMap. Places it cannot find come back as null: leave them off the map.',
      inputSchema: z.object({ places: z.array(z.string()).min(1).max(20) }),
      execute: async ({ places }) => {
        const results: Array<GeocodedPlace | { place: string; found: false }> = [];
        for (const place of places) results.push(await geocode(place) ?? { place, found: false });
        return results;
      },
    }),
  };
}
