import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { StoryBasemap, StoryPlace } from '@gedcom/shared/story';

const ICGC = '&copy; <a href="https://www.icgc.cat">Institut Cartogràfic i Geològic de Catalunya</a>';
const icgcWmts = (layer: string) => `https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wmts/${layer}/MON3857NW/{z}/{x}/{y}.png`;
const ICGC_WMS = 'https://geoserveis.icgc.cat/servei/catalunya/orto-territorial/wms';

/** The historical flights, named on the map so nobody mistakes them for today. */
const HISTORICAL: Partial<Record<StoryBasemap, { layer: string; label: string }>> = {
  'orto-1945': { layer: 'ortofoto_blanc_i_negre_1945-1946', label: 'Vol americà, 1945-1946' },
  'orto-1956': { layer: 'ortofoto_blanc_i_negre_1956-1957', label: 'Vol americà, 1956-1957' },
};

function basemapLayer(basemap: StoryBasemap): L.Layer {
  const historical = HISTORICAL[basemap];
  if (historical) {
    return L.tileLayer.wms(ICGC_WMS, { layers: historical.layer, format: 'image/jpeg', attribution: ICGC, maxZoom: 18 });
  }
  if (basemap === 'osm') {
    return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19,
    });
  }
  return L.tileLayer(icgcWmts(basemap), { attribution: ICGC, maxZoom: 18 });
}

const ROUTE_COLOR = '#c2410c';

/**
 * Long legs bow like a sea crossing instead of a ruler line; short hops
 * between villages stay straight.
 */
function arcRoute(points: L.LatLng[]): L.LatLng[] {
  const out = points.slice(0, 1);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dLat = b.lat - a.lat, dLon = b.lng - a.lng;
    if (Math.hypot(dLat, dLon) > 3) {
      // Control point: the midpoint pushed sideways by a fifth of the leg.
      const cLat = (a.lat + b.lat) / 2 + dLon * 0.2, cLon = (a.lng + b.lng) / 2 - dLat * 0.2;
      for (let t = 1 / 32; t < 1; t += 1 / 32) {
        const u = 1 - t;
        out.push(L.latLng(u * u * a.lat + 2 * u * t * cLat + t * t * b.lat, u * u * a.lng + 2 * u * t * cLon + t * t * b.lng));
      }
    }
    out.push(b);
  }
  return out;
}
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Text nodes, not an HTML string: names and labels come from imported files. */
function tooltip(text: string, label?: string): HTMLElement {
  const el = document.createElement('div');
  el.textContent = text;
  if (label) {
    const sub = el.appendChild(document.createElement('div'));
    sub.style.opacity = '.7';
    sub.textContent = label;
  }
  return el;
}

/**
 * One map for a run of map steps: the camera flies from one step's places to
 * the next, routes draw themselves, markers drop in after them.
 */
export function MapStage({ places, route, basemap }: { places: StoryPlace[]; route: boolean; basemap: StoryBasemap }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const viewed = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, { scrollWheelZoom: false, zoomSnap: 0.25 });
    mapRef.current = map;
    viewed.current = false;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const tiles = basemapLayer(basemap).addTo(map);
    return () => { tiles.remove(); };
  }, [basemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layers = L.layerGroup().addTo(map);
    const points = places.map(p => L.latLng(p.lat, p.lon));
    const animate = !reducedMotion();
    const timers: number[] = [];

    // Wide margins: labels sit above and below the dots. One village: close enough to see its streets and fields (aerial photos
    // only read up close); several: all of them.
    const target = points.length === 1
      ? { center: points[0], zoom: basemap.startsWith('orto') ? 15 : 12 }
      : (() => {
        const bounds = L.latLngBounds(points);
        return { center: bounds.getCenter(), zoom: Math.min(map.getBoundsZoom(bounds, false, L.point(320, 280)), 15) };
      })();
    // The first view of a run starts higher up and descends: an establishing
    // shot. Later steps fly from wherever the camera is.
    if (animate && !viewed.current) map.setView(target.center, Math.max(target.zoom - 3, 1), { animate: false });
    viewed.current = true;
    const flight = animate ? 2.2 : 0;
    if (animate) map.flyTo(target.center, target.zoom, { duration: flight });
    else map.setView(target.center, target.zoom);

    const drawRoute = route && points.length > 1;
    if (drawRoute) {
      const line = L.polyline(arcRoute(points), { color: ROUTE_COLOR, weight: 3, className: animate ? 'story-route' : '' }).addTo(layers);
      // pathLength=1 lets CSS draw any route with the same dash offset.
      line.getElement()?.setAttribute('pathLength', '1');
      (line.getElement() as SVGElement | undefined)?.style.setProperty('animation-delay', `${flight}s`);
    }
    places.forEach((p, i) => {
      const text = [drawRoute ? `${i + 1}.` : '', p.name, p.year ? `(${p.year})` : ''].filter(Boolean).join(' ');
      const marker = L.circleMarker(points[i], {
        radius: 7, color: '#fff', weight: 2, fillColor: ROUTE_COLOR, fillOpacity: 1,
        className: animate ? 'story-marker' : '',
      }).addTo(layers);
      // Stops appear as the route reaches them.
      const delay = flight + (drawRoute ? 1.6 * (i / (points.length - 1)) : 0.1 * i);
      (marker.getElement() as SVGElement | undefined)?.style.setProperty('animation-delay', `${delay}s`);
      const show = () => marker.bindTooltip(tooltip(text, p.label), {
        // Alternate sides: consecutive stops are often neighbouring villages.
        permanent: true, direction: i % 2 ? 'bottom' : 'top', offset: [0, i % 2 ? 8 : -8], className: 'story-tooltip',
      }).openTooltip();
      if (animate) timers.push(window.setTimeout(show, (delay + 0.3) * 1000));
      else show();
    });
    return () => { timers.forEach(clearTimeout); layers.remove(); };
  }, [places, route, basemap]);

  const historical = HISTORICAL[basemap];
  return (
    <div className="absolute inset-0">
      <div ref={ref} className="h-full w-full" />
      {historical && (
        <span className="absolute top-3 right-3 z-[1000] rounded bg-background/90 px-2 py-1 text-xs font-medium shadow">
          {historical.label}
        </span>
      )}
    </div>
  );
}
