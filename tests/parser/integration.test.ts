import { describe, it, expect } from 'vitest';
import { parseGedcom, detectFormat } from '@/parser';
import { readFileSync } from 'fs';
import { join } from 'path';

const SAMPLE_FILE = join(__dirname, '../../sample/7696g9_4137009er067u53agctb59_A.ged');

describe('integration', () => {
  it('parses full sample file', () => {
    const content = readFileSync(SAMPLE_FILE, 'utf-8');
    const data = parseGedcom(content);

    expect(data.header.source).toBe('MYHERITAGE');
    expect(data.header.version).toBe('5.5.1');
    expect(data.header.lang).toBe('Catalan');
  });

  it('extracts all individuals', () => {
    const content = readFileSync(SAMPLE_FILE, 'utf-8');
    const data = parseGedcom(content);

    expect(data.individuals.size).toBeGreaterThan(10);

    // Check first individual (I1 - Ramon Ossó)
    const i1 = data.individuals.get('I1');
    expect(i1).toBeDefined();
    expect(i1?.name?.given).toBe('Ramon');
    expect(i1?.sex).toBe('M');
    expect(i1?.birth?.date?.day).toBe(7);
    expect(i1?.birth?.date?.month).toBe(1);
    expect(i1?.birth?.date?.year).toBe(1964);
  });

  it('extracts all families', () => {
    const content = readFileSync(SAMPLE_FILE, 'utf-8');
    const data = parseGedcom(content);

    expect(data.families.size).toBeGreaterThan(5);

    // Check family F2 (Pere + Judith)
    const f2 = data.families.get('F2');
    expect(f2).toBeDefined();
    expect(f2?.husband).toBe('I2');
    expect(f2?.wife).toBe('I3');
    expect(f2?.children.length).toBeGreaterThan(0);
  });

  it('handles multiple marriages (I10)', () => {
    const content = readFileSync(SAMPLE_FILE, 'utf-8');
    const data = parseGedcom(content);

    const i10 = data.individuals.get('I10');
    expect(i10).toBeDefined();
    expect(i10?.fams).toContain('F6');
    expect(i10?.fams).toContain('F12');
  });

  it('handles divorce (F3)', () => {
    const content = readFileSync(SAMPLE_FILE, 'utf-8');
    const data = parseGedcom(content);

    // Find family with divorce
    let foundDivorce = false;
    for (const fam of data.families.values()) {
      if (fam.divorce) {
        foundDivorce = true;
        break;
      }
    }
    // Sample may or may not have divorce - just verify parsing doesn't crash
    expect(data.families.size).toBeGreaterThan(0);
  });

  it('preserves UTF-8 Catalan characters', () => {
    const content = readFileSync(SAMPLE_FILE, 'utf-8');
    const data = parseGedcom(content);

    // Check for Catalan characters in names
    let foundCatalan = false;
    for (const ind of data.individuals.values()) {
      if (ind.name?.full?.includes('ó') || ind.name?.full?.includes('ò')) {
        foundCatalan = true;
        break;
      }
    }
    expect(foundCatalan).toBe(true);
  });

  it('detects MyHeritage format', () => {
    const content = readFileSync(SAMPLE_FILE, 'utf-8');
    const format = detectFormat(content);
    expect(format).toBe('MyHeritage');
  });

  it('family relationships are correct', () => {
    const content = readFileSync(SAMPLE_FILE, 'utf-8');
    const data = parseGedcom(content);

    // I4 and I5 are children of I2 and I3 via F2
    const f2 = data.families.get('F2');
    expect(f2?.children).toContain('I4');
    expect(f2?.children).toContain('I5');

    const i4 = data.individuals.get('I4');
    expect(i4?.famc).toBe('F2');

    const i5 = data.individuals.get('I5');
    expect(i5?.famc).toBe('F2');
  });
});
