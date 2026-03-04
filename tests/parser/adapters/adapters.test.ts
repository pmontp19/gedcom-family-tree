import { describe, it, expect } from 'vitest';
import { Gedcom551Adapter } from '@/parser/adapters/gedcom-551.adapter';
import { MyHeritageAdapter } from '@/parser/adapters/myheritage.adapter';
import { buildTree } from '@/parser/tree-builder';
import { tokenizeLines } from '@/parser/tokenizer';

describe('adapters', () => {
  describe('Gedcom551Adapter', () => {
    const adapter = new Gedcom551Adapter();

    it('detects GEDCOM 5.5.1 format', () => {
      const tokens = tokenizeLines(`0 HEAD
1 GEDC
2 VERS 5.5.1
0 TRLR`);
      const tree = buildTree(tokens);
      expect(adapter.detect(tree)).toBe(true);
    });

    it('does not detect other formats', () => {
      const tokens = tokenizeLines(`0 HEAD
1 GEDC
2 VERS 7.0
0 TRLR`);
      const tree = buildTree(tokens);
      expect(adapter.detect(tree)).toBe(false);
    });

    it('parses individual with all fields', () => {
      const tokens = tokenizeLines(`0 HEAD
1 GEDC
2 VERS 5.5.1
0 @I1@ INDI
1 NAME John /Doe/
2 GIVN John
2 SURN Doe
1 SEX M
1 BIRT
2 DATE 7 JAN 1964
2 PLAC New York
1 DEAT
2 DATE 2020
1 FAMS @F1@
1 FAMC @F2@`);
      const tree = buildTree(tokens);
      const data = adapter.parse(tree);

      expect(data.individuals.size).toBe(1);
      const ind = data.individuals.get('I1');
      expect(ind).toBeDefined();
      expect(ind?.name?.full).toBe('John Doe');
      expect(ind?.name?.given).toBe('John');
      expect(ind?.name?.surname).toBe('Doe');
      expect(ind?.sex).toBe('M');
      expect(ind?.birth?.date?.day).toBe(7);
      expect(ind?.birth?.date?.month).toBe(1);
      expect(ind?.birth?.date?.year).toBe(1964);
      expect(ind?.birth?.place).toBe('New York');
      expect(ind?.death?.date?.year).toBe(2020);
      expect(ind?.fams).toContain('F1');
      expect(ind?.famc).toBe('F2');
    });

    it('parses family with marriage', () => {
      const tokens = tokenizeLines(`0 HEAD
1 GEDC
2 VERS 5.5.1
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
1 MARR
2 DATE 1990
2 PLAC Church`);
      const tree = buildTree(tokens);
      const data = adapter.parse(tree);

      expect(data.families.size).toBe(1);
      const fam = data.families.get('F1');
      expect(fam).toBeDefined();
      expect(fam?.husband).toBe('I1');
      expect(fam?.wife).toBe('I2');
      expect(fam?.children).toContain('I3');
      expect(fam?.marriage?.date?.year).toBe(1990);
      expect(fam?.marriage?.place).toBe('Church');
    });

    it('parses family with divorce', () => {
      const tokens = tokenizeLines(`0 HEAD
1 GEDC
2 VERS 5.5.1
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 DIV
2 DATE 2000`);
      const tree = buildTree(tokens);
      const data = adapter.parse(tree);

      const fam = data.families.get('F1');
      expect(fam?.divorce?.date?.year).toBe(2000);
    });
  });

  describe('MyHeritageAdapter', () => {
    const adapter = new MyHeritageAdapter();

    it('detects MyHeritage format', () => {
      const tokens = tokenizeLines(`0 HEAD
1 SOUR MYHERITAGE
0 TRLR`);
      const tree = buildTree(tokens);
      expect(adapter.detect(tree)).toBe(true);
    });

    it('does not detect other formats', () => {
      const tokens = tokenizeLines(`0 HEAD
1 SOUR OTHER
0 TRLR`);
      const tree = buildTree(tokens);
      expect(adapter.detect(tree)).toBe(false);
    });

    it('parses MyHeritage custom tags', () => {
      const tokens = tokenizeLines(`0 HEAD
1 SOUR MYHERITAGE
0 @I1@ INDI
1 _UID 67DB3F217EF0942BE0242809057258A8
1 _UPD 2 MAY 2025 03:54:23 GMT -0600
1 RIN MH:I1`);
      const tree = buildTree(tokens);
      const data = adapter.parse(tree);

      const ind = data.individuals.get('I1');
      expect(ind?.uid).toBe('67DB3F217EF0942BE0242809057258A8');
      expect(ind?.customTags.get('_UPD')).toBe('2 MAY 2025 03:54:23 GMT -0600');
      expect(ind?.rin).toBe('MH:I1');
    });

    it('parses header with custom tags', () => {
      const tokens = tokenizeLines(`0 HEAD
1 SOUR MYHERITAGE
2 NAME MyHeritage Family Tree Builder
2 VERS 5.5.1
1 GEDC
2 VERS 5.5.1
1 CHAR UTF-8
1 LANG Catalan
1 DATE 03 MAR 2026
1 _PROJECT_GUID 67DB3F21828DC43820242809057258A8`);
      const tree = buildTree(tokens);
      const data = adapter.parse(tree);

      expect(data.header.source).toBe('MYHERITAGE');
      expect(data.header.version).toBe('5.5.1');
      expect(data.header.char).toBe('UTF-8');
      expect(data.header.lang).toBe('Catalan');
      expect(data.header.date).toBe('03 MAR 2026');
      expect(data.header.customTags.get('_PROJECT_GUID')).toBe('67DB3F21828DC43820242809057258A8');
    });
  });

  describe('integration', () => {
    it('parses multiple marriages (I10 has F6 and F12)', () => {
      const tokens = tokenizeLines(`0 HEAD
1 SOUR MYHERITAGE
0 @I10@ INDI
1 NAME Mª Rosa /Ossó, Sendrós/
1 SEX F
1 FAMS @F6@
1 FAMS @F12@
1 FAMC @F7@`);
      const tree = buildTree(tokens);
      const adapter = new MyHeritageAdapter();
      const data = adapter.parse(tree);

      const ind = data.individuals.get('I10');
      expect(ind?.fams).toHaveLength(2);
      expect(ind?.fams).toContain('F6');
      expect(ind?.fams).toContain('F12');
      expect(ind?.famc).toBe('F7');
    });
  });
});
