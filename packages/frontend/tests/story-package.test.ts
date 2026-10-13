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
  it('follows follows the 100-year rule, unknown birth counting as alive', () => {
    expect(isLiving(data.individuals.get('I11')!, 2026)).toBe(true);
    expect(isLiving(data.individuals.get('I8')!, 2026)).toBe(false); // born 1901
    expect(isLiving(data.individuals.get('I1')!, 2026)).toBe(false); // died
    expect(isLiving({ ...data.individuals.get('I11')!, birth: undefined }, 2026)).toBe(true);
  });
});

describe('storySubset', () => {
  const subset = storySubset(story, data);

  it('keeps only the people the story shows, the living as they are', () => {
    expect(subset.individuals.has('I1')).toBe(true); // grandparent of Joan
    expect(subset.individuals.has('I4')).toBe(false); // Joan's aunt: not in any step
    expect(subset.individuals.get('I11')?.name?.full).toBe('Jordi Puig Font'); // living, shown to family
  });

  it('leaves hidden people out, with the families they alone kept', () => {
    // I11 Jordi, living: out of the package, and out of his parents' family.
    const hidden = storySubset({ ...story, hidden: ['I11'] }, data);
    expect(hidden.individuals.has('I11')).toBe(false);
    for (const fam of hidden.families.values()) {
      expect([fam.husband, fam.wife, ...fam.children]).not.toContain('I11');
    }
    expect(data.individuals.has('I11')).toBe(true); // the full tree is untouched
  });

  it('keeps only cited sources', () => {
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

    // A url riding in tree.json never survives: only the package's own files do.
    const scanned = createStory({
      title: 'Arbre', rootId: 'I6',
      steps: [{ title: '1974', body: 'Text', stage: { kind: 'media', items: [{ sourceId: 'S1', file: 'arbre.jpg' }] } }],
    });
    const withScan = new JSZip();
    withScan.file('story.json', JSON.stringify(scanned));
    withScan.file('tree.json', JSON.stringify({
      individuals: [{ ...data.individuals.get('I6'), media: [{ file: 'x.jpg', url: 'https://tracker.example/x.jpg' }] }],
      families: [],
      sources: [{ id: 'S1', media: [{ file: 'arbre.jpg', url: 'https://tracker.example/a.jpg' }] }],
    }));
    withScan.file('arbre.jpg', new Uint8Array([1]));
    const scan = await readPackage(new Blob([await withScan.generateAsync({ type: 'uint8array' })]));
    expect(scan.data.sources.get('S1')?.media?.[0].url).toMatch(/^blob:/);
    expect(scan.data.individuals.get('I6')?.media[0].url).toBeUndefined();

    const other = new JSZip();
    other.file('gedcom.ged', '0 HEAD');
    await expect(readPackage(new Blob([await other.generateAsync({ type: 'uint8array' })]))).rejects.toThrow('Not a story package');
  });
});
