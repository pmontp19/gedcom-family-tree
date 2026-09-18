import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getFamilySpouses } from '@gedcom/shared';
import { Gedcom7Adapter } from '../../src/adapters/gedcom-70.adapter.js';
import { Gedcom551Adapter } from '../../src/adapters/gedcom-551.adapter.js';
import { buildTree } from '../../src/tree-builder.js';
import { tokenizeLines } from '../../src/tokenizer.js';
import { parseGedcom, detectFormat } from '../../src/index.js';

const FIXTURES_70 = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/gedcom70');
const fixture = (name: string) => readFileSync(join(FIXTURES_70, `${name}.ged`), 'utf-8');
const parse = (content: string) => new Gedcom7Adapter().parse(buildTree(tokenizeLines(content)));

describe('Gedcom7Adapter', () => {
  const adapter = new Gedcom7Adapter();

  describe('canonical version detection', () => {
    const detect = (content: string) => adapter.detect(buildTree(tokenizeLines(content)));

    it('detects 7.0 from HEAD.GEDC.VERS', () => {
      expect(detect(fixture('minimal70'))).toBe(true);
    });

    it('detects any 7.x revision', () => {
      expect(detect('0 HEAD\n1 GEDC\n2 VERS 7.0.14\n0 TRLR')).toBe(true);
    });

    it('rejects 5.5.1 and files without HEAD.GEDC.VERS', () => {
      expect(detect('0 HEAD\n1 GEDC\n2 VERS 5.5.1\n0 TRLR')).toBe(false);
      expect(detect('0 HEAD\n1 SOUR MYHERITAGE\n0 TRLR')).toBe(false);
      expect(detect('0 @I1@ INDI\n1 NAME John /Doe/')).toBe(false);
    });

    it('does not steal 7.0 files from the 5.5.1 adapter and vice versa', () => {
      const tree = buildTree(tokenizeLines(fixture('minimal70')));
      expect(new Gedcom551Adapter().detect(tree)).toBe(false);
    });

    it('routes 7.0 content through parseGedcom and detectFormat', () => {
      expect(detectFormat(fixture('same-sex-marriage'))).toBe('GEDCOM 7.0');
      expect(parseGedcom(fixture('same-sex-marriage')).individuals.size).toBe(2);
    });
  });

  describe('header', () => {
    it('reads the 7.0 version from minimal70', () => {
      const header = parse(fixture('minimal70')).header;
      expect(header.version).toBe('7.0');
    });

    it('assumes UTF-8, which 7.0 mandates and no longer spells out in HEAD.CHAR', () => {
      expect(parse(fixture('minimal70')).header.char).toBe('UTF-8');
    });

    it('keeps an explicit HEAD.CHAR when a file still carries one', () => {
      const header = parse('0 HEAD\n1 GEDC\n2 VERS 7.0\n1 CHAR UTF-8\n0 TRLR').header;
      expect(header.char).toBe('UTF-8');
    });

    it('preserves HEAD.SCHMA extension tags with their defining URI', () => {
      const header = parse(fixture('maximal70')).header;
      expect(header.customTags.get('_SKYPEID')).toBe('http://xmlns.com/foaf/0.1/skypeID');
      expect(header.customTags.get('_JABBERID')).toBe('http://xmlns.com/foaf/0.1/jabberID');
    });

    it('preserves gedcom.io term URIs declared for extension tags', () => {
      const header = parse([
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '1 SCHMA',
        '2 TAG _DATE https://gedcom.io/terms/v7/DATE',
        '2 TAG _MALFORMED',
        '0 TRLR',
      ].join('\n')).header;

      expect(header.customTags.get('_DATE')).toBe('https://gedcom.io/terms/v7/DATE');
      expect(header.customTags.has('_MALFORMED')).toBe(false);
    });
  });

  describe('CONT continuations', () => {
    it('joins CONT lines with a line break (7.0 has no CONC)', () => {
      const data = parse([
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @I1@ INDI',
        '1 NOTE Line one',
        '2 CONT Line two',
        '2 CONT ',
        '2 CONT Line four',
        '0 TRLR',
      ].join('\n'));

      expect(data.individuals.get('I1')?.notes[0]).toBe('Line one\nLine two\n\nLine four');
    });

    it('reads UTF-8 payloads and a leading BOM', () => {
      const data = parse('﻿0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 NAME Núria /Ossó i Çelik/\n0 TRLR');
      expect(data.individuals.get('I1')?.name?.surname).toBe('Ossó i Çelik');
    });
  });

  describe('same-sex-marriage.ged', () => {
    const data = parse(fixture('same-sex-marriage'));

    it('lists both partners as spouses regardless of sex', () => {
      const f1 = data.families.get('F1')!;
      expect(getFamilySpouses(f1)).toEqual(['I1', 'I2']);
      expect(data.individuals.get('I1')?.sex).toBe('M');
      expect(data.individuals.get('I2')?.sex).toBe('M');
    });

    it('links both partners back to the family through FAMS', () => {
      expect(data.individuals.get('I1')?.fams).toEqual(['F1']);
      expect(data.individuals.get('I2')?.fams).toEqual(['F1']);
    });
  });

  describe('remarriage fixtures', () => {
    it('remarriage1: divorce then a second marriage recorded on the same family', () => {
      const data = parse(fixture('remarriage1'));

      expect(data.individuals.get('I1')?.fams).toEqual(['F1', 'F2']);
      expect(data.families.get('F1')?.divorce?.date).toMatchObject({ day: 2, month: 5, year: 1912 });
      // F1 carries two MARR structures (married, divorced, remarried). Both are kept
      // in `events` in file order; the single `marriage` slot holds the last one.
      const marriages = data.families.get('F1')!.events.filter(e => e.type === 'MARR');
      expect(marriages.map(e => e.date?.year)).toEqual([1911, 1914]);
      expect(data.families.get('F1')?.marriage?.date).toMatchObject({ day: 4, month: 7, year: 1914 });
      expect(data.families.get('F2')?.marriage?.date).toMatchObject({ day: 3, month: 6, year: 1913 });
      expect(data.families.get('F2')?.divorce).toBeUndefined();
    });

    it('remarriage2: the same couple recorded as a third family', () => {
      const data = parse(fixture('remarriage2'));

      expect(data.individuals.get('I1')?.fams).toEqual(['F1', 'F2', 'F3']);
      expect(data.individuals.get('I2')?.fams).toEqual(['F1', 'F3']);
      expect(getFamilySpouses(data.families.get('F1')!)).toEqual(['I1', 'I2']);
      expect(getFamilySpouses(data.families.get('F3')!)).toEqual(['I1', 'I2']);
      expect(data.families.get('F1')?.divorce?.date).toMatchObject({ day: 2, month: 5, year: 1912 });
      expect(data.families.get('F3')?.marriage?.date).toMatchObject({ day: 4, month: 7, year: 1914 });
    });
  });

  describe('maximal70.ged', () => {
    it('parses without throwing', () => {
      expect(() => parse(fixture('maximal70'))).not.toThrow();
    });

    it('extracts header, individuals, families and sources', () => {
      const data = parse(fixture('maximal70'));

      expect(data.header.version).toBe('7.0');
      expect(data.header.source).toBe('https://gedcom.io/');
      expect(data.header.date).toBe('10 JUN 2022');
      expect(data.header.lang).toBe('en-US');
      expect(data.individuals.size).toBe(4);
      expect(data.families.size).toBe(2);
      expect(data.sources.size).toBeGreaterThan(0);
    });

    it('keeps the spouse and child relationships of F1', () => {
      const f1 = parse(fixture('maximal70')).families.get('F1')!;

      expect(getFamilySpouses(f1)).toEqual(['I1', 'I2']);
      expect(f1.children).toEqual(['I4']);
      expect(f1.marriage).toBeDefined();
    });

    it('drops @VOID@ pointers instead of inventing a "VOID" record', () => {
      const data = parse(fixture('maximal70'));

      for (const fam of data.families.values()) {
        expect(fam.children).not.toContain('VOID');
        expect([fam.husband, fam.wife]).not.toContain('VOID');
      }
      expect(data.individuals.has('VOID')).toBe(false);
    });
  });

  it('parses every official 7.0 fixture without throwing', () => {
    for (const name of ['minimal70', 'maximal70', 'same-sex-marriage', 'remarriage1', 'remarriage2', 'age']) {
      expect(() => parse(fixture(name)), name).not.toThrow();
      expect(parse(fixture(name)).header.version, name).toBe('7.0');
    }
  });
});
