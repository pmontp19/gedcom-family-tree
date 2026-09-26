import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { GedcomData } from '@gedcom/shared';
import { Button } from '@/components/ui/button';
import { Crosshair, Layers, MapPin, Maximize2, RotateCw, X } from 'lucide-react';
import { usePlaceGeocoding } from '@/hooks/usePlaceGeocoding';
import { collectMapEvents, eventLabel, personPaths, type MapEvent } from '@/visualization/map-events';
import {
  BASE_LAYERS, ICGC_ATTRIBUTION, ICGC_HISTORIC_LAYERS, ICGC_ORTO_WMS, historicLayerForYear,
} from '@/visualization/icgc-layers';
import { MapTimeline } from './MapTimeline';

/** Years an event stays highlighted after it happens. */
const RECENT_WINDOW = 3;
/** Keeps fitted places clear of the status box and the timeline panel. */
const FIT_PADDING: L.FitBoundsOptions = { paddingTopLeft: [40, 70], paddingBottomRight: [60, 170] };
/** Years a trail stays visible while fading out; older legs keep a faint line. */
const TRAIL_FADE = 25;

const CATEGORY_COLORS = {
  birth: '#16a34a',
  marriage: '#db2777',
  death: '#64748b',
  other: '#2563eb',
} as const;
type Category = keyof typeof CATEGORY_COLORS;

function category(type: string): Category {
  if (['BIRT', 'CHR', 'BAPM'].includes(type)) return 'birth';
  if (['MARR', 'DIV'].includes(type)) return 'marriage';
  if (['DEAT', 'BURI', 'CREM'].includes(type)) return 'death';
  return 'other';
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
}

type HistoricMode = 'off' | 'auto' | string;

interface FamilyMapProps {
  data: GedcomData;
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function FamilyMap({ data, selectedId, onSelect }: FamilyMapProps) {
  const events = useMemo(() => collectMapEvents(data), [data]);
  const { results, total, done, pin, retryMisses } = usePlaceGeocoding(events);

  const minYear = events[0]?.year ?? new Date().getFullYear();
  const maxYear = events.at(-1)?.year ?? minYear;
  const [year, setYear] = useState(maxYear);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [baseId, setBaseId] = useState(BASE_LAYERS[0].id);
  const [historic, setHistoric] = useState<HistoricMode>('off');
  const [historicOpacity, setHistoricOpacity] = useState(0.8);
  const [showPaths, setShowPaths] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);
  const [pinning, setPinning] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const historicLayerRef = useRef<L.TileLayer.WMS | null>(null);
  const pathsLayerRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef(new Map<string, L.CircleMarker>());
  const fittedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // A new tree starts the story over at its end, with everything on the map.
  useEffect(() => {
    setYear(maxYear);
    setPlaying(false);
    fittedRef.current = false;
  }, [data, maxYear]);

  // --- Map lifecycle --------------------------------------------------------
  useEffect(() => {
    const map = L.map(containerRef.current!, { worldCopyJump: true, zoomControl: false }).setView([41.7, 1.8], 7);
    L.control.zoom({ position: 'topright' }).addTo(map);
    pathsLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Person links inside popups are plain HTML, and playback swaps popup
    // content under them: delegate from the container instead of binding.
    const onPopupClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-person]');
      if (btn) onSelectRef.current(btn.dataset.person!);
    };
    containerRef.current!.addEventListener('click', onPopupClick);

