import { describe, it, expect } from 'vitest';
import { parseGedcom, detectFormat, tokenizeLines, buildTree } from '../src/index.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEMO_FILE = join(__dirname, '../../../demo.ged');
const FIXTURES_70 = join(__dirname, 'fixtures/gedcom70');

const read = (path: string) => readFileSync(path, 'utf-8');
const readFixture70 = (name: string) => read(join(FIXTURES_70, `${name}.ged`));

describe('integration: demo.ged', () => {
  const data = parseGedcom(read(DEMO_FILE));

  it('parses the header', () => {
    expect(data.header.source).toBe('DEMO');
    expect(data.header.version).toBe('5.5.1');
    expect(data.header.char).toBe('UTF-8');
  });

  it('detects GEDCOM 5.5.1 format', () => {
    expect(detectFormat(read(DEMO_FILE))).toBe('GEDCOM 5.5.1');
  });

  it('extracts all individuals with names, sex and dates', () => {
    expect(data.individuals.size).toBe(6);

    const i1 = data.individuals.get('I1');
    expect(i1?.name?.given).toBe('John');
    expect(i1?.name?.surname).toBe('Smith');
    expect(i1?.sex).toBe('M');
    expect(i1?.birth?.date).toMatchObject({ day: 1, month: 1, year: 1950 });
    expect(i1?.death?.date).toMatchObject({ day: 1, month: 1, year: 2020 });
  });

  it('extracts all families', () => {
    expect(data.families.size).toBe(2);

    const f2 = data.families.get('F2');
    expect(f2?.husband).toBe('I3');
    expect(f2?.wife).toBe('I4');
    expect(f2?.children).toEqual(['I5', 'I6']);
  });

  it('links individuals to families in both directions', () => {
    const i3 = data.individuals.get('I3');
    expect(i3?.famc).toEqual(['F1']);
    expect(i3?.fams).toEqual(['F2']);

    expect(data.families.get('F1')?.children).toContain('I3');
  });
});

// Official GEDCOM 7.0 test files from https://gedcom.io/testfiles/gedcom70/
// A dedicated 7.0 adapter lands in a later task; until then these assert that
// the tokenizer and tree-builder handle 7.0 input without dropping lines.
describe('integration: official GEDCOM 7.0 fixtures', () => {
  const FIXTURES = ['minimal70', 'same-sex-marriage', 'remarriage1', 'remarriage2', 'age', 'maximal70'];

  it.each(FIXTURES)('tokenizes %s.ged without dropping lines', (name) => {
    const content = readFixture70(name);
    const gedcomLines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => /^\d/.test(l));
    const tokens = tokenizeLines(content);

    expect(tokens.length).toBe(gedcomLines.length);
    expect(tokens.every(t => Number.isInteger(t.level) && t.tag.length > 0)).toBe(true);
  });

  it.each(FIXTURES)('builds a tree for %s.ged rooted at level-0 records', (name) => {
    const tokens = tokenizeLines(readFixture70(name));
    const tree = buildTree(tokens);

    expect(tree.length).toBeGreaterThan(0);
    expect(tree.every(n => n.level === 0)).toBe(true);
    expect(tree[0].tag).toBe('HEAD');
    expect(tree[tree.length - 1].tag).toBe('TRLR');
  });

  it.each(FIXTURES)('parses %s.ged and reads the 7.0 version from the header', (name) => {
    expect(parseGedcom(readFixture70(name)).header.version).toBe('7.0');
  });

  it('minimal70 has no records beyond the header and trailer', () => {
    const data = parseGedcom(readFixture70('minimal70'));
    expect(data.individuals.size).toBe(0);
    expect(data.families.size).toBe(0);
  });

  it('same-sex-marriage keeps both spouses linked to the family', () => {
    const data = parseGedcom(readFixture70('same-sex-marriage'));
    const f1 = data.families.get('F1');

    expect([f1?.husband, f1?.wife]).toEqual(['I1', 'I2']);
    expect(data.individuals.get('I1')?.sex).toBe('M');
    expect(data.individuals.get('I2')?.sex).toBe('M');
    expect(data.individuals.get('I2')?.fams).toEqual(['F1']);
  });

  it('remarriage1 records a divorce and a second marriage', () => {
    const data = parseGedcom(readFixture70('remarriage1'));

    expect(data.individuals.get('I1')?.fams).toEqual(['F1', 'F2']);
    expect(data.families.get('F1')?.divorce).toBeDefined();
    expect(data.families.get('F2')?.marriage).toBeDefined();
    expect(data.families.get('F2')?.divorce).toBeUndefined();
  });

  it('remarriage2 records remarrying the same spouse', () => {
    const data = parseGedcom(readFixture70('remarriage2'));

    expect(data.individuals.get('I1')?.fams).toEqual(['F1', 'F2', 'F3']);
    expect(data.families.get('F1')?.wife).toBe('I2');
    expect(data.families.get('F3')?.wife).toBe('I2');
    expect(data.families.get('F1')?.marriage?.date).toMatchObject({ day: 1, month: 4, year: 1911 });
    expect(data.families.get('F3')?.marriage?.date).toMatchObject({ day: 4, month: 7, year: 1914 });
  });

  it('age keeps every AGE-bearing event on the individual', () => {
    const data = parseGedcom(readFixture70('age'));
    const i1 = data.individuals.get('I1');

    expect(i1).toBeDefined();
    expect(i1!.events.filter(e => e.type === 'CHR').length).toBeGreaterThan(20);
  });

  it('maximal70 exercises individuals, families and sources', () => {
    const data = parseGedcom(readFixture70('maximal70'));

    expect(data.individuals.size).toBeGreaterThan(0);
    expect(data.families.size).toBeGreaterThan(0);
    expect(data.sources.size).toBeGreaterThan(0);
  });
});
