import { describe, it, expect } from 'vitest';
import { createStory, storyPersonIds, storyDraftSchema } from '../src/models/story.js';

const draft = {
  title: 'Cap a la ciutat',
  rootId: '@I6@',
  steps: [
    { title: 'Neix', body: 'Text', stage: { kind: 'tree' as const, focusId: '@I1@' } },
    { title: 'Foto', body: 'Text', people: ['I3'], stage: { kind: 'media' as const, items: [{ personId: 'I4', file: 'a.jpg' }] } },
  ],
};

describe('story schema', () => {
  it('strips @ from ids, fills defaults and stamps id + date', () => {
    const story = createStory(draft);
    expect(story.rootId).toBe('I6');
    expect(story.steps[0].stage).toEqual({ kind: 'tree', focusId: 'I1', generations: 2 });
    expect(story.steps[0]).toMatchObject({ people: [], highlights: [], notes: [] });
    expect(story.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('collects every individual a story points at', () => {
    expect(storyPersonIds(storyDraftSchema.parse(draft))).toEqual(new Set(['I6', 'I1', 'I3', 'I4']));
  });

  it('rejects a story without steps or with an unknown stage', () => {
    expect(storyDraftSchema.safeParse({ ...draft, steps: [] }).success).toBe(false);
    const bad = { ...draft, steps: [{ title: 'x', body: 'y', stage: { kind: 'video' } }] };
    expect(storyDraftSchema.safeParse(bad).success).toBe(false);
  });
});