    // The container resizes with side panels; Leaflet needs to be told.
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current!);

    const markers = markersRef.current;
    const container = containerRef.current!;
    return () => {
      container.removeEventListener('click', onPopupClick);
      observer.disconnect();
      map.remove();
      markers.clear();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current!;
    const base = BASE_LAYERS.find(b => b.id === baseId) ?? BASE_LAYERS[0];
    baseLayerRef.current?.remove();
    baseLayerRef.current = L.tileLayer(base.url, { attribution: base.attribution, maxZoom: base.maxZoom }).addTo(map);
    baseLayerRef.current.bringToBack();
  }, [baseId]);

  const historicLayer = historic === 'off'
    ? null
    : historic === 'auto'
      ? historicLayerForYear(year)
      : ICGC_HISTORIC_LAYERS.find(l => l.layer === historic) ?? null;

  useEffect(() => {
    const map = mapRef.current!;
    const name = historicLayer?.layer;
    const current = historicLayerRef.current;
    if (current && current.wmsParams.layers === name) return;
    current?.remove();
    historicLayerRef.current = null;
    if (!name) return;
    historicLayerRef.current = L.tileLayer.wms(ICGC_ORTO_WMS, {
      layers: name,
      format: 'image/jpeg',
      transparent: false,
      version: '1.3.0',
      attribution: ICGC_ATTRIBUTION,
      opacity: historicOpacity,
      maxZoom: 20,
    }).addTo(map);
    // Opacity has its own effect; switching layers must not wait for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historicLayer?.layer]);

  useEffect(() => {
    historicLayerRef.current?.setOpacity(historicOpacity);
  }, [historicOpacity, historicLayer?.layer]);

  // Pinning: the next click on the map places the chosen place there.
  useEffect(() => {
    const map = mapRef.current!;
    if (!pinning) return;
    const container = map.getContainer();
    container.style.cursor = 'crosshair';
    const onClick = (e: L.LeafletMouseEvent) => {
      pin(pinning, { lat: e.latlng.lat, lon: e.latlng.lng });
      setPinning(null);
    };
    map.once('click', onClick);
    return () => {
      map.off('click', onClick);
      container.style.cursor = '';
    };
  }, [pinning, pin]);

  // --- Timeline playback ----------------------------------------------------
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setYear(y => Math.min(maxYear, y + 1));
    }, 1000 / speed);
    return () => window.clearInterval(id);
  }, [playing, speed, maxYear]);

  useEffect(() => {
    if (playing && year >= maxYear) setPlaying(false);
  }, [playing, year, maxYear]);

  const togglePlay = () => {
    if (!playing && year >= maxYear) setYear(minYear);
    setPlaying(p => !p);
  };

  // --- Data for the current frame -------------------------------------------
  const byPlace = useMemo(() => {
    const groups = new Map<string, MapEvent[]>();
    for (const ev of events) {
      const list = groups.get(ev.place) ?? [];
      list.push(ev);
      groups.set(ev.place, list);
    }
    return groups;
  }, [events]);

  const paths = useMemo(() => personPaths(events), [events]);

  const missing = useMemo(
    () => [...byPlace.keys()].filter(place => results.get(place) === null).sort(),
    [byPlace, results],
  );
  const located = useMemo(
    () => [...byPlace.keys()].flatMap(place => {
      const r = results.get(place);
      return r ? [L.latLng(r.lat, r.lon)] : [];
    }),
    [byPlace, results],
  );

  // Fit once, when the first few places are known, then leave the view alone.
  useEffect(() => {
    if (fittedRef.current) return;
    if (!located.length || (done < total && located.length < 10)) return;
    mapRef.current!.fitBounds(L.latLngBounds(located), { ...FIT_PADDING, maxZoom: 10 });
    fittedRef.current = true;
  }, [located, done, total]);

  const fitAll = () => {
    if (located.length) mapRef.current!.fitBounds(L.latLngBounds(located), { ...FIT_PADDING, maxZoom: 12 });
  };

  // Markers: one per place, restyled each frame rather than rebuilt.
  useEffect(() => {
    const layer = markersLayerRef.current!;
    const markers = markersRef.current;

    for (const [place, placeEvents] of byPlace) {
      const coords = results.get(place);
      const past = placeEvents.filter(e => e.year <= year);
      let marker = markers.get(place);

      if (!coords || !past.length) {
        if (marker) layer.removeLayer(marker);
        continue;
      }

      const latest = past.at(-1)!;
      const age = year - latest.year;
      const recent = age < RECENT_WINDOW;
      const involvesSelected = !!selectedId && past.some(e => e.people.some(p => p.id === selectedId));
      const color = CATEGORY_COLORS[category(latest.type)];
      const style: L.CircleMarkerOptions = {
        radius: 5 + Math.sqrt(past.length) * 2.5,
        color: involvesSelected ? '#f59e0b' : recent ? '#ffffff' : color,
        weight: involvesSelected ? 4 : recent ? 3 : 1.5,
        fillColor: color,
        fillOpacity: recent ? 0.95 : Math.max(0.35, 0.8 - age / 100),
        opacity: 1,
      };

      if (!marker) {
        marker = L.circleMarker([coords.lat, coords.lon], style);
        markers.set(place, marker);
      } else {
        marker.setLatLng([coords.lat, coords.lon]);
        marker.setStyle(style);
        marker.setRadius(style.radius!);
      }
      if (!layer.hasLayer(marker)) layer.addLayer(marker);
      marker.getElement()?.classList.toggle('map-marker-recent', recent);
      if (recent) marker.bringToFront();

      const approx = coords.approximate ? ' <span class="map-popup-muted">(approximate)</span>' : '';
      const rows = past.slice(-30).reverse().map(ev => {
        const people = ev.people
          .map(p => `<button data-person="${escapeHtml(p.id)}">${escapeHtml(p.name)}</button>`)
          .join(' &amp; ');
        return `<li><span class="map-popup-year">${ev.year}</span> ${escapeHtml(eventLabel(ev.type))} · ${people}</li>`;
      }).join('');
      const more = past.length > 30 ? `<p class="map-popup-muted">+${past.length - 30} earlier</p>` : '';
      const popup = `<div class="map-popup"><strong>${escapeHtml(place)}</strong>${approx}<ul>${rows}</ul>${more}</div>`;
      const tooltip = `${escapeHtml(place)} · ${past.length}`;
      // Update in place: rebinding would close a popup open during playback.
      if (marker.getPopup()) marker.setPopupContent(popup);
      else marker.bindPopup(popup, { maxWidth: 320 });
      if (marker.getTooltip()) marker.setTooltipContent(tooltip);
      else marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -6] });
    }
    // After a data change some markers belong to places that no longer exist.
    for (const [place, marker] of markers) {
      if (!byPlace.has(place)) {
        layer.removeLayer(marker);
        markers.delete(place);
      }
    }
  }, [byPlace, results, year, selectedId]);

  // Journeys: consecutive places of each person, fading with time.
  useEffect(() => {
    const layer = pathsLayerRef.current!;
    layer.clearLayers();
    if (!showPaths) return;

    for (const [personId, path] of paths) {
      const selected = personId === selectedId;
      for (let i = 1; i < path.length; i++) {
        const from = results.get(path[i - 1].place);
        const to = results.get(path[i].place);
        const arrived = path[i].year;
        if (!from || !to || arrived > year) continue;
        const age = year - arrived;
        const opacity = selected ? 0.95 : Math.max(0.12, 0.7 * (1 - age / TRAIL_FADE));
        L.polyline([[from.lat, from.lon], [to.lat, to.lon]], {
          color: selected ? '#f59e0b' : '#7c3aed',
          weight: selected ? 4 : age < RECENT_WINDOW ? 3 : 1.5,
          opacity,
          dashArray: age < RECENT_WINDOW ? undefined : '4 4',
          interactive: false,
        }).addTo(layer);
      }
    }
  }, [paths, results, year, selectedId, showPaths]);

  // --- Render -----------------------------------------------------------------
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0 z-0" />
      {events.length === 0 ? (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center p-8 text-center text-muted-foreground bg-background/80">
          <div>
            <MapPin className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No events with both a date and a place in this view.</p>
          </div>
        </div>
      ) : (
      <>

      {/* Geocoding status */}
      <div className="absolute top-2 left-2 md:top-4 md:left-4 z-[1000] max-w-[calc(100%-5rem)] md:max-w-sm">
        <div className="rounded-lg border bg-background/95 backdrop-blur-sm shadow-md px-3 py-2 text-xs space-y-1.5">
          <div className="flex items-center gap-2">
            {done < total
              ? <div className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full shrink-0" />
              : <MapPin className="h-3.5 w-3.5 shrink-0" />}
            <span>
              {done < total ? `Locating places… ${done}/${total}` : `${located.length} of ${total} places located`}
            </span>
            {missing.length > 0 && (
              <button className="ml-auto text-primary underline-offset-2 hover:underline" onClick={() => setMissingOpen(o => !o)}>
                {missing.length} missing
              </button>
            )}
          </div>
          {pinning && (
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Crosshair className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Click the map to place “{pinning}”</span>
              <button className="ml-auto" onClick={() => setPinning(null)} title="Cancel"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
          {missingOpen && missing.length > 0 && (
            <div className="border-t pt-1.5 space-y-1">
              <ul className="max-h-48 overflow-y-auto space-y-0.5">
                {missing.map(place => (
                  <li key={place} className="flex items-center gap-2">
                    <span className="truncate flex-1" title={place}>{place}</span>
                    <button
                      className="shrink-0 text-primary underline-offset-2 hover:underline"
                      onClick={() => setPinning(place)}
                    >
                      Pin
                    </button>
                  </li>
                ))}
              </ul>
              <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground" onClick={retryMisses}>
                <RotateCw className="h-3 w-3" /> Retry lookup
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Layers */}
      <div className="absolute top-24 right-2 md:right-4 z-[1000] flex flex-col items-end gap-2">
        <Button variant="outline" size="icon" className="h-9 w-9 bg-background/95" onClick={fitAll} title="Fit all places">
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Button
          variant={layersOpen ? 'default' : 'outline'}
          size="icon"
          className={layersOpen ? 'h-9 w-9' : 'h-9 w-9 bg-background/95'}
          onClick={() => setLayersOpen(o => !o)}
          title="Map layers"
        >
          <Layers className="h-4 w-4" />
        </Button>
        {layersOpen && (
          <div className="w-64 rounded-lg border bg-background/95 backdrop-blur-sm shadow-md p-3 space-y-3 text-sm">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Base map</span>
              <select value={baseId} onChange={e => setBaseId(e.target.value)} className="w-full h-8 rounded-md border bg-background px-2">
                {BASE_LAYERS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">ICGC historical orthophoto</span>
              <select value={historic} onChange={e => setHistoric(e.target.value)} className="w-full h-8 rounded-md border bg-background px-2">
                <option value="off">Off</option>
                <option value="auto">Follow the timeline</option>
                {ICGC_HISTORIC_LAYERS.map(l => <option key={l.layer} value={l.layer}>{l.label}</option>)}
              </select>
              {historicLayer && (
                <span className="block text-xs text-muted-foreground">
                  Showing {historicLayer.label}. Catalonia only.
                </span>
              )}
            </label>
            {historicLayer && (
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Opacity {Math.round(historicOpacity * 100)}%</span>
                <input
                  type="range" min={0.1} max={1} step={0.05} value={historicOpacity}
                  onChange={e => setHistoricOpacity(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </label>
            )}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showPaths} onChange={e => setShowPaths(e.target.checked)} className="accent-primary" />
              <span>Show journeys</span>
            </label>
            <ul className="grid grid-cols-2 gap-1 text-xs border-t pt-2">
              {(Object.keys(CATEGORY_COLORS) as Category[]).map(c => (
                <li key={c} className="flex items-center gap-1.5 capitalize">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_COLORS[c] }} />
                  {c === 'other' ? 'Residence / other' : c}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <MapTimeline
        events={events}
        min={minYear}
        max={maxYear}
        year={year}
        playing={playing}
        speed={speed}
        window={RECENT_WINDOW}
        onYearChange={y => { setYear(y); setPlaying(false); }}
        onTogglePlay={togglePlay}
        onSpeedChange={setSpeed}
        onSelectPerson={onSelect}
      />
      </>
      )}
    </div>
  );
}
