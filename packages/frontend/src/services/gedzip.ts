// GEDZIP (.gdz) reader: the GEDCOM 7.0 container that ships a tree together
// with its media files. Spec: the tree is at /gedcom.ged and every OBJE FILE
// is a URI reference relative to the zip root.

import JSZip from 'jszip';
import type { GedcomData } from '@gedcom/shared';

export interface GedzipContents {
  text: string;
  bytes: ArrayBuffer;
  /** zip path → blob URL. The caller owns revoking these. */
  media: Map<string, string>;
}

const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif)$/i;

export async function readGedzip(file: Blob): Promise<GedzipContents> {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((e) => !e.dir);
  const ged = zip.file('gedcom.ged') ?? entries.find((e) => e.name.toLowerCase().endsWith('.ged'));
  if (!ged) throw new Error('No .ged file inside the GEDZIP package');

  // Bytes, not text: gedlint's encoding rules only fire on the original bytes.
  const bytes = await ged.async('arraybuffer');

  const media = new Map<string, string>();
  for (const entry of entries) {
    if (!IMAGE_RE.test(entry.name)) continue;
    media.set(entry.name, URL.createObjectURL(await entry.async('blob')));
  }

  return { text: new TextDecoder('utf-8').decode(bytes), bytes, media };
}

function decodePath(file: string): string {
  const path = file.replace(/^\.\//, '');
  try {
    return decodeURIComponent(path);
  } catch {
    // Not valid percent-encoding: the reference is a literal path.
    return path;
  }
}

const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/**
 * Point each OBJE FILE at the blob extracted from the package. FILE holds a
 * URI reference, so `media/Bront%C3%AB.jpg` is the zip's `media/Brontë.jpg`;
 * exporters that flatten the media folder still match on the file name.
 */
export function attachMedia(data: GedcomData, media: Map<string, string>): void {
  if (media.size === 0) return;
  const byName = new Map([...media].map(([path, url]) => [basename(path), url]));

  for (const ind of data.individuals.values()) {
    for (const m of ind.media) {
      const path = decodePath(m.file);
      m.url = media.get(path) ?? byName.get(basename(path));
    }
  }
}
