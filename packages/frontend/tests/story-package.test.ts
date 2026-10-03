// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { parseGedcom } from '@gedcom/parser';
import { createStory } from '@gedcom/shared/story';
import { storySubset, readPackage } from '@/services/story-package';
import { isLiving } from '@/services/research';

// demo-catala.ged: Josep I1 → Ramon I3 → Joan I6 → Antoni I9 → Jordi I11 (born 1956, no death).
const data = parseGedcom(readFileSync(join(__dirname, '../../../demo-catala.ged'), 'utf-8'));
const story = createStory({
  title: 'Cap a la ciutat',
  rootId: 'I6',
  steps: [
    { title: 'Joan', body: 'Text', stage: { kind: 'tree', focusId: 'I6', generations: 2 } },
    { title: 'Baptisme', body: 'Text', stage: { kind: 'document', sourceId: 'S1', title: 'Baptismes' } },
  ],
});

describe('isLiving', () => {
  it('follows the 100-year rule, unknown birth counting as alive', () => {
    expect(isLiving(data.individuals.get('I11')!, 2026)).toBe(true);
    expect(isLiving(data.individuals.get('I8')!, 2026)).toBe(false); // born 1901
    expect(isLiving(data.individuals.get('I1')!, 2026)).toBe(false); // died
    expect(isLiving({ ...data.individuals.get('I11')!, birth: undefined }, 2026)).toBe(true);
  });
});

describe('storySubset', () => {
  const subset = storySubset(story, data);

  it('keeps only the people the story shows, anonymising the living', () => {
    expect(subset.individuals.has('I1')).toBe(true); // grandparent of Joan
    expect(subset.individuals.has('I4')).toBe(false); // Joan's aunt: not in any step
    const jordi = subset.individuals.get('I11')!;
    expect(jordi.name?.full).toBe('Persona vivent');
    expect(jordi.birth).toBeUndefined();
    expect(jordi.famc).toEqual(['F4']); // still joins the tree
  });

  it('drops the marriage of a couple with a living spouse, and keeps only cited sources', () => {
    expect(subset.families.get('F4')?.marriage).toBeDefined(); // Antoni and Carme both died
    const carme = data.individuals.get('I10')!;
    const withCarmeAlive = { ...data, individuals: new Map(data.individuals).set('I10', { ...carme, death: undefined, events: [], birth: { type: 'BIRT', date: { year: 1960 } } }) };
    expect(storySubset(story, withCarmeAlive).families.get('F4')?.marriage).toBeUndefined();
    expect([...subset.sources.keys()]).toEqual(['S1']);
  });
});

describe('readPackage', () => {
  it('opens a package and rejects other zips', async () => {
    const zip = new JSZip();
    zip.file('story.json', JSON.stringify(story));
    zip.file('tree.json', JSON.stringify({ individuals: [...storySubset(story, data).individuals.values()], families: [], sources: [] }));
    const opened = await readPackage(new Blob([await zip.generateAsync({ type: 'uint8array' })]));
    expect(opened.story.title).toBe('Cap a la ciutat');
    expect(opened.data.individuals.get('I6')?.customTags).toBeInstanceOf(Map);

    const other = new JSZip();
    other.file('gedcom.ged', '0 HEAD');
    await expect(readPackage(new Blob([await other.generateAsync({ type: 'uint8array' })]))).rejects.toThrow('Not a story package');
  });
});
