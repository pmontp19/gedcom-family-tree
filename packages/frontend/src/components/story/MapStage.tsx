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

export function MapStage({ places, route, basemap }: { places: StoryPlace[]; route: boolean; basemap: StoryBasemap }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, { scrollWheelZoom: false });
    basemapLayer(basemap).addTo(map);

    const points = places.map(p => L.latLng(p.lat, p.lon));
    if (route && points.length > 1) {
      L.polyline(points, { color: ROUTE_COLOR, weight: 3, dashArray: '6 8' }).addTo(map);
    }
    places.forEach((p, i) => {
      const text = [route && places.length > 1 ? `${i + 1}.` : '', p.name, p.year ? `(${p.year})` : ''].filter(Boolean).join(' ');
      L.circleMarker(points[i], { radius: 7, color: '#fff', weight: 2, fillColor: ROUTE_COLOR, fillOpacity: 1 })
        .bindTooltip(p.label ? `${text}<br><span style="opacity:.7">${p.label}</span>` : text, {
          // Alternate sides: consecutive stops are often neighbouring villages.
          permanent: true, direction: i % 2 ? 'bottom' : 'top', offset: [0, i % 2 ? 8 : -8],
        })
        .addTo(map);
    });

    // One village: close enough to see its streets and fields; several: all of them.
    if (points.length === 1) map.setView(points[0], HISTORICAL[basemap] ? 15 : 12);
    else map.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 13 });

    return () => { map.remove(); };
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
