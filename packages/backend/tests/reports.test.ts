import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// The parser's own tests import the source too: @gedcom/parser resolves to its
// built dist, which goes stale the moment the parser changes.
import { parseGedcom } from '../../parser/src/index.js';
import type { SerializedGedcomData } from '@gedcom/shared';
import { ancestorReport, migrationJourney, reportsTools } from '../src/tools/reports.js';

const DEMO_FILE = join(dirname(fileURLToPath(import.meta.url)), '../../../demo.ged');

// The Maps of GedcomData are the only thing standing between the parser output
// and what the server holds in memory after /api/upload.
const parsed = parseGedcom(readFileSync(DEMO_FILE, 'utf-8'));
const data: SerializedGedcomData = {
  individuals: Object.fromEntries(parsed.individuals),
  families: Object.fromEntries(parsed.families),
};

// demo.ged: Emily I5 ← Robert I3 + Sarah I4 ← John I1 + Mary I2.
describe('generate_ancestor_report', () => {
  const report = ancestorReport(data, 'I5');

  it('numbers the line canonically: subject 1, father 2k, mother 2k+1', () => {
    expect(report.map(e => [e.ahnentafel, e.id])).toEqual([
      [1, 'I5'],
      [2, 'I3'],
      [3, 'I4'],
      [4, 'I1'],
      [5, 'I2'],
    ]);
  });

  it('groups by generation and names the relation', () => {
    expect(report.map(e => [e.generation, e.relation])).toEqual([
      [1, 'Self'],
      [2, 'Father'],
      [2, 'Mother'],
      [3, 'Grandfather'],
      [3, 'Grandmother'],
    ]);
  });

  it('reports the age at death only when both dates are known', () => {
    const john = report.find(e => e.id === 'I1')!;
    expect(john.age_at_death).toBe(70);
    expect(john.death_place).toBe('Boston, Massachusetts, USA');
    expect(john.summary).toBe(
      'John Smith (1950–2020, born in Liverpool, England, died in Boston, Massachusetts, USA, died aged 70)'
    );

    // Mary is still alive in the file: no death, so no age.
    expect(report.find(e => e.id === 'I2')!.age_at_death).toBeNull();
  });

  it('stops at maxGenerations and defaults to 5', () => {
    expect(ancestorReport(data, 'I5', 2).map(e => e.id)).toEqual(['I5', 'I3', 'I4']);
    expect(ancestorReport(data, 'I5', 99)).toHaveLength(5);
  });

  it('returns nothing for an unknown id', () => {
    expect(ancestorReport(data, 'I999')).toEqual([]);
  });

  it('exposes the report as a tool that feeds AncestorList', async () => {
    const result = await reportsTools(data).generate_ancestor_report.execute!(
      { rootId: 'I5', maxGenerations: 5 },
      { toolCallId: 't1', messages: [] }
    );
    expect(result).toMatchObject({ total: 5, generations: 3 });
    expect(result.items[0]).toMatchObject({ ahnentafel: 1, name: 'Emily Smith', generation: 1 });
  });
});

describe('analyze_migration', () => {
  const journey = migrationJourney(data, 'I5');

  it('walks the family from its oldest recorded origin to the present', () => {
    expect(journey.rootName).toBe('Emily Smith');
    expect(journey.origin).toMatchObject({ year: 1950, place: 'Liverpool, England', personName: 'John Smith' });
    expect(journey.steps.map(s => [s.year, s.place])).toEqual([
      [1950, 'Liverpool, England'],
      [1952, 'Cork, Ireland'],
      [1971, 'New York, New York, USA'],
      [1972, 'Boston, Massachusetts, USA'],
      [1975, 'Boston, Massachusetts, USA'],
      [1978, 'Austin, Texas, USA'],
      [1998, 'Austin, Texas, USA'],
      [2001, 'Austin, Texas, USA'],
      [2005, 'Austin, Texas, USA'],
      [2020, 'Boston, Massachusetts, USA'],
    ]);
  });

  it('keeps the GEDCOM event tags, including the ones beyond birth and death', () => {
    expect(journey.steps.map(s => s.event)).toContain('IMMI');
    expect(journey.steps.map(s => s.event)).toContain('RESI');
    expect(journey.steps.filter(s => s.event === 'MARR')).toHaveLength(2);
  });

  it('records a marriage once even though both spouses are ancestors', () => {
    const marriages = journey.steps.filter(s => s.event === 'MARR');
    expect(new Set(marriages.map(s => s.year))).toEqual(new Set([1972, 2001]));
  });

  it('honours maxGenerations, dropping the grandparents from the journey', () => {
    const shallow = migrationJourney(data, 'I5', 2);
    expect(shallow.steps.every(s => s.generation <= 2)).toBe(true);
    expect(shallow.origin).toMatchObject({ year: 1975, place: 'Boston, Massachusetts, USA' });
  });

  it('returns an empty journey for an unknown id', () => {
    expect(migrationJourney(data, 'I999')).toEqual({ rootName: 'I999', origin: null, steps: [] });
  });

  it('exposes the journey as a tool that feeds MigrationTimeline', async () => {
    const result = await reportsTools(data).analyze_migration.execute!(
      { personId: 'I5', maxGenerations: 4 },
      { toolCallId: 't2', messages: [] }
    );
    expect(result.rootName).toBe('Emily Smith');
    expect(result.places).toEqual([
      'Liverpool, England',
      'Cork, Ireland',
      'New York, New York, USA',
      'Boston, Massachusetts, USA',
      'Austin, Texas, USA',
    ]);
  });
});
