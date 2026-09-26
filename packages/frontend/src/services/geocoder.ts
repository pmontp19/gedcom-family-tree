// Place name → coordinates. A GEDCOM place is free text ("Mas Pla, Sant Feliu
// de Guíxols, Girona, Catalunya"), so resolution goes through layers, cheapest
// and most trustworthy first:
//   1. coordinates the file already carries (PLAC.MAP LATI/LONG)
//   2. what this browser resolved or the user pinned before (localStorage)
//   3. the ICGC geocoder, which knows Catalan toponyms down to hamlets and masies
//   4. Nominatim (OpenStreetMap) for the rest of the world, one request a second
// A place nobody finds is retried with its leading component dropped, so a
// farmhouse still lands on its town; those hits are flagged approximate.

import type { Coordinates } from '@gedcom/shared';

export type GeocodeSource = 'gedcom' | 'icgc' | 'nominatim' | 'manual';

export interface GeocodeResult extends Coordinates {
  source: GeocodeSource;
  /** Found only after dropping the most specific part of the name. */
  approximate?: boolean;
}

/** place → result, or null for a place every service missed. */
type Cache = Record<string, GeocodeResult | null>;

const CACHE_KEY = 'geocode-cache-v1';
const ICGC_URL = 'https://eines.icgc.cat/geocodificador/cerca';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
/** Nominatim's usage policy: at most one request per second. */
const NOMINATIM_INTERVAL_MS = 1100;

/** Words that say a place is in Catalonia, where the ICGC should answer first. */
const CATALAN_HINT = /catalu|catalonia|barcelon|giron|gerona|lleida|l[eé]rida|tarragon|empord|pened[eè]s|vall[eè]s|maresme|osona|bages|garrotxa|cerdanya|pallars|urgell|segarra|priorat|montsi|ebre/i;

export function normalizePlace(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitPlace(place: string): string[] {
  return place.split(',').map(p => p.trim()).filter(Boolean);
}

export function looksCatalan(place: string): boolean {
  return CATALAN_HINT.test(place);
}

function loadCache(): Cache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Cache;
  } catch {
    return {};
  }
}

function saveCache(cache: Cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.warn('Could not persist geocode cache:', err);
  }
}

interface IcgcFeature {
  geometry: { coordinates: [number, number] };
  properties: { nom?: string; municipi?: string };
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface GeocoderOptions {
  fetch?: Fetch;
  sleep?: (ms: number) => Promise<void>;
}

export class Geocoder {
  private cache: Cache = loadCache();
  private fetch: Fetch;
  private sleep: (ms: number) => Promise<void>;
  private lastNominatim = 0;

  constructor(options: GeocoderOptions = {}) {
    this.fetch = options.fetch ?? ((url, init) => fetch(url, init));
    this.sleep = options.sleep ?? (ms => new Promise(r => setTimeout(r, ms)));
  }

  /** Cached answer: a result, null for a known miss, undefined if never asked. */
  cached(place: string): GeocodeResult | null | undefined {
    return this.cache[place];
  }

  /** A user-placed pin wins over anything a service said. */
  pin(place: string, coords: Coordinates) {
    this.cache[place] = { ...coords, source: 'manual' };
    saveCache(this.cache);
  }

  /** Forget misses so the next resolve asks the services again. */
  forgetMisses() {
    for (const [place, result] of Object.entries(this.cache)) {
      if (result === null) delete this.cache[place];
    }
    saveCache(this.cache);
  }

  /**
   * Resolve places one by one, reporting each as it lands so the map fills in
   * progressively. Cached places (hits and misses) report without a request.
   */
  async resolveAll(
    places: string[],
    known: Map<string, Coordinates>,
    onResult: (place: string, result: GeocodeResult | null) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const pending: string[] = [];
    for (const place of places) {
      const fromFile = known.get(place);
      const cached = this.cache[place];
      if (cached?.source === 'manual') onResult(place, cached);
      else if (fromFile) onResult(place, { ...fromFile, source: 'gedcom' });
      else if (cached !== undefined) onResult(place, cached);
      else pending.push(place);
    }

    for (const place of pending) {
      if (signal?.aborted) return;
      let result: GeocodeResult | null;
      try {
        result = await this.lookup(place, signal);
      } catch (err) {
        if (signal?.aborted) return;
        // A network error is not a miss: leave it uncached to retry next time.
        console.warn(`Geocoding failed for "${place}":`, err);
        onResult(place, null);
        continue;
      }
      if (signal?.aborted) return;
      this.cache[place] = result;
      saveCache(this.cache);
      onResult(place, result);
    }
  }

  private async lookup(place: string, signal?: AbortSignal): Promise<GeocodeResult | null> {
    const parts = splitPlace(place);
    if (!parts.length) return null;
    const catalan = looksCatalan(place);

    if (catalan) {
      const hit = await this.icgc(parts[0], signal);
      if (hit) return hit;
    }
    const full = await this.nominatim(parts.join(', '), signal);
    if (full) return full;
    if (!catalan) {
      // Only an exact name match is trusted here: the ICGC answers every
      // query with *something* in Catalonia, even "Paris".
      const hit = await this.icgc(parts[0], signal);
      if (hit) return hit;
    }

    // Drop the most specific component until something is found.
    for (let i = 1; i < parts.length; i++) {
      const rest = parts.slice(i);
      const hit = (catalan && (await this.icgc(rest[0], signal))) || (await this.nominatim(rest.join(', '), signal));
      if (hit) return { ...hit, approximate: true };
    }
    return null;
  }

  private async icgc(name: string, signal?: AbortSignal): Promise<GeocodeResult | null> {
    const url = `${ICGC_URL}?${new URLSearchParams({ text: name, size: '5' })}`;
    const res = await this.fetch(url, { signal });
    if (!res.ok) return null;
    const body = (await res.json()) as { features?: IcgcFeature[] };
    const wanted = normalizePlace(name);
    const match = body.features?.find(f =>
      normalizePlace(f.properties.nom ?? '') === wanted || normalizePlace(f.properties.municipi ?? '') === wanted,
    );
    if (!match) return null;
    const [lon, lat] = match.geometry.coordinates;
    return { lat, lon, source: 'icgc' };
  }

  private async nominatim(query: string, signal?: AbortSignal): Promise<GeocodeResult | null> {
    const wait = this.lastNominatim + NOMINATIM_INTERVAL_MS - Date.now();
    if (wait > 0) await this.sleep(wait);
    this.lastNominatim = Date.now();
    const url = `${NOMINATIM_URL}?${new URLSearchParams({ q: query, format: 'jsonv2', limit: '1' })}`;
    const res = await this.fetch(url, { signal, headers: { 'Accept-Language': 'ca,es,en' } });
    if (!res.ok) return null;
    const [hit] = (await res.json()) as { lat: string; lon: string }[];
    if (!hit) return null;
    return { lat: parseFloat(hit.lat), lon: parseFloat(hit.lon), source: 'nominatim' };
  }
}
