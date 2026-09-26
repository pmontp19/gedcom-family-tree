import { describe, it, expect, beforeEach } from 'vitest';
import { Geocoder, looksCatalan, normalizePlace, type GeocodeResult } from '../src/services/geocoder';

type Handler = (url: URL) => unknown;

function fakeFetch(handler: Handler) {
  const calls: string[] = [];
  const fetch = async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify(handler(new URL(url))));
  };
  return { fetch, calls };
}

const icgcFeature = (nom: string, lon: number, lat: number) => ({
  geometry: { coordinates: [lon, lat] },
  properties: { nom, municipi: nom },
});

async function resolve(geocoder: Geocoder, places: string[], known = new Map()) {
  const out = new Map<string, GeocodeResult | null>();
  await geocoder.resolveAll(places, known, (p, r) => out.set(p, r));
  return out;
}

const noSleep = { sleep: async () => {} };

beforeEach(() => localStorage.clear());

describe('normalizePlace', () => {
  it('ignores case, accents and apostrophe style', () => {
    expect(normalizePlace('L’Hospitalet de  Llobregat')).toBe(normalizePlace("l'hospitalet de llobregat"));
    expect(normalizePlace('Guíxols')).toBe('guixols');
  });
});

describe('looksCatalan', () => {
  it('spots Catalan provinces and regions', () => {
    expect(looksCatalan('Olot, Girona, Espanya')).toBe(true);
    expect(looksCatalan('Tremp, Pallars Jussà')).toBe(true);
    expect(looksCatalan('Austin, Texas, USA')).toBe(false);
  });
});

describe('Geocoder', () => {
  it('prefers coordinates from the file and asks nobody', async () => {
    const { fetch, calls } = fakeFetch(() => []);
    const geocoder = new Geocoder({ fetch, ...noSleep });
    const out = await resolve(geocoder, ['Olot'], new Map([['Olot', { lat: 42.18, lon: 2.49 }]]));
    expect(out.get('Olot')).toEqual({ lat: 42.18, lon: 2.49, source: 'gedcom' });
    expect(calls).toHaveLength(0);
  });

  it('asks the ICGC first for Catalan places, trusting only an exact name', async () => {
    const { fetch, calls } = fakeFetch(url =>
      url.hostname === 'eines.icgc.cat' ? { features: [icgcFeature('Olot', 2.49, 42.18)] } : [],
    );
    const out = await resolve(new Geocoder({ fetch, ...noSleep }), ['Olot, Girona, Catalunya']);
    expect(out.get('Olot, Girona, Catalunya')).toMatchObject({ lat: 42.18, lon: 2.49, source: 'icgc' });
    expect(calls).toHaveLength(1);
  });

  it('rejects an ICGC answer whose name does not match', async () => {
    const { fetch } = fakeFetch(url =>
      url.hostname === 'eines.icgc.cat' ? { features: [icgcFeature('Sol i Padrís', 2.1, 41.5)] } : [],
    );
    const out = await resolve(new Geocoder({ fetch, ...noSleep }), ['Paris']);
    expect(out.get('Paris')).toBeNull();
  });

  it('uses Nominatim for the rest of the world', async () => {
    const { fetch, calls } = fakeFetch(url =>
      url.hostname === 'nominatim.openstreetmap.org' ? [{ lat: '30.27', lon: '-97.74' }] : { features: [] },
    );
    const out = await resolve(new Geocoder({ fetch, ...noSleep }), ['Austin, Texas, USA']);
    expect(out.get('Austin, Texas, USA')).toEqual({ lat: 30.27, lon: -97.74, source: 'nominatim' });
    expect(new URL(calls[0]).searchParams.get('q')).toBe('Austin, Texas, USA');
  });

  it('drops the most specific part when the full name is unknown, flagging it approximate', async () => {
    const { fetch } = fakeFetch(url => {
      if (url.hostname === 'eines.icgc.cat') return { features: [] };
      return url.searchParams.get('q') === 'Cork, Ireland' ? [{ lat: '51.9', lon: '-8.47' }] : [];
    });
    const out = await resolve(new Geocoder({ fetch, ...noSleep }), ['St Finbarr Parish, Cork, Ireland']);
    expect(out.get('St Finbarr Parish, Cork, Ireland')).toMatchObject({ lat: 51.9, approximate: true });
  });

  it('caches hits and misses across instances, and pins win', async () => {
    const { fetch, calls } = fakeFetch(() => []);
    await resolve(new Geocoder({ fetch, ...noSleep }), ['Atlantis']);
    const before = calls.length;

    const second = new Geocoder({ fetch, ...noSleep });
    expect((await resolve(second, ['Atlantis'])).get('Atlantis')).toBeNull();
    expect(calls.length).toBe(before);

    second.pin('Atlantis', { lat: 1, lon: 2 });
    const out = await resolve(new Geocoder({ fetch, ...noSleep }), ['Atlantis'], new Map([['Atlantis', { lat: 9, lon: 9 }]]));
    expect(out.get('Atlantis')).toEqual({ lat: 1, lon: 2, source: 'manual' });
  });

  it('asks again after forgetting misses', async () => {
    const { fetch, calls } = fakeFetch(() => []);
    const geocoder = new Geocoder({ fetch, ...noSleep });
    await resolve(geocoder, ['Atlantis']);
    const before = calls.length;
    geocoder.forgetMisses();
    await resolve(geocoder, ['Atlantis']);
    expect(calls.length).toBeGreaterThan(before);
  });
});
