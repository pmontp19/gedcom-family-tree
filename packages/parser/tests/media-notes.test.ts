import { describe, it, expect } from 'vitest';
import { parseGedcom } from '../src/index.js';

const GED_WITH_MEDIA = `0 HEAD
1 GEDC
2 VERS 5.5.1
0 @I1@ INDI
1 NAME Ramon /Ossó Sendrós/
1 SEX M
1 OBJE
2 FORM jpg
2 FILE actes/documents_familiars/llibre_familia_p21.jpg
2 TITL Llibre de família
2 NOTE [T1 2026-09-12] Llibre de família: fill tercer.
1 OBJE
2 FORM jpg
2 FILE actes/myheritage/500008_A.jpg
2 _FILESIZE 185705
2 _PRIM Y
2 _CUTOUT Y
1 BIRT
2 DATE 7 JAN 1964
2 NOTE Nota de naixement inline
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 MARR
2 DATE 22 APR 1957
1 OBJE
2 FORM jpg
2 FILE actes/documents_familiars/matrimoni_1957.jpg
0 @I2@ INDI
1 NAME Carme /Sendrós/
1 NOTE @N1@
1 OBJE @O1@
0 @O1@ OBJE
1 FORM jpg
1 FILE actes/myheritage/retrat_carme.jpg
1 TITL Retrat de Carme
0 @N1@ NOTE Nota compartida amb CONT
1 CONT segona línia
0 TRLR`;

describe('media (OBJE) parsing', () => {
  it('parses inline OBJE with FORM/FILE/TITL/NOTE', () => {
    const data = parseGedcom(GED_WITH_MEDIA);
    const i1 = data.individuals.get('I1')!;
    expect(i1.media).toHaveLength(2);

    const doc = i1.media[0];
    expect(doc.form).toBe('jpg');
    expect(doc.file).toBe('actes/documents_familiars/llibre_familia_p21.jpg');
    expect(doc.title).toBe('Llibre de família');
    expect(doc.note).toContain('Llibre de família: fill tercer.');
  });

  it('parses MyHeritage custom media tags and _PRIM', () => {
    const data = parseGedcom(GED_WITH_MEDIA);
    const i1 = data.individuals.get('I1')!;
    const photo = i1.media[1];
    expect(photo.primary).toBe(true);
    expect(photo.customTags.get('_FILESIZE')).toBe('185705');
    expect(photo.customTags.get('_CUTOUT')).toBe('Y');
  });

  it('parses family OBJE', () => {
    const data = parseGedcom(GED_WITH_MEDIA);
    const fam = data.families.get('F1')!;
    expect(fam.media).toHaveLength(1);
    expect(fam.media[0].file).toBe('actes/documents_familiars/matrimoni_1957.jpg');
  });

  it('resolves OBJE pointer references against top-level records', () => {
    const data = parseGedcom(GED_WITH_MEDIA);
    const i2 = data.individuals.get('I2')!;
    expect(i2.media).toHaveLength(1);
    expect(i2.media[0].file).toBe('actes/myheritage/retrat_carme.jpg');
    expect(i2.media[0].title).toBe('Retrat de Carme');
  });

  it('stores top-level OBJE records in data.media', () => {
    const data = parseGedcom(GED_WITH_MEDIA);
    expect(data.media.get('O1')?.file).toBe('actes/myheritage/retrat_carme.jpg');
  });

  it('drops dangling OBJE pointer references', () => {
    const ged = `0 HEAD
1 GEDC
2 VERS 5.5.1
0 @I1@ INDI
1 NAME Test /Persona/
1 OBJE @O404@
0 TRLR`;
    const data = parseGedcom(ged);
    expect(data.individuals.get('I1')!.media).toHaveLength(0);
  });
});

describe('shared NOTE record resolution', () => {
  it('resolves NOTE pointers to shared note text (with CONT)', () => {
    const data = parseGedcom(GED_WITH_MEDIA);
    const i2 = data.individuals.get('I2')!;
    expect(i2.notes).toContain('Nota compartida amb CONT\nsegona línia');
  });

  it('resolves NOTE pointers under events', () => {
    const ged = `0 HEAD
1 GEDC
2 VERS 5.5.1
0 @I1@ INDI
1 NAME Test /Persona/
1 BIRT
2 DATE 7 JAN 1964
2 NOTE @N2@
0 @N2@ NOTE Nota de bateig compartida
0 TRLR`;
    const data = parseGedcom(ged);
    const i1 = data.individuals.get('I1')!;
    expect(i1.birth?.notes).toContain('Nota de bateig compartida');
  });

  it('keeps shared records in data.notes', () => {
    const data = parseGedcom(GED_WITH_MEDIA);
    expect(data.notes.get('N1')).toBe('Nota compartida amb CONT\nsegona línia');
  });
});
