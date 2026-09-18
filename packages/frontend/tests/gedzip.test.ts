import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseGedcom } from '@gedcom/parser';
import { readGedzip, attachMedia } from '../src/services/gedzip';

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../parser/tests/fixtures/gedcom70',
);
const gdz = (name: string) => new Blob([readFileSync(join(FIXTURES, `${name}.gdz`))]);

let blobUrls = 0;

beforeAll(() => {
  // jsdom has no blob URL store; the identity is all these tests need.
  URL.createObjectURL = () => `blob:test/${blobUrls++}`;
});

describe('readGedzip', () => {
  it('pulls the tree out of a package with no media', async () => {
    const { text, bytes, media } = await readGedzip(gdz('minimal70'));

    expect(text).toContain('0 HEAD');
    expect(bytes.byteLength).toBe(39);
    expect(media.size).toBe(0);
  });

  it('creates an object URL per image, ignoring the other files', async () => {
    const { media } = await readGedzip(gdz('maximal70'));

    // The package also holds .mp3, .oga, .vtt and an extensionless file.
    expect([...media.keys()]).toEqual(['media/CharlotteBrontë.jpg']);
    expect(media.get('media/CharlotteBrontë.jpg')).toMatch(/^blob:/);
  });

  it('rejects a zip without a .ged inside', async () => {
    const empty = new Blob([
      new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...new Array(18).fill(0)]),
    ]);
    await expect(readGedzip(empty)).rejects.toThrow(/No .ged file/);
  });
});

describe('attachMedia', () => {
  it('matches a percent-encoded FILE against the zip entry', async () => {
    const { text, media } = await readGedzip(gdz('maximal70'));
    const data = parseGedcom(text);

    attachMedia(data, media);

    const i1 = data.individuals.get('I1')!;
    // 'media/CharlotteBront%C3%AB.jpg' is the zip's 'media/CharlotteBrontë.jpg'.
    expect(i1.media[0].url).toBe(media.get('media/CharlotteBrontë.jpg'));
    // Files the package does not carry stay unresolved rather than mismatched.
    expect(i1.media.slice(1).every((m) => m.url === undefined)).toBe(true);
  });

  it('falls back to the file name when the exporter flattened the folders', () => {
    const data = parseGedcom('0 @I1@ INDI\n1 OBJE\n2 FILE ./photos/gran.jpg\n0 TRLR');

    attachMedia(data, new Map([['gran.jpg', 'blob:flat']]));

    expect(data.individuals.get('I1')!.media[0].url).toBe('blob:flat');
  });
});
