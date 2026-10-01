import { describe, it, expect } from 'vitest';
import { parseGedcom, parseGedcomWithFormat, decodeGedcom, parseDate } from '../src/index.js';

const lines = [
  '0 HEAD', '1 GEDC', '2 VERS 5.5.1', '1 CHAR UTF-8',
  '0 @I-1@ INDI', '1 NAME Joan /Puig/',
  '1 BIRT', '2 DATE @#DJULIAN@ 12 MAR 1700', '1 BIRT', '2 DATE 1701',
  '1 FAMS @F-1@',
  '1 NOTE Hola', '2 SOUR @S1@', '2 CONC  mon', '2 CONT linia2',
  '  1 SEX M',
  '0 @I2@ INDI', '1 NAME Maria /Roca/', '1 FAMS @F-1@',
  '0 @F-1@ FAM', '1 HUSB @I-1@', '1 WIFE @I2@', '0 TRLR',
];

describe('parser robustness', () => {
  it.each(['\n', '\r\n', '\r', '\n\r'])('parses with %j line endings', (eol) => {
    const data = parseGedcom(lines.join(eol));
    expect(data.individuals.size).toBe(2);
  });

  it('links xrefs with non-word characters', () => {
    const data = parseGedcom(lines.join('\n'));
    expect(data.families.get('F-1')?.husband).toBe('I-1');
    expect(data.individuals.get('I-1')?.fams).toEqual(['F-1']);
  });

  it('continues the NOTE, not the SOUR opened under it, and keeps CONC spaces', () => {
    const data = parseGedcom(lines.join('\n'));
    expect(data.individuals.get('I-1')?.notes).toEqual(['Hola mon\nlinia2']);
  });

  it('ignores leading whitespace', () => {
    expect(parseGedcom(lines.join('\n')).individuals.get('I-1')?.sex).toBe('M');
  });

  it('prefers the first BIRT and keeps every one in events', () => {
    const ind = parseGedcom(lines.join('\n')).individuals.get('I-1')!;
    expect(ind.birth?.date).toEqual({ day: 12, month: 3, year: 1700 });
    expect(ind.events.filter(e => e.type === 'BIRT')).toHaveLength(2);
  });

  it('fills in links written on one side only', () => {
    const data = parseGedcom([
      '0 HEAD', '0 @H@ INDI', '0 @W@ INDI', '0 @K@ INDI', '1 FAMC @F@', '0 @K2@ INDI',
      '0 @F@ FAM', '1 HUSB @H@', '1 WIFE @W@', '1 CHIL @K2@', '0 TRLR',
    ].join('\n'));
    expect(data.individuals.get('H')?.fams).toEqual(['F']);
    expect(data.individuals.get('K2')?.famc).toEqual(['F']);
    expect(data.families.get('F')?.children).toEqual(['K2', 'K']);
  });

  it('reports the format from a single parse', () => {
    expect(parseGedcomWithFormat(lines.join('\n')).format).toBe('GEDCOM 5.5.1');
  });
});

describe('parseDate calendars and ranges', () => {
  it('drops Julian/Gregorian escapes', () => {
    expect(parseDate('@#DJULIAN@ 1700')).toEqual({ year: 1700 });
    expect(parseDate('ABT JULIAN 1700')).toEqual({ qualifier: 'ABT', year: 1700 });
    expect(parseDate('BET @#DJULIAN@ 1700 AND @#DGREGORIAN@ 1710')).toEqual({ qualifier: 'BET', year: 1700, endDate: { year: 1710 } });
  });

  it('keeps other calendars as text', () => {
    expect(parseDate('@#DHEBREW@ 5600')).toEqual({ text: '@#DHEBREW@ 5600' });
  });

  it('parses FROM ... TO and INT', () => {
    expect(parseDate('FROM 1720 TO 1730')).toEqual({ qualifier: 'FROM', year: 1720, endDate: { year: 1730 } });
    expect(parseDate('INT 5 JAN 1725 (cinc de gener)')).toEqual({ day: 5, month: 1, year: 1725 });
  });
});

describe('decodeGedcom', () => {
  const text = '0 HEAD\n1 CHAR UTF-8\n0 @I1@ INDI\n1 NAME Àngel /Ossó/\n0 TRLR\n';
  const utf16le = (s: string) => new Uint8Array([...s].flatMap(c => [c.charCodeAt(0) & 0xff, c.charCodeAt(0) >> 8]));

  it('decodes UTF-16 with and without BOM', () => {
    expect(decodeGedcom(new Uint8Array([0xff, 0xfe, ...utf16le(text)]))).toBe(text);
    expect(decodeGedcom(utf16le(text))).toBe(text);
  });

  it('decodes UTF-8, ignoring a CHAR mislabel', () => {
    expect(decodeGedcom(new TextEncoder().encode(text.replace('UTF-8', 'ANSEL')))).toContain('Àngel /Ossó/');
  });

  it('decodes ANSEL combining marks and ANSI', () => {
    const ansel = [...'0 HEAD\n1 CHAR ANSEL\n1 NAME Oss'].map(c => c.charCodeAt(0));
    expect(decodeGedcom(new Uint8Array([...ansel, 0xe2, 0x6f]))).toContain('Ossó');
    const ansi = [...'0 HEAD\n1 CHAR ANSI\n1 NAME Oss'].map(c => c.charCodeAt(0));
    expect(decodeGedcom(new Uint8Array([...ansi, 0xf3]))).toContain('Ossó');
  });
});
