import { z } from 'zod';

// Imported as `@gedcom/shared/story`, not from the package root: zod would
// otherwise ride along into every bundle that touches shared, workers included.

/**
 * A story: a guided walk through the tree, one step at a time. Each step is a
 * piece of narrative beside a "stage" that shows what the text talks about.
 * Agents compose them (the schema doubles as the tool input), people play them.
 */

/** A record id as the parser keeps it: `I1`, not the `@I1@` written in the file. */
const xref = z.string().transform((id) => id.replace(/^@(.*)@$/, '$1'));

/** A photo or document scan: an OBJE FILE of a person, or a direct URL. */
const storyMedia = z.object({
  personId: xref.optional().describe('Owner of the OBJE, with `file`'),
  file: z.string().optional().describe('OBJE FILE reference exactly as in the tree'),
  // https only: an imported story must not point the viewer at http or javascript: URLs.
  src: z.url({ protocol: /^https$/ }).optional().describe('Direct https image URL, when the image is not in the tree'),
  caption: z.string().optional(),
});

/**
 * Map backgrounds. ICGC layers: the topographic map covers the world, the
 * orthophotos only Catalonia; the 1945-46 and 1956-57 ones are the American
 * flights, the countryside as the family knew it.
 */
export const STORY_BASEMAPS = ['topografic', 'orto', 'orto-1945', 'orto-1956', 'osm'] as const;

const storyPlace = z.object({
  name: z.string(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  year: z.number().int().optional(),
  label: z.string().optional().describe('What happened here: "Neix Josep"'),
});

const stage = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('tree'),
    focusId: xref.describe('Individual the tree centres on'),
    generations: z.number().int().min(1).max(6).default(2),
  }),
  z.object({
    kind: z.literal('media'),
    items: z.array(storyMedia).min(1),
  }),
  z.object({
    kind: z.literal('document'),
    sourceId: xref.optional().describe('SOUR record id, when citing one'),
    title: z.string(),
    page: z.string().optional(),
    excerpt: z.string().optional().describe('Transcribed or summarised passage'),
  }),
  z.object({
    kind: z.literal('map'),
    places: z.array(storyPlace).min(1).describe('Coordinates from geocode_places'),
    route: z.boolean().default(false).describe('Join the places in order: a migration'),
    basemap: z.enum(STORY_BASEMAPS).default('topografic')
      .describe('orto-1945 / orto-1956: historical aerial photos, Catalonia only, zoom in on one place'),
  }),
]);

const storyStep = z.object({
  title: z.string(),
  date: z.string().optional().describe('When this step happens, free text: "1912", "cap a 1880"'),
  body: z.string().describe('Narrative; a blank line starts a new paragraph'),
  people: z.array(xref).default([]).describe('Individual ids this step is about; highlighted'),
  highlights: z.array(z.string()).default([]).describe('Key facts, shown as callouts'),
  notes: z.array(z.string()).default([]).describe('Research notes: doubts, sources to check'),
  stage,
});

/** What an author (an agent, a person) writes; ids and timestamps are added on save. */
export const storyDraftSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  rootId: xref.describe('Individual the story is about'),
  steps: z.array(storyStep).min(1),
});

export const storySchema = storyDraftSchema.extend({
  id: z.string(),
  createdAt: z.string(),
});

export type StoryDraft = z.input<typeof storyDraftSchema>;
export type Story = z.output<typeof storySchema>;
export type StoryStep = Story['steps'][number];
export type StoryStage = StoryStep['stage'];
export type StoryMedia = z.output<typeof storyMedia>;
export type StoryPlace = z.output<typeof storyPlace>;
export type StoryBasemap = typeof STORY_BASEMAPS[number];

export function createStory(draft: StoryDraft): Story {
  return storySchema.parse({
    ...draft,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
}

/** Every individual id a story points at, for checking it against a tree. */
export function storyPersonIds(story: z.output<typeof storyDraftSchema>): Set<string> {
  const ids = new Set([story.rootId]);
  for (const step of story.steps) {
    for (const id of step.people) ids.add(id);
    if (step.stage.kind === 'tree') ids.add(step.stage.focusId);
    if (step.stage.kind === 'media') {
      for (const m of step.stage.items) if (m.personId) ids.add(m.personId);
    }
  }
  return ids;
}
