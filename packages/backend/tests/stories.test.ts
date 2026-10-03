import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGedcom } from '../../parser/src/index.js';
import type { SerializedGedcomData } from '@gedcom/shared';
import { storyDraftSchema } from '@gedcom/shared/story';
import { checkStory, getStory, storyTools } from '../src/tools/stories.js';

const DEMO_FILE = join(dirname(fileURLToPath(import.meta.url)), '../../../demo-catala.ged');
const parsed = parseGedcom(readFileSync(DEMO_FILE, 'utf-8'));
const data: SerializedGedcomData = {
  individuals: Object.fromEntries(parsed.individuals),
  families: Object.fromEntries(parsed.families),
  sources: Object.fromEntries(parsed.sources),
};
data.individuals.I1.media = [{ file: 'media/josep.jpg' }];

const draft = (stage: unknown, people: string[] = ['I1']) => storyDraftSchema.parse({
  title: 'Josep',
  rootId: '@I1@',
  steps: [{ title: 'Neix', body: 'Text', people, stage }],
});

describe('checkStory', () => {
  it('accepts what the tree backs', () => {
    expect(checkStory(data, draft({ kind: 'tree', focusId: 'I1' }))).toEqual([]);
    expect(checkStory(data, draft({ kind: 'document', sourceId: '@S1@', title: 'Baptismes' }))).toEqual([]);
    expect(checkStory(data, draft({ kind: 'media', items: [{ personId: 'I1', file: 'media/josep.jpg' }] }))).toEqual([]);
  });

  it('names every id, source and photo the tree lacks', () => {
    expect(checkStory(data, draft({ kind: 'tree', focusId: 'I99' }, ['I98']))).toEqual([
      'Unknown individual id I98',
      'Unknown individual id I99',
    ]);
    expect(checkStory(data, draft({ kind: 'document', sourceId: 'S9', title: 'x' }))).toEqual([
      'Step 1 ("Neix"): unknown source id S9',
    ]);
    expect(checkStory(data, draft({ kind: 'media', items: [{ personId: 'I1', file: 'altra.jpg' }] }))).toHaveLength(1);
  });
});

describe('save_story', () => {
  const { save_story } = storyTools(data);
  const run = (input: unknown) => save_story.execute!(input as never, { toolCallId: 't', messages: [] });

  it('keeps a valid story for the browser to fetch', async () => {
    const result = await run({ story: draft({ kind: 'tree', focusId: 'I1' }) });
    expect(result).toMatchObject({ ok: true, title: 'Josep', steps: 1 });
    const id = (result as { story_id: string }).story_id;
    expect(getStory(id)?.rootId).toBe('I1');
  });

  it('returns the errors instead of saving', async () => {
    expect(await run({ story: draft({ kind: 'tree', focusId: 'I99' }) })).toEqual({
      ok: false,
      errors: ['Unknown individual id I99'],
    });
  });
});
