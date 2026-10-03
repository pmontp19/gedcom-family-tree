import { tool } from 'ai';
import { z } from 'zod';
import type { SerializedGedcomData } from '@gedcom/shared';
import { createStory, storyDraftSchema, storyPersonIds, type Story } from '@gedcom/shared/story';

// Saved stories wait here until the browser fetches them: the story travels
// once, as the tool input, instead of the model writing it out a second time.
// ponytail: in memory, lost on restart; the browser keeps its own copy once saved.
const saved = new Map<string, Story>();

export function getStory(id: string): Story | undefined {
  return saved.get(id);
}

type Draft = z.output<typeof storyDraftSchema>;

/** Everything in a draft that the loaded tree cannot back: unknown people, sources, photos. */
export function checkStory(data: SerializedGedcomData, draft: Draft): string[] {
  const errors: string[] = [];
  for (const id of storyPersonIds(draft)) {
    if (!data.individuals[id]) errors.push(`Unknown individual id ${id}`);
  }
  draft.steps.forEach((step, i) => {
    const where = `Step ${i + 1} ("${step.title}")`;
    const { stage } = step;
    if (stage.kind === 'document' && stage.sourceId && !data.sources?.[stage.sourceId]) {
      errors.push(`${where}: unknown source id ${stage.sourceId}`);
    }
    if (stage.kind === 'media') {
      for (const item of stage.items) {
        if (item.src) continue;
        const media = item.personId ? data.individuals[item.personId]?.media ?? [] : [];
        if (!item.file || !media.some(m => m.file === item.file)) {
          errors.push(`${where}: media needs a src URL, or a personId plus one of their media files`);
        }
      }
    }
  });
  return errors;
}

export function storyTools(data: SerializedGedcomData) {
  return {
    save_story: tool({
      description:
        'Save a story: a guided walk through the family, step by step, for relatives to watch. ' +
        'Each step pairs a short narrative with a stage: the tree centred on someone, photos from ' +
        'get_individual_detail media, or a document (a source citation with an excerpt). ' +
        'Returns the errors to fix when the tree cannot back something, else the story_id to ' +
        'render with StoryCard.',
      inputSchema: z.object({ story: storyDraftSchema }),
      execute: async ({ story: draft }) => {
        const errors = checkStory(data, draft);
        if (errors.length > 0) return { ok: false, errors };
        const story = createStory(draft);
        saved.set(story.id, story);
        return { ok: true, story_id: story.id, title: story.title, subtitle: story.subtitle ?? null, steps: story.steps.length };
      },
    }),
  };
}
