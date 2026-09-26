// Historical layers from the Institut Cartogràfic i Geològic de Catalunya.
// The orthophoto series goes back to the 1945-46 "vol americà", so a timeline
// sitting in 1950 can show Catalonia roughly as those people saw it.
// Coverage is Catalonia only; outside it the overlay is simply empty.

export const ICGC_ORTO_WMS = 'https://geoserveis.icgc.cat/servei/catalunya/orto-territorial/wms';
export const ICGC_ATTRIBUTION = '&copy; <a href="https://www.icgc.cat" target="_blank" rel="noopener">Institut Cartogràfic i Geològic de Catalunya</a>';

export interface HistoricLayer {
  /** WMS layer name on the orto-territorial service. */
  layer: string;
  label: string;
  /** First year the flight covers: the layer applies from here on. */
  from: number;
}

/** Oldest first. One representative flight per era keeps the menu short. */
export const ICGC_HISTORIC_LAYERS: HistoricLayer[] = [
  { layer: 'ortofoto_blanc_i_negre_1945-1946', label: '1945–46 (American flight, series A)', from: 1945 },
  { layer: 'ortofoto_blanc_i_negre_1956-1957', label: '1956–57 (American flight, series B)', from: 1956 },
  { layer: 'ortofoto_blanc_i_negre_1970-1977', label: '1970–77', from: 1970 },
  { layer: 'ortofoto_blanc_i_negre_1983-1989', label: '1983–89', from: 1983 },
  { layer: 'ortofoto_blanc_i_negre_1994-1997', label: '1994–97', from: 1994 },
  { layer: 'ortofoto_color_2000-2003', label: '2000–03', from: 2000 },
  { layer: 'ortofoto_color_2010', label: '2010', from: 2010 },
  { layer: 'ortofoto_color_vigent', label: 'Current', from: 2020 },
];

/**
 * The flight closest to `year` without being from its future; before 1945 the
 * oldest flight is still the nearest picture of that landscape.
 */
export function historicLayerForYear(year: number): HistoricLayer {
  let best = ICGC_HISTORIC_LAYERS[0];
  for (const layer of ICGC_HISTORIC_LAYERS) {
    if (layer.from <= year) best = layer;
  }
  return best;
}

export interface BaseLayer {
  id: string;
  label: string;
  url: string;
  attribution: string;
  maxZoom: number;
}

export const BASE_LAYERS: BaseLayer[] = [
  {
    id: 'osm',
    label: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  {
    id: 'icgc-topo',
    label: 'ICGC topographic',
    url: 'https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wmts/topografic/MON3857NW/{z}/{x}/{y}.png',
    attribution: ICGC_ATTRIBUTION,
    maxZoom: 20,
  },
  {
    id: 'icgc-topo-gris',
    label: 'ICGC topographic (grey)',
    url: 'https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wmts/topografic-gris/MON3857NW/{z}/{x}/{y}.png',
    attribution: ICGC_ATTRIBUTION,
    maxZoom: 20,
  },
];
