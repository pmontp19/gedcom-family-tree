import { describe, it, expect } from 'vitest';
import { parseGedcom } from '@gedcom/parser';
import { collectMapEvents, personPaths, histogram } from '../src/visualization/map-events';
import { historicLayerForYear } from '../src/visualization/icgc-layers';

const GED = `0 HEAD
1 GEDC
2 VERS 5.5.1
0 @I1@ INDI
1 NAME Joan /Puig/
1 BIRT
2 DATE 12 MAR 1890
2 PLAC Olot, Girona, Catalunya
3 MAP
4 LATI N42.18
4 LONG E2.49
1 RESI
2 DATE 1915
2 PLAC Barcelona, Catalunya
1 RESI
2 DATE 1920
2 PLAC Barcelona, Catalunya
1 DEAT
2 DATE 1960
2 PLAC Buenos Aires, Argentina
1 OCCU
2 PLAC Nowhere in time
1 FAMS @F1@
0 @I2@ INDI
1 NAME Maria /Soler/
1 BIRT
2 DATE 1895
1 FAMS @F1@
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 MARR
2 DATE JUN 1914
2 PLAC Olot, Girona, Catalunya
0 TRLR`;

describe('collectMapEvents', () => {
  const events = collectMapEvents(parseGedcom(GED));

  it('keeps only dated, placed events, oldest first', () => {
    expect(events.map(e => [e.type, e.year])).toEqual([
      ['BIRT', 1890], ['MARR', 1914], ['RESI', 1915], ['RESI', 1920], ['DEAT', 1960],
    ]);
  });

  it('lists a family event once, with both spouses', () => {
    const marr = events.find(e => e.type === 'MARR')!;
    expect(marr.people.map(p => p.name)).toEqual(['Joan Puig', 'Maria Soler']);
  });

  it('carries PLAC.MAP coordinates through', () => {
    expect(events[0].coords).toEqual({ lat: 42.18, lon: 2.49 });
  });

  it('orders same-year events by month', () => {
    const ev = collectMapEvents(parseGedcom(GED)).find(e => e.type === 'MARR')!;
    expect(ev.when).toBeGreaterThan(1914.4);
    expect(ev.when).toBeLessThan(1914.5);
  });
});

describe('personPaths', () => {
  it('collapses consecutive stays in one place into a single stop', () => {
    const paths = personPaths(collectMapEvents(parseGedcom(GED)));
    expect(paths.get('I1')!.map(e => e.place)).toEqual([
      'Olot, Girona, Catalunya', 'Barcelona, Catalunya', 'Buenos Aires, Argentina',
    ]);
  });
});

describe('histogram', () => {
  it('buckets events by year span', () => {
    const events = collectMapEvents(parseGedcom(GED));
    expect(histogram(events, 1890, 1969, 10)).toEqual([1, 0, 2, 1, 0, 0, 0, 1]);
  });
});

describe('historicLayerForYear', () => {
  it('picks the latest flight not after the year', () => {
    expect(historicLayerForYear(1960).from).toBe(1956);
    expect(historicLayerForYear(1956).from).toBe(1956);
    expect(historicLayerForYear(2030).layer).toBe('ortofoto_color_vigent');
  });

  it('falls back to the oldest flight before 1945', () => {
    expect(historicLayerForYear(1850).from).toBe(1945);
  });
});
