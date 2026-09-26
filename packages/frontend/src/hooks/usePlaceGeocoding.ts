import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Coordinates } from '@gedcom/shared';
import { Geocoder, type GeocodeResult } from '@/services/geocoder';
import type { MapEvent } from '@/visualization/map-events';

let sharedGeocoder: Geocoder | null = null;
function getGeocoder(): Geocoder {
  sharedGeocoder ??= new Geocoder();
  return sharedGeocoder;
}

export interface PlaceGeocoding {
  /** place → result (null: not found). Places still pending are absent. */
  results: Map<string, GeocodeResult | null>;
  total: number;
  done: number;
  pin: (place: string, coords: Coordinates) => void;
  retryMisses: () => void;
}

/**
 * Resolves every distinct place of `events`, filling `results` as answers
 * arrive so markers appear one by one instead of after the slowest lookup.
 */
export function usePlaceGeocoding(events: MapEvent[]): PlaceGeocoding {
  const { places, known } = useMemo(() => {
    const known = new Map<string, Coordinates>();
    for (const ev of events) if (ev.coords && !known.has(ev.place)) known.set(ev.place, ev.coords);
    return { places: [...new Set(events.map(e => e.place))], known };
  }, [events]);

  const [results, setResults] = useState(() => new Map<string, GeocodeResult | null>());
  const [runId, setRunId] = useState(0);
  const pendingRef = useRef(new Map<string, GeocodeResult | null>());

  useEffect(() => {
    const controller = new AbortController();
    const geocoder = getGeocoder();
    // Old answers stay until the first flush; they are keyed by place, so a
    // new tree only ever reads the ones it shares.
    pendingRef.current = new Map();

    // Batch updates per frame: hundreds of cached places land synchronously.
    let frame = 0;
    const flush = () => {
      frame = 0;
      setResults(new Map(pendingRef.current));
    };
    void geocoder.resolveAll(places, known, (place, result) => {
      pendingRef.current.set(place, result);
      if (!frame) frame = requestAnimationFrame(flush);
    }, controller.signal);

    return () => {
      controller.abort();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [places, known, runId]);

  const pin = useCallback((place: string, coords: Coordinates) => {
    getGeocoder().pin(place, coords);
    pendingRef.current.set(place, { ...coords, source: 'manual' });
    setResults(new Map(pendingRef.current));
  }, []);

  const retryMisses = useCallback(() => {
    getGeocoder().forgetMisses();
    setRunId(n => n + 1);
  }, []);

  const done = useMemo(() => places.filter(p => results.has(p)).length, [places, results]);
  return { results, total: places.length, done, pin, retryMisses };
}
