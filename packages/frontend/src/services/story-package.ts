// A story package (.historia.zip) carries one story to relatives who do not
// have the tree: the story, only the part of the tree it shows, and its
// photos. Living people go in as they are: packages are shown to the
// family itself. (Anonymising them: see git history of this file.)
//
//   story.json   the story
//   tree.json    individuals, families and sources it needs
//   media/...    the photos its media steps show, at their OBJE FILE path

import JSZip from 'jszip';
import type { GedcomData, Individual, Family, Source } from '@gedcom/shared';
import { createGedcomData } from '@gedcom/shared';
import { storyPersonIds, type Story } from '@gedcom/shared/story';
import { extractSubgraph } from '@/visualization/subgraph-extractor';
import { attachMedia, decodePath } from '@/services/gedzip';
import { parseStory } from '@/services/stories';

interface PackageTree {
  individuals: Individual[];
  families: Family[];
  sources: Source[];
}

/** The slice of the tree a story shows. */
export function storySubset(story: Story, data: GedcomData): GedcomData {
  const subset = createGedcomData();
  const add = (part: GedcomData) => {
    for (const [id, ind] of part.individuals) subset.individuals.set(id, ind);
    for (const [id, fam] of part.families) subset.families.set(id, fam);
  };
  for (const id of storyPersonIds(story)) add(extractSubgraph(data, id, 0));
  for (const step of story.steps) {
    if (step.stage.kind === 'tree') add(extractSubgraph(data, step.stage.focusId, step.stage.generations));
  }

  for (const step of story.steps) {
    const sourceId = step.stage.kind === 'document' ? step.stage.sourceId : undefined;
    const source = sourceId ? data.sources.get(sourceId) : undefined;
    if (source) subset.sources.set(source.id, source);
  }
  return subset;
}

// Maps do not survive JSON: custom tags are GEDCOM noise a story never shows.
const stripTags = <T extends { customTags?: Map<string, string> }>(x: T) => ({ ...x, customTags: undefined });

export async function buildPackage(story: Story, data: GedcomData): Promise<Blob> {
  const subset = storySubset(story, data);
  const tree: PackageTree = {
    individuals: [...subset.individuals.values()].map(stripTags) as Individual[],
    families: [...subset.families.values()].map(stripTags) as Family[],
    sources: [...subset.sources.values()],
  };

  const zip = new JSZip();
  zip.file('story.json', JSON.stringify(story, null, 2));
  zip.file('tree.json', JSON.stringify(tree));

  for (const step of story.steps) {
    if (step.stage.kind !== 'media') continue;
    for (const item of step.stage.items) {
      if (!item.personId || !item.file) continue;
      const ind = subset.individuals.get(item.personId);
      const url = ind?.media.find(m => m.file === item.file)?.url;
      if (url) zip.file(decodePath(item.file), await (await fetch(url)).blob());
    }
  }
  return zip.generateAsync({ type: 'blob' });
}

const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif)$/i;

export interface OpenedPackage {
  story: Story;
  data: GedcomData;
  /** zip path → blob URL. The caller owns revoking these. */
  media: Map<string, string>;
}

/** Throws with a readable message when the file is not a story package. */
export async function readPackage(file: Blob): Promise<OpenedPackage> {
  const zip = await JSZip.loadAsync(file);
  const storyFile = zip.file('story.json');
  const treeFile = zip.file('tree.json');
  if (!storyFile || !treeFile) throw new Error('Not a story package');

  const story = parseStory(await storyFile.async('string'));
  const tree = JSON.parse(await treeFile.async('string')) as PackageTree;
  if (!Array.isArray(tree.individuals) || !Array.isArray(tree.families)) throw new Error('Invalid tree.json');

  const data = createGedcomData();
  for (const ind of tree.individuals) data.individuals.set(ind.id, { ...ind, customTags: new Map() });
  for (const fam of tree.families) data.families.set(fam.id, { ...fam, customTags: new Map() });
  for (const src of tree.sources ?? []) data.sources.set(src.id, src);

  const media = new Map<string, string>();
  try {
    for (const entry of Object.values(zip.files)) {
      if (entry.dir || !IMAGE_RE.test(entry.name)) continue;
      media.set(entry.name, URL.createObjectURL(await entry.async('blob')));
    }
  } catch (err) {
    // The caller never gets the map, so nobody else can revoke these.
    for (const url of media.values()) URL.revokeObjectURL(url);
    throw err;
  }
  attachMedia(data, media);
  return { story, data, media };
}
